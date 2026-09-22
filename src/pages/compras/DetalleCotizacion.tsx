import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, Send, Mail, MessageCircle, FileText, Check, Trophy, Ban, Calendar, ClipboardList, Truck, X, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import { BadgeProveedor } from '@/components/BadgeProveedor';
import type { AbrirDetalle } from './Compras';
import {
  ESTADO_PC, ESTADO_PC_PROV, DISPONIBILIDAD_LABEL, IVA_OPCIONES, fmtFecha, fmtCantidad, fmtMoneda, nombreCliente, haceCuanto, abrirPdf, calcularTotalesForm,
  type CotizacionDetalle as PC, type CotizacionProveedor, type Comparativa, type Disponibilidad, type MedioEnvio,
} from './tipos';
import { ModalShell, Cargando, Badge, Seccion, FichaTecnica, AdjuntosGrid, DropzoneAdjuntos, ConfirmacionRoja, inpCls, lblCls, btnPrimario, btnSecundario, btnPeligro } from './ui';

export function DetalleCotizacion({ id, onClose, onChanged, abrir }: { id: string; onClose: () => void; onChanged: () => void; abrir: AbrirDetalle }) {
  const [pc, setPc] = useState<PC | null>(null);
  const [comp, setComp] = useState<Comparativa | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [respuestaDe, setRespuestaDe] = useState<CotizacionProveedor | null>(null);
  const [panel, setPanel] = useState<null | 'cerrar' | { adjudicar: string }>(null);
  const [verItems, setVerItems] = useState(false);
  const [msgPreview, setMsgPreview] = useState<{ prov: CotizacionProveedor; medio: MedioEnvio; mensaje: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.get<PC>(`/compras/cotizaciones/${id}`), api.get<Comparativa>(`/compras/cotizaciones/${id}/comparativa`)]);
      setPc(d); setComp(c);
    } catch { toast.error('Error al cargar la cotización'); onClose(); }
    finally { setLoading(false); }
  }, [id, onClose]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <Cargando />;
  if (!pc) return null;

  const est = ESTADO_PC[pc.estado];
  const abierta = pc.estado === 'abierta';

  async function enviar(prov: CotizacionProveedor, medio: MedioEnvio, mensaje?: string) {
    setEnviando(prov.id);
    try {
      const r = await api.post<{ enviado: boolean; mensaje: string }>(`/compras/cotizaciones/${id}/enviar`, { proveedor_id: prov.proveedor_id, medio, mensaje });
      toast.success(medio === 'manual' ? 'Marcada como enviada' : `Enviada a ${prov.proveedor.nombre} por ${medio === 'whatsapp' ? 'WhatsApp' : 'email'}`);
      setMsgPreview(null); onChanged(); await cargar();
      return r;
    } catch (e) { toastApiError(e, { fallback: 'No se pudo enviar' }); }
    finally { setEnviando(null); }
  }

  async function adjudicar(proveedorId: string) {
    setEnviando('adj');
    try {
      const r = await api.post<{ id: string; numero: string }>(`/compras/cotizaciones/${id}/adjudicar`, { proveedor_id: proveedorId });
      toast.success(`Orden ${r.numero} generada`);
      onChanged(); abrir('oc', r.id);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo adjudicar' }); }
    finally { setEnviando(null); setPanel(null); }
  }

  async function cerrar(motivo: string) {
    setEnviando('cerrar');
    try {
      await api.post(`/compras/cotizaciones/${id}/cerrar`, { motivo });
      toast.success('Cotización cerrada sin comprar');
      setPanel(null); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cerrar' }); }
    finally { setEnviando(null); }
  }

  const mejor = comp?.mejor;
  const respondieron = comp?.proveedores ?? [];

  return (
    <ModalShell
      icon={<Scale size={20} />} iconCls="bg-sky-50 text-sky-700"
      titulo={pc.numero}
      subtitulo={<>
        {pc.solicitud.cliente ? nombreCliente(pc.solicitud.cliente) : 'Stock propio'}{pc.solicitud.obra ? ` · ${pc.solicitud.obra}` : ''} · creada el {fmtFecha(pc.created_at)}
        {pc.fecha_limite && <> · <Calendar size={10} className="inline" /> responder antes del <strong>{fmtFecha(pc.fecha_limite)}</strong></>}
      </>}
      badges={<Badge label={est.label} cls={est.cls} />}
      onClose={onClose}
      ancho="sm:max-w-4xl"
    >
      {/* Vínculos */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => abrir('sc', pc.solicitud.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 h-9 hover:bg-amber-100">
          <ClipboardList size={12} /> {pc.solicitud.numero}
        </button>
        {pc.orden_compra && (
          <button onClick={() => abrir('oc', pc.orden_compra!.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 h-9 hover:bg-emerald-100">
            <Truck size={12} /> {pc.orden_compra.numero}
          </button>
        )}
        <button onClick={() => setVerItems(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 h-9 hover:bg-gray-100 ml-auto">
          {pc.items.length} ítem{pc.items.length === 1 ? '' : 's'} {verItems ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {verItems && (
        <div className="space-y-1.5">
          {pc.items.map(it => (
            <div key={it.id} className="flex items-start gap-3 p-2.5 border border-gray-200 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{it.descripcion}</p>
                <FichaTecnica e={it.especificaciones} />
              </div>
              <p className="text-sm font-bold text-gray-800 shrink-0">×{fmtCantidad(it.cantidad_cotizada ?? it.cantidad, it.unidad)}</p>
            </div>
          ))}
        </div>
      )}

      {pc.motivo_cierre && <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3"><strong>Cierre:</strong> {pc.motivo_cierre}</p>}

      {/* Proveedores */}
      <Seccion titulo={`Proveedores (${pc.proveedores.length})`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pc.proveedores.map(cp => {
            const pe = ESTADO_PC_PROV[cp.estado];
            const respondio = !!cp.respondida_at && cp.estado !== 'sin_respuesta';
            const ocupado = enviando === cp.id;
            return (
              <div key={cp.id} className={cn('rounded-xl border p-3 space-y-2', cp.estado === 'seleccionada' ? 'border-emerald-400 bg-emerald-50/40' : cp.estado === 'descartada' ? 'border-gray-200 opacity-70' : 'border-gray-300')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 truncate">{cp.proveedor.nombre}</p>
                      <BadgeProveedor proveedor={cp.proveedor} />
                      <Badge label={pe.label} cls={pe.cls} />
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{[cp.contacto || cp.proveedor.contacto, cp.proveedor.telefono, cp.proveedor.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                    {cp.enviada_at && <p className="text-[11px] text-sky-700">Enviada {haceCuanto(cp.enviada_at)} por {cp.enviada_medio === 'manual' ? 'otro medio' : cp.enviada_medio}</p>}
                    {cp.respondida_at && <p className="text-[11px] text-emerald-700">Respondió {haceCuanto(cp.respondida_at)}</p>}
                  </div>
                  {respondio && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-gray-900 tabular-nums">{fmtMoneda(cp.total)}</p>
                      <p className="text-[10px] text-gray-500">total final{cp.plazo_dias != null ? ` · ${cp.plazo_dias} días` : ''}</p>
                    </div>
                  )}
                </div>

                {respondio && (
                  <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Neto {fmtMoneda(cp.subtotal_neto)}</span>
                    {Number(cp.descuento_monto) > 0 && <span>Desc. −{fmtMoneda(cp.descuento_monto)}</span>}
                    <span>IVA {fmtMoneda(cp.iva_monto)}</span>
                    {Number(cp.flete) > 0 && <span>Flete {fmtMoneda(cp.flete)}</span>}
                    {cp.disponibilidad && <span>{DISPONIBILIDAD_LABEL[cp.disponibilidad]}</span>}
                    {cp.forma_pago && <span>Pago: {cp.forma_pago}</span>}
                    {cp.validez_hasta && <span>Válida hasta {fmtFecha(cp.validez_hasta)}</span>}
                  </div>
                )}
                {cp.observaciones && <p className="text-[11px] text-gray-600 italic">{cp.observaciones}</p>}
                {(cp.archivo_url || cp.adjuntos?.length > 0) && <AdjuntosGrid urls={[cp.archivo_url, ...(cp.adjuntos ?? [])].filter(Boolean) as string[]} size="sm" />}

                {abierta && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button onClick={() => abrirPdf(`/compras/cotizaciones/${id}/pdf?proveedor_id=${cp.proveedor_id}`).catch(e => toast.error(e.message))}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 h-9 hover:bg-gray-50" title="Ver el PDF que recibe el proveedor">
                      <FileText size={12} /> PDF
                    </button>
                    {cp.proveedor.telefono && (
                      <button disabled={ocupado} onClick={() => previsualizar(cp, 'whatsapp')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg px-2.5 h-9 disabled:opacity-50">
                        <MessageCircle size={12} /> {cp.enviada_at ? 'Reenviar' : 'WhatsApp'}
                      </button>
                    )}
                    {cp.proveedor.email && (
                      <button disabled={ocupado} onClick={() => previsualizar(cp, 'email')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg px-2.5 h-9 disabled:opacity-50">
                        <Mail size={12} /> Email
                      </button>
                    )}
                    {!cp.enviada_at && (
                      <button disabled={ocupado} onClick={() => enviar(cp, 'manual')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 h-9 hover:bg-gray-50 disabled:opacity-50" title="Ya se la pasé por otro medio">
                        <Send size={12} /> Ya enviada
                      </button>
                    )}
                    <button onClick={() => setRespuestaDe(cp)}
                      className={cn('inline-flex items-center gap-1 text-[11px] font-semibold rounded-lg px-2.5 h-9 ml-auto', respondio ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50' : 'text-white bg-lime-600 hover:bg-lime-700')}>
                      <Check size={12} /> {respondio ? 'Editar respuesta' : 'Cargar respuesta'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Seccion>

      {/* Comparativa */}
      {respondieron.length > 0 && (
        <Seccion titulo="Comparativa">
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Proveedor</th>
                  <th className="text-right px-3 py-2">Total final</th>
                  <th className="text-right px-3 py-2">Neto</th>
                  <th className="text-right px-3 py-2">Flete</th>
                  <th className="text-right px-3 py-2">Plazo</th>
                  <th className="text-left px-3 py-2">Disponibilidad</th>
                  <th className="text-left px-3 py-2">Forma de pago</th>
                  <th className="text-left px-3 py-2">Validez</th>
                  {abierta && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {respondieron.map(f => {
                  const pid = f.proveedor.id;
                  const celda = (ok: boolean) => cn('px-3 py-2 text-right tabular-nums', ok && 'bg-emerald-50 text-emerald-800 font-bold');
                  return (
                    <tr key={f.cotizacion_proveedor_id} className={cn(f.estado === 'seleccionada' && 'bg-emerald-50/50')}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{f.proveedor.nombre}</span>
                          {mejor?.total === pid && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5"><Trophy size={9} /> Menor costo</span>}
                          {f.estado === 'seleccionada' && <span className="text-[10px] font-bold text-white bg-emerald-600 rounded-full px-2 py-0.5">Elegido</span>}
                        </div>
                        {f.con_precios_por_item && <span className="text-[10px] text-gray-500">precios por ítem</span>}
                      </td>
                      <td className={celda(mejor?.total === pid)}>{fmtMoneda(f.total)}</td>
                      <td className={celda(mejor?.neto === pid)}>{fmtMoneda(f.subtotal_neto)}</td>
                      <td className={celda(mejor?.flete === pid)}>{f.flete > 0 ? fmtMoneda(f.flete) : 'Sin cargo'}</td>
                      <td className={celda(mejor?.plazo === pid)}>{f.plazo_dias != null ? `${f.plazo_dias} d` : '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{f.disponibilidad ? DISPONIBILIDAD_LABEL[f.disponibilidad] : '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{f.forma_pago ?? '—'}</td>
                      <td className={cn('px-3 py-2 text-gray-700', mejor?.validez === pid && 'bg-emerald-50 text-emerald-800 font-bold')}>{f.validez_hasta ? fmtFecha(f.validez_hasta) : '—'}</td>
                      {abierta && (
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => setPanel({ adjudicar: pid })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-2.5 h-9 whitespace-nowrap">
                            <Check size={12} /> Elegir
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {comp && comp.pendientes.length > 0 && abierta && (
            <p className="text-[11px] text-gray-500 mt-1.5">Todavía sin respuesta: {comp.pendientes.map(p => p.nombre).join(', ')}.</p>
          )}
        </Seccion>
      )}

      {abierta && !panel && (
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button onClick={() => setPanel('cerrar')} className={btnPeligro}><Ban size={14} /> Cerrar sin comprar</button>
        </div>
      )}

      {panel === 'cerrar' && (
        <ConfirmacionRoja titulo="¿Cerrar la cotización sin comprar?" texto="Los ítems vuelven a quedar pendientes en la solicitud." conMotivo labelConfirmar="Cerrar cotización"
          cargando={enviando === 'cerrar'} onConfirmar={cerrar} onCancelar={() => setPanel(null)} />
      )}

      {panel && typeof panel === 'object' && (() => {
        const f = respondieron.find(x => x.proveedor.id === panel.adjudicar);
        if (!f) return null;
        return (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
            <p className="text-sm font-bold text-emerald-900 flex items-center gap-2"><Trophy size={16} /> Elegir a {f.proveedor.nombre} y generar la orden de compra</p>
            <p className="text-sm text-emerald-800">
              Se crea una OC en borrador por <strong>{fmtMoneda(f.total)}</strong> (neto {fmtMoneda(f.subtotal_neto)} + IVA {fmtMoneda(f.iva_monto)}{f.flete > 0 ? ` + flete ${fmtMoneda(f.flete)}` : ''})
              {f.plazo_dias != null ? `, entrega estimada en ${f.plazo_dias} días` : ''}. Los otros proveedores quedan descartados.
              {!f.con_precios_por_item && ' Como pasó un solo total, el precio por ítem se prorratea por el costo de referencia.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => adjudicar(f.proveedor.id)} disabled={enviando === 'adj'} className={cn(btnPrimario, 'flex-1 bg-emerald-600 hover:bg-emerald-700')}>
                {enviando === 'adj' ? 'Generando…' : 'Confirmar y generar OC'}
              </button>
              <button onClick={() => setPanel(null)} className={btnSecundario}>Volver</button>
            </div>
          </div>
        );
      })()}

      {respuestaDe && (
        <ModalRespuesta pc={pc} cp={respuestaDe} onClose={() => setRespuestaDe(null)}
          onSaved={async () => { setRespuestaDe(null); onChanged(); await cargar(); }} />
      )}

      {msgPreview && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setMsgPreview(null); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <p className="font-bold text-gray-900 flex items-center gap-2"><Eye size={16} /> Mensaje para {msgPreview.prov.proveedor.nombre}</p>
              <button onClick={() => setMsgPreview(null)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-600">Se envía con el PDF de la cotización adjunto por {msgPreview.medio === 'whatsapp' ? `WhatsApp al ${msgPreview.prov.proveedor.telefono}` : `email a ${msgPreview.prov.proveedor.email}`}. Podés retocar el texto:</p>
              <textarea value={msgPreview.mensaje} onChange={e => setMsgPreview({ ...msgPreview, mensaje: e.target.value })} rows={9} className={inpCls} />
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
              <button onClick={() => setMsgPreview(null)} className={btnSecundario}>Cancelar</button>
              <button onClick={() => enviar(msgPreview.prov, msgPreview.medio, msgPreview.mensaje)} disabled={!!enviando} className={btnPrimario}>
                <Send size={14} /> {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );

  async function previsualizar(cp: CotizacionProveedor, medio: MedioEnvio) {
    try {
      const r = await api.get<{ mensaje: string }>(`/compras/cotizaciones/${id}/mensaje`);
      setMsgPreview({ prov: cp, medio, mensaje: r.mensaje });
    } catch (e) { toastApiError(e, { fallback: 'No se pudo armar el mensaje' }); }
  }
}

// ── Modal: cargar la respuesta de un proveedor ────────────────────────────────

function ModalRespuesta({ pc, cp, onClose, onSaved }: { pc: PC; cp: CotizacionProveedor; onClose: () => void; onSaved: () => void }) {
  const porItemInicial = cp.items.length > 0;
  const [modo, setModo] = useState<'total' | 'items'>(porItemInicial ? 'items' : 'total');
  const [neto, setNeto] = useState(String(Number(cp.subtotal_neto) || ''));
  const [desc, setDesc] = useState(String(Number(cp.descuento_monto) || ''));
  const [ivaPct, setIvaPct] = useState<number>(Number(cp.iva_pct) || 21);
  const [flete, setFlete] = useState(String(Number(cp.flete) || ''));
  const [plazo, setPlazo] = useState(cp.plazo_dias != null ? String(cp.plazo_dias) : '');
  const [disp, setDisp] = useState<Disponibilidad | ''>(cp.disponibilidad ?? '');
  const [formaPago, setFormaPago] = useState(cp.forma_pago ?? '');
  const [validez, setValidez] = useState(cp.validez_hasta ? cp.validez_hasta.slice(0, 10) : '');
  const [obs, setObs] = useState(cp.observaciones ?? '');
  const [archivo, setArchivo] = useState<string | null>(cp.archivo_url);
  const [adjuntos, setAdjuntos] = useState<string[]>(cp.adjuntos ?? []);
  const [items, setItems] = useState(() => pc.items.map(i => {
    const r = cp.items.find(x => x.solicitud_item_id === i.id);
    return { id: i.id, precio: r ? String(Number(r.precio_unitario_neto)) : '', desc: r ? String(Number(r.descuento_pct)) : '0', iva: r ? Number(r.iva_pct) : 21 };
  }));
  const [guardando, setGuardando] = useState(false);

  const totItems = useMemo(() => calcularTotalesForm(pc.items.map(i => {
    const l = items.find(x => x.id === i.id)!;
    return { cantidad: Number(i.cantidad_cotizada ?? i.cantidad), precio: parseFloat(l.precio) || 0, desc: parseFloat(l.desc) || 0, iva: l.iva };
  }), parseFloat(flete) || 0), [items, pc.items, flete]);

  const totCab = useMemo(() => {
    const n = parseFloat(neto) || 0, d = parseFloat(desc) || 0, f = parseFloat(flete) || 0;
    const iva = (n - d) * ivaPct / 100;
    return { neto: n, desc: d, iva, flete: f, total: n - d + iva + f };
  }, [neto, desc, ivaPct, flete]);

  const tot = modo === 'items' ? totItems : totCab;

  async function guardar(sinRespuesta = false) {
    setGuardando(true);
    try {
      const body: Record<string, unknown> = {
        flete: parseFloat(flete) || 0, plazo_dias: plazo ? parseInt(plazo) : null, disponibilidad: disp || null,
        forma_pago: formaPago.trim() || null, validez_hasta: validez || null, observaciones: obs.trim() || null,
        archivo_url: archivo, adjuntos,
      };
      if (sinRespuesta) body.sin_respuesta = true;
      else if (modo === 'items') body.items = items.map(l => ({ solicitud_item_id: l.id, precio_unitario_neto: parseFloat(l.precio) || 0, descuento_pct: parseFloat(l.desc) || 0, iva_pct: l.iva }));
      else { body.subtotal_neto = parseFloat(neto) || 0; body.descuento_monto = parseFloat(desc) || 0; body.iva_pct = ivaPct; }
      await api.put(`/compras/cotizaciones/${pc.id}/proveedores/${cp.proveedor_id}/respuesta`, body);
      toast.success(sinRespuesta ? 'Marcado sin respuesta' : 'Respuesta guardada');
      onSaved();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar la respuesta' }); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[94dvh] sm:max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <p className="font-bold text-gray-900">Respuesta de {cp.proveedor.nombre}</p>
            <p className="text-xs text-gray-600">{pc.numero} · {pc.items.length} ítem{pc.items.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button onClick={() => setModo('total')} className={cn('px-3 h-9 rounded-md text-xs font-semibold', modo === 'total' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>Un solo total</button>
            <button onClick={() => setModo('items')} className={cn('px-3 h-9 rounded-md text-xs font-semibold', modo === 'items' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>Precio por ítem</button>
          </div>

          {modo === 'total' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={lblCls}>Neto (sin IVA)</label><MontoInput value={neto} onChange={setNeto} className={inpCls} /></div>
              <div><label className={lblCls}>Descuento $</label><MontoInput value={desc} onChange={setDesc} className={inpCls} /></div>
              <div><label className={lblCls}>IVA</label>
                <select value={ivaPct} onChange={e => setIvaPct(Number(e.target.value))} className={inpCls}>{IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}</select>
              </div>
              <div><label className={lblCls}>Flete</label><MontoInput value={flete} onChange={setFlete} className={inpCls} /></div>
            </div>
          ) : (
            <div className="space-y-2">
              {pc.items.map(i => {
                const l = items.find(x => x.id === i.id)!;
                const up = (patch: Partial<typeof l>) => setItems(ls => ls.map(x => x.id === i.id ? { ...x, ...patch } : x));
                return (
                  <div key={i.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">{i.descripcion}</p><FichaTecnica e={i.especificaciones} /></div>
                      <p className="text-sm font-bold text-gray-800 shrink-0">×{fmtCantidad(i.cantidad_cotizada ?? i.cantidad, i.unidad)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={lblCls}>P. unit. neto</label><MontoInput value={l.precio} onChange={v => up({ precio: v })} className={inpCls} /></div>
                      <div><label className={lblCls}>Desc. %</label><input type="number" min="0" max="100" step="0.5" value={l.desc} onChange={e => up({ desc: e.target.value })} className={inpCls} /></div>
                      <div><label className={lblCls}>IVA</label>
                        <select value={l.iva} onChange={e => up({ iva: Number(e.target.value) })} className={inpCls}>{IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}</select>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div><label className={lblCls}>Flete</label><MontoInput value={flete} onChange={setFlete} className={cn(inpCls, 'sm:max-w-[200px]')} /></div>
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm flex flex-wrap gap-x-5 gap-y-1">
            <span>Neto <strong>{fmtMoneda(tot.neto)}</strong></span>
            {tot.desc > 0 && <span>Desc. <strong>−{fmtMoneda(tot.desc)}</strong></span>}
            <span>IVA <strong>{fmtMoneda(tot.iva)}</strong></span>
            {tot.flete > 0 && <span>Flete <strong>{fmtMoneda(tot.flete)}</strong></span>}
            <span className="ml-auto text-base">Total <strong className="text-gray-900">{fmtMoneda(tot.total)}</strong></span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={lblCls}>Plazo (días)</label><input type="number" min="0" value={plazo} onChange={e => setPlazo(e.target.value)} className={inpCls} /></div>
            <div><label className={lblCls}>Disponibilidad</label>
              <select value={disp} onChange={e => setDisp(e.target.value as Disponibilidad | '')} className={inpCls}>
                <option value="">—</option>
                {(Object.keys(DISPONIBILIDAD_LABEL) as Disponibilidad[]).map(d => <option key={d} value={d}>{DISPONIBILIDAD_LABEL[d]}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lblCls}>Forma de pago</label><input value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inpCls} placeholder="Ej: 50% anticipo" /></div>
            <div><label className={lblCls}>Válida hasta</label><input type="date" value={validez} onChange={e => setValidez(e.target.value)} className={inpCls} /></div>
            <div className="col-span-2 sm:col-span-3"><label className={lblCls}>Observaciones</label><input value={obs} onChange={e => setObs(e.target.value)} className={inpCls} /></div>
          </div>

          <div>
            <label className={lblCls}>Cotización del proveedor (PDF o foto)</label>
            <AdjuntosGrid urls={[archivo, ...adjuntos].filter(Boolean) as string[]} size="sm"
              onRemove={u => { if (u === archivo) setArchivo(null); else setAdjuntos(a => a.filter(x => x !== u)); }} />
            <div className="mt-2"><DropzoneAdjuntos compacto onAdd={u => { if (!archivo) setArchivo(u); else setAdjuntos(a => [...a, u]); }} /></div>
          </div>
        </div>
        <div className="p-3 border-t border-gray-200 flex flex-wrap gap-2 justify-between shrink-0 bg-gray-50 rounded-b-2xl">
          <button onClick={() => guardar(true)} disabled={guardando} className={btnSecundario} title="El proveedor no contestó">Sin respuesta</button>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={guardando} className={btnSecundario}>Cancelar</button>
            <button onClick={() => guardar(false)} disabled={guardando || tot.total <= 0} className={btnPrimario}>{guardando ? 'Guardando…' : 'Guardar respuesta'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
