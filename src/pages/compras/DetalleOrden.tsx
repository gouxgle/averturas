import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck, Edit, FileText, MessageCircle, Mail, Send, Truck, Package, CheckCircle, AlertTriangle, Phone, Users,
  ClipboardList, Scale, X, Eye, Save, Plus, ShieldCheck, Wallet, FolderOpen, Ban, Check, MessageSquarePlus,
  CalendarClock, ChevronRight, History,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import { BadgeProveedor } from '@/components/BadgeProveedor';
import type { AbrirDetalle } from './Compras';
import {
  ESTADO_LOGISTICA, ESTADO_INCIDENCIA, ESTADO_FINANZAS, TIMELINE_LOGISTICA, SIGUIENTE_LOGISTICA, IVA_OPCIONES,
  fmtFecha, fmtCantidad, fmtMoneda, nombreCliente, haceCuanto, abrirPdf, calcularTotalesForm,
  type OrdenDetalle as OC, type MedioEnvio, type EstadoLogistica, type Seguimiento, type Recepcion, type Incidencia,
} from './tipos';
import { ModalShell, Cargando, Badge, Seccion, FichaTecnica, AdjuntosGrid, DropzoneAdjuntos, ConfirmacionRoja, inpCls, lblCls, btnPrimario, btnSecundario, btnPeligro } from './ui';
import { ModalRecepcion, type ResultadoRecepcion } from './ModalRecepcion';
import { PanelEconomico } from './PanelEconomico';

interface LineaEdit { id: string; cantidad: string; precio: string; desc: string; iva: number }

export function DetalleOrden({ id, onClose, onChanged, abrir }: { id: string; onClose: () => void; onChanged: () => void; abrir: AbrirDetalle }) {
  const navigate = useNavigate();
  const [oc, setOc] = useState<OC | null>(null);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [panel, setPanel] = useState<null | 'cancelar' | 'confirmacion' | 'seguimiento'>(null);
  const [recibiendo, setRecibiendo] = useState(false);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [reclamos, setReclamos] = useState<Incidencia[]>([]);
  const [verBitacora, setVerBitacora] = useState(false);
  // confirmación
  const [confPrecio, setConfPrecio] = useState(true);
  const [confCaract, setConfCaract] = useState(true);
  const [confFecha, setConfFecha] = useState('');
  // seguimiento
  const [segRespuesta, setSegRespuesta] = useState('');
  const [segFecha, setSegFecha] = useState('');
  const [segObs, setSegObs] = useState('');
  const [editando, setEditando] = useState(false);
  const [msgPreview, setMsgPreview] = useState<{ medio: MedioEnvio; mensaje: string } | null>(null);
  // edición (borrador)
  const [lineas, setLineas] = useState<LineaEdit[]>([]);
  const [flete, setFlete] = useState('0');
  const [formaPago, setFormaPago] = useState('');
  const [contacto, setContacto] = useState('');
  const [fechaProm, setFechaProm] = useState('');
  const [notas, setNotas] = useState('');
  const [adjuntos, setAdjuntos] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    try {
      const d = await api.get<OC>(`/compras/ordenes/${id}`);
      setOc(d);
      setLineas(d.items.map(i => ({ id: i.id, cantidad: String(Number(i.cantidad)), precio: String(Number(i.precio_unitario_neto)), desc: String(Number(i.descuento_pct)), iva: Number(i.iva_pct) })));
      setFlete(String(Number(d.costo_envio))); setFormaPago(d.forma_pago ?? ''); setContacto(d.contacto_proveedor ?? '');
      setFechaProm(d.fecha_prometida ? d.fecha_prometida.slice(0, 10) : ''); setNotas(d.notas ?? ''); setAdjuntos(d.adjuntos ?? []);
    } catch { toast.error('Error al cargar la orden'); onClose(); }
    finally { setLoading(false); }
  }, [id, onClose]);

  const cargarHistorial = useCallback(async () => {
    const [seg, recs, incs] = await Promise.all([
      api.get<Seguimiento[]>(`/compras/ordenes/${id}/seguimientos`).catch(() => []),
      api.get<Recepcion[]>(`/compras/ordenes/${id}/recepciones`).catch(() => []),
      api.get<Incidencia[]>(`/compras/incidencias?estado=todas&pedido_id=${id}`).catch(() => []),
    ]);
    setSeguimientos(seg); setRecepciones(recs); setReclamos(incs);
  }, [id]);

  useEffect(() => { cargar(); cargarHistorial(); }, [cargar, cargarHistorial]);

  const totEdit = useMemo(() => calcularTotalesForm(lineas.map(l => ({
    cantidad: parseFloat(l.cantidad) || 0, precio: parseFloat(l.precio) || 0, desc: parseFloat(l.desc) || 0, iva: l.iva,
  })), parseFloat(flete) || 0), [lineas, flete]);

  if (loading) return <Cargando />;
  if (!oc) return null;

  const est = ESTADO_LOGISTICA[oc.estado_logistica];
  const borrador = oc.estado_logistica === 'borrador';
  const legacyPed = oc.numero.startsWith('PED-');
  const enCurso = !['borrador', 'recibida', 'cerrada', 'cancelada'].includes(oc.estado_logistica);
  // Sigue esperando mercadería: incluye la parcial (falta una entrega o una reposición)
  const esperandoMercaderia = enCurso;
  const siguiente = SIGUIENTE_LOGISTICA[oc.estado_logistica];
  const reclamosAbiertos = reclamos.filter(r => r.estado !== 'resuelta' && r.estado !== 'rechazada');
  const terminal = ['recibida', 'cerrada', 'cancelada'].includes(oc.estado_logistica);
  const faltantes = oc.operacion_id && oc.items_total_op !== null && oc.items_cubiertos !== null ? oc.items_total_op - oc.items_cubiertos : 0;
  const clientes = [...new Map(oc.origenes.filter(o => o.cliente).map(o => [o.cliente!.id, o])).values()];

  async function previsualizar(medio: MedioEnvio) {
    try {
      const r = await api.get<{ mensaje: string }>(`/compras/ordenes/${id}/mensaje`);
      setMsgPreview({ medio, mensaje: r.mensaje });
    } catch (e) { toastApiError(e, { fallback: 'No se pudo armar el mensaje' }); }
  }

  async function enviar(medio: MedioEnvio, mensaje?: string) {
    setOcupado(true);
    try {
      await api.post(`/compras/ordenes/${id}/enviar`, { medio, mensaje, contacto: contacto.trim() || undefined });
      toast.success(medio === 'manual' ? 'Orden marcada como enviada' : `Orden enviada por ${medio === 'whatsapp' ? 'WhatsApp' : 'email'}`);
      setMsgPreview(null); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo enviar la orden' }); }
    finally { setOcupado(false); }
  }

  async function guardarEdicion() {
    setOcupado(true);
    try {
      await api.put(`/compras/ordenes/${id}`, {
        costo_envio: parseFloat(flete) || 0, forma_pago: formaPago.trim() || undefined, contacto_proveedor: contacto.trim() || undefined,
        fecha_prometida: fechaProm || null, notas: notas.trim() || undefined, adjuntos,
        items: lineas.map(l => ({ id: l.id, cantidad: parseFloat(l.cantidad) || undefined, precio_unitario_neto: parseFloat(l.precio) || 0, descuento_pct: parseFloat(l.desc) || 0, iva_pct: l.iva })),
      });
      toast.success('Orden actualizada');
      setEditando(false); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
    finally { setOcupado(false); }
  }

  async function cambiarEstadoLegacy(estado: 'enviado' | 'recibido' | 'cancelado', extra?: Record<string, unknown>) {
    setOcupado(true);
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado, ...extra });
      toast.success(estado === 'recibido' ? 'Recepción registrada — el stock ingresó' : estado === 'cancelado' ? 'Orden cancelada' : 'Orden marcada como enviada');
      setPanel(null); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cambiar el estado' }); }
    finally { setOcupado(false); }
  }

  async function cambiarLogistica(estado: EstadoLogistica, observaciones?: string) {
    setOcupado(true);
    try {
      await api.patch(`/compras/ordenes/${id}/estado-logistica`, { estado_logistica: estado, observaciones });
      toast.success(`Orden: ${ESTADO_LOGISTICA[estado].label.toLowerCase()}`);
      onChanged(); await Promise.all([cargar(), cargarHistorial()]);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cambiar el estado' }); }
    finally { setOcupado(false); }
  }

  async function registrarConfirmacion() {
    setOcupado(true);
    try {
      await api.post(`/compras/ordenes/${id}/confirmacion`, {
        confirmacion_recepcion: true, confirmacion_precio: confPrecio, confirmacion_caracteristicas: confCaract,
        fecha_prometida: confFecha || null, contacto: contacto.trim() || undefined,
      });
      toast.success('Confirmación registrada');
      setPanel(null); onChanged(); await Promise.all([cargar(), cargarHistorial()]);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo registrar la confirmación' }); }
    finally { setOcupado(false); }
  }

  async function registrarSeguimientoUI() {
    setOcupado(true);
    try {
      await api.post(`/compras/ordenes/${id}/seguimientos`, {
        respuesta_proveedor: segRespuesta.trim() || undefined,
        nueva_fecha_prometida: segFecha || null,
        observaciones: segObs.trim() || undefined,
      });
      toast.success('Contacto registrado');
      setSegRespuesta(''); setSegFecha(''); setSegObs('');
      setPanel(null); setVerBitacora(true); onChanged(); await Promise.all([cargar(), cargarHistorial()]);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo registrar el contacto' }); }
    finally { setOcupado(false); }
  }

  /** Al cerrar la recepción: si quedaron ítems con problema, se abre el primer reclamo. */
  async function alRecibir(r: ResultadoRecepcion) {
    setRecibiendo(false);
    onChanged();
    await Promise.all([cargar(), cargarHistorial()]);
    if (r.incidencias.length > 0) abrir('rec', r.incidencias[0].id);
  }

  const franja = (icon: React.ReactNode, titulo: string, valor: string, cls: string) => (
    <div className={cn('rounded-xl border p-2.5 flex items-center gap-2 min-w-0', cls)}>
      <span className="shrink-0 opacity-80">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider font-semibold opacity-70">{titulo}</p>
        <p className="text-xs font-bold truncate">{valor}</p>
      </div>
    </div>
  );

  return (
    <ModalShell
      icon={<PackageCheck size={20} />} iconCls="bg-lime-50 text-lime-700"
      titulo={oc.numero}
      subtitulo={<>Pedida el {fmtFecha(oc.fecha_pedido)}{oc.enviada_at ? ` · enviada ${haceCuanto(oc.enviada_at)}${oc.enviada_medio && oc.enviada_medio !== 'manual' ? ` por ${oc.enviada_medio}` : ''}` : ''}</>}
      badges={<>
        <Badge label={est.label} cls={est.cls} />
        {oc.demorada && <Badge label={`Demorada ${oc.dias_demora}d`} cls="bg-red-600 text-white" />}
        {oc.es_consolidada && <Badge label="Consolidada" cls="bg-violet-100 text-violet-800" />}
        {oc.es_stock_propio && <Badge label="Stock propio" cls="bg-sky-100 text-sky-800" />}
        {oc.cerrada_totalmente_at && <Badge label="Cerrada totalmente" cls="bg-emerald-600 text-white" />}
      </>}
      acciones={<>
        <button onClick={() => abrirPdf(`/compras/ordenes/${id}/pdf`).catch(e => toast.error(e.message))} className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center" title="Ver PDF">
          <FileText size={16} />
        </button>
        {borrador && !editando && (
          <button onClick={() => legacyPed ? navigate(`/compras/oc/${id}/editar`) : setEditando(true)} className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center" title="Editar">
            <Edit size={16} />
          </button>
        )}
      </>}
      onClose={onClose}
      ancho="sm:max-w-4xl"
    >
      {/* Cuatro franjas de estado (en la etapa 1 solo Logística cambia) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {franja(<Truck size={14} />, 'Logística', est.label, oc.demorada ? 'bg-red-50 border-red-200 text-red-800' : est.cls)}
        {franja(<ShieldCheck size={14} />, 'Calidad',
          reclamos.length === 0 ? 'Sin reclamos' : reclamosAbiertos.length > 0 ? `${reclamosAbiertos.length} abierto${reclamosAbiertos.length === 1 ? '' : 's'}` : 'Resueltos',
          reclamos.length === 0 ? 'bg-gray-50 border-gray-200 text-gray-500'
            : reclamosAbiertos.length > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800')}
        {franja(<Wallet size={14} />, 'Finanzas', ESTADO_FINANZAS[oc.estado_finanzas].label, ESTADO_FINANZAS[oc.estado_finanzas].cls)}
        {franja(<FolderOpen size={14} />, 'Documentación',
          oc.estado_docs === 'completa' ? 'Completa' : 'Incompleta',
          oc.estado_docs === 'completa' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-500')}
      </div>

      {/* Proveedor + destino */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Proveedor</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{oc.proveedor.nombre}</p>
            <BadgeProveedor proveedor={oc.proveedor} />
          </div>
          {(oc.contacto_proveedor || oc.proveedor.contacto) && <p className="text-sm text-gray-700">At.: {oc.contacto_proveedor || oc.proveedor.contacto}</p>}
          {oc.proveedor.telefono && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone size={11} /> {oc.proveedor.telefono}</p>}
          {oc.proveedor.email && <p className="text-sm text-gray-600 flex items-center gap-1"><Mail size={11} /> {oc.proveedor.email}</p>}
          {!terminal && !editando && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {oc.proveedor.telefono && (
                <button disabled={ocupado} onClick={() => previsualizar('whatsapp')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg px-2.5 h-9 disabled:opacity-50">
                  <MessageCircle size={12} /> {oc.enviada_at ? 'Reenviar WhatsApp' : 'Enviar por WhatsApp'}
                </button>
              )}
              {oc.proveedor.email && (
                <button disabled={ocupado} onClick={() => previsualizar('email')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg px-2.5 h-9 disabled:opacity-50">
                  <Mail size={12} /> Email
                </button>
              )}
              {borrador && (
                <button disabled={ocupado} onClick={() => enviar('manual')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 h-9 hover:bg-gray-50 disabled:opacity-50" title="Ya se la pasé por otro medio">
                  <Send size={12} /> Marcar enviada
                </button>
              )}
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 space-y-1">
          <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Destino</p>
          {oc.es_stock_propio ? (
            <p className="text-sm text-sky-900 flex items-center gap-1.5"><Package size={14} className="text-sky-600" /> Stock propio — sin cliente</p>
          ) : oc.es_consolidada ? (
            <div className="space-y-1">
              <p className="text-sm text-violet-900 flex items-center gap-1.5"><Users size={14} className="text-violet-600" /> {clientes.length} cliente{clientes.length === 1 ? '' : 's'} en una sola orden</p>
              <div className="flex flex-wrap gap-1">
                {clientes.map(o => <span key={o.solicitud_id} className="text-[10px] font-semibold text-violet-800 bg-violet-100 rounded-full px-2 py-0.5">{nombreCliente(o.cliente)}{o.obra ? ` · ${o.obra}` : ''}</span>)}
              </div>
            </div>
          ) : oc.operacion ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{nombreCliente(oc.operacion.cliente)}</p>
              <button onClick={() => navigate(`/operaciones/${oc.operacion!.id}`)} className="text-[11px] font-mono text-blue-700 hover:underline">{oc.operacion.numero.replace(/^OP-/, 'PRO-')}</button>
            </>
          ) : <p className="text-sm text-gray-600">{oc.solicitud?.obra ?? '—'}</p>}
          <div className="grid grid-cols-3 gap-2 pt-2 mt-1 border-t border-gray-200">
            <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Pedida</p><p className="text-xs font-semibold text-gray-800">{fmtFecha(oc.fecha_pedido)}</p></div>
            <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Prometida</p>
              {editando ? <input type="date" value={fechaProm} onChange={e => setFechaProm(e.target.value)} className={cn(inpCls, 'h-8 py-0 text-xs')} />
                : <p className={cn('text-xs font-semibold', oc.demorada ? 'text-red-700' : 'text-gray-800')}>{fmtFecha(oc.fecha_prometida ?? oc.fecha_entrega_est)}</p>}
            </div>
            <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Recibida</p><p className="text-xs font-semibold text-gray-800">{fmtFecha(oc.fecha_recepcion)}</p></div>
          </div>
        </div>
      </div>

      {/* Ítems */}
      <Seccion titulo={`Ítems (${oc.items.length})`}>
        <div className="space-y-2">
          {oc.items.map(it => {
            const l = lineas.find(x => x.id === it.id)!;
            const up = (patch: Partial<LineaEdit>) => setLineas(ls => ls.map(x => x.id === it.id ? { ...x, ...patch } : x));
            return (
              <div key={it.id} className={cn('p-3 border border-gray-200 rounded-xl', it.es_reposicion && 'border-dashed')}>
                {/* Mobile: precio debajo del texto; desktop: columna derecha */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  {it.producto_imagen_url && <img src={it.producto_imagen_url} alt="" className="hidden sm:block w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{it.descripcion}</p>
                      {it.es_reposicion && <Badge label="Reposición" cls="bg-sky-100 text-sky-800" />}
                    </div>
                    <FichaTecnica e={it.especificaciones} className="mt-0.5" />
                    {(oc.es_consolidada || (it.cliente && !oc.operacion)) && it.cliente && (
                      <p className="text-[11px] text-violet-700 mt-0.5">{nombreCliente(it.cliente)}{it.obra ? ` · ${it.obra}` : ''}{it.operacion_numero ? ` · ${it.operacion_numero.replace(/^OP-/, 'PRO-')}` : ''} · {it.solicitud_numero}</p>
                    )}
                    {it.proveedor_sku && <p className="text-[10px] text-gray-500">Cód. proveedor: {it.proveedor_sku}</p>}
                  </div>
                  {!editando && (
                    <div className="flex flex-wrap items-baseline gap-x-3 sm:block sm:text-right shrink-0 border-t sm:border-0 border-gray-100 pt-1.5 sm:pt-0">
                      <p className="text-sm font-bold text-gray-800">×{fmtCantidad(it.cantidad, it.unidad)}</p>
                      {Number(it.precio_unitario_neto) > 0 && (
                        <>
                          <p className="text-[11px] text-gray-600 tabular-nums">{fmtMoneda(it.precio_unitario_neto)} c/u{Number(it.descuento_pct) > 0 ? ` −${Number(it.descuento_pct)}%` : ''} · IVA {Number(it.iva_pct)}%</p>
                          <p className="text-xs font-semibold text-gray-800 tabular-nums">{fmtMoneda(it.neto_linea)}</p>
                          {it.flete_prorrateado > 0 && <p className="text-[10px] text-amber-600">flete {fmtMoneda(it.flete_prorrateado)}</p>}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editando && l && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <div><label className={lblCls}>Cantidad</label><input type="number" step="0.01" min="0.01" value={l.cantidad} onChange={e => up({ cantidad: e.target.value })} className={inpCls} /></div>
                    <div><label className={lblCls}>P. unit. neto</label><MontoInput value={l.precio} onChange={v => up({ precio: v })} className={inpCls} /></div>
                    <div><label className={lblCls}>Desc. %</label><input type="number" step="0.5" min="0" max="100" value={l.desc} onChange={e => up({ desc: e.target.value })} className={inpCls} /></div>
                    <div><label className={lblCls}>IVA</label>
                      <select value={l.iva} onChange={e => up({ iva: Number(e.target.value) })} className={inpCls}>{IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}</select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Totales */}
        <div className="mt-3 pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-between gap-3">
          <div className="space-y-2 flex-1">
            {editando && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className={lblCls}>Flete</label><MontoInput value={flete} onChange={setFlete} className={inpCls} /></div>
                <div><label className={lblCls}>Forma de pago</label><input value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inpCls} /></div>
                <div><label className={lblCls}>Contacto en el proveedor</label><input value={contacto} onChange={e => setContacto(e.target.value)} className={inpCls} /></div>
                <div><label className={lblCls}>Observaciones</label><input value={notas} onChange={e => setNotas(e.target.value)} className={inpCls} /></div>
              </div>
            )}
            {!editando && oc.forma_pago && <p className="text-sm text-gray-700">Forma de pago: <strong>{oc.forma_pago}</strong></p>}
            {!editando && oc.notas && <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-900 whitespace-pre-wrap">{oc.notas}</div>}
          </div>
          <div className="text-sm text-gray-700 space-y-0.5 sm:min-w-[240px]">
            {(() => {
              const t = editando ? totEdit : { neto: Number(oc.subtotal_neto), desc: Number(oc.descuento_monto), iva: Number(oc.iva_monto), flete: Number(oc.costo_envio), total: Number(oc.total) };
              return <>
                <div className="flex justify-between gap-6"><span>Subtotal neto</span><span className="tabular-nums">{fmtMoneda(t.neto)}</span></div>
                {t.desc > 0 && <div className="flex justify-between gap-6 text-amber-700"><span>Descuento</span><span className="tabular-nums">− {fmtMoneda(t.desc)}</span></div>}
                {t.iva > 0 && <div className="flex justify-between gap-6"><span>IVA</span><span className="tabular-nums">{fmtMoneda(t.iva)}</span></div>}
                {t.flete > 0 && <div className="flex justify-between gap-6 text-amber-700"><span>{oc.transportista_nombre ? `Flete · ${oc.transportista_nombre}` : 'Flete'}</span><span className="tabular-nums">{fmtMoneda(t.flete)}</span></div>}
                <div className="flex justify-between gap-6 font-bold text-gray-900 text-base border-t border-gray-200 pt-1"><span>Total</span><span className="tabular-nums">{fmtMoneda(t.total)}</span></div>
              </>;
            })()}
          </div>
        </div>
      </Seccion>

      {/* Vinculado a + adjuntos */}
      {(oc.solicitud || oc.cotizacion || oc.origenes.length > 0) && (
        <Seccion titulo="Vinculado a">
          <div className="flex flex-wrap gap-2">
            {(oc.solicitud ? [oc.solicitud] : [...new Map(oc.origenes.map(o => [o.solicitud_id, { id: o.solicitud_id, numero: o.solicitud_numero }])).values()]).map(s => (
              <button key={s.id} onClick={() => abrir('sc', s.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 h-9 hover:bg-amber-100"><ClipboardList size={12} /> {s.numero}</button>
            ))}
            {oc.cotizacion && <button onClick={() => abrir('pc', oc.cotizacion!.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 h-9 hover:bg-sky-100"><Scale size={12} /> {oc.cotizacion.numero}</button>}
          </div>
        </Seccion>
      )}
      {(adjuntos.length > 0 || editando) && (
        <Seccion titulo="Adjuntos">
          <AdjuntosGrid urls={adjuntos} size="sm" onRemove={editando ? u => setAdjuntos(a => a.filter(x => x !== u)) : undefined} />
          {editando && <div className="mt-2"><DropzoneAdjuntos compacto onAdd={u => setAdjuntos(a => [...a, u])} /></div>}
        </Seccion>
      )}

      {/* Línea de tiempo de la logística */}
      {!borrador && oc.estado_logistica !== 'cancelada' && (
        <Seccion titulo="Cómo viene">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {TIMELINE_LOGISTICA.map((et, i) => {
              const idxActual = TIMELINE_LOGISTICA.indexOf(oc.estado_logistica);
              // Los estados fuera de la línea (demorado, parcial, en_preparacion…) se ubican
              // por el hito más cercano ya alcanzado.
              const idxEfectivo = idxActual >= 0 ? idxActual
                : oc.estado_logistica === 'recibida_parcial' ? TIMELINE_LOGISTICA.indexOf('en_transito')
                : oc.estado_logistica === 'terminado' ? TIMELINE_LOGISTICA.indexOf('en_fabricacion')
                : oc.estado_logistica === 'en_preparacion' ? TIMELINE_LOGISTICA.indexOf('confirmada')
                : oc.estado_logistica === 'demorado' ? TIMELINE_LOGISTICA.indexOf('confirmada')
                : oc.estado_logistica === 'cerrada' ? TIMELINE_LOGISTICA.length - 1 : 0;
              const hecho = i <= idxEfectivo;
              const actual = i === idxEfectivo;
              return (
                <div key={et} className="flex items-center gap-1 shrink-0">
                  <div className={cn('flex items-center gap-1.5 px-2.5 h-8 rounded-full border text-[11px] font-semibold whitespace-nowrap',
                    actual ? (oc.demorada ? 'bg-red-600 text-white border-red-600' : 'bg-lime-600 text-white border-lime-600')
                      : hecho ? 'bg-lime-50 text-lime-800 border-lime-200' : 'bg-white text-gray-400 border-gray-200')}>
                    {hecho && !actual && <Check size={11} />}
                    {ESTADO_LOGISTICA[et].label}
                  </div>
                  {i < TIMELINE_LOGISTICA.length - 1 && <span className={cn('w-3 h-px', hecho ? 'bg-lime-300' : 'bg-gray-200')} />}
                </div>
              );
            })}
          </div>
          {!TIMELINE_LOGISTICA.includes(oc.estado_logistica) && (
            <p className="text-[11px] text-gray-600 mt-1.5">Estado actual: <strong>{ESTADO_LOGISTICA[oc.estado_logistica].label}</strong>.</p>
          )}
        </Seccion>
      )}

      {/* Entregas recibidas */}
      {recepciones.length > 0 && (
        <Seccion titulo={`Entregas (${recepciones.length})`}>
          <div className="space-y-2">
            {recepciones.map(r => {
              const conProblema = r.items.filter(i => Number(i.cantidad_problema) > 0);
              return (
                <div key={r.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-bold text-gray-900">Entrega {r.numero_secuencia}</span>
                    <span className="text-[11px] text-gray-600">{fmtFecha(r.fecha)}</span>
                    {r.remito_proveedor_nro && <span className="text-[11px] text-gray-600">· remito {r.remito_proveedor_nro}</span>}
                    {r.transportista_nombre && <span className="text-[11px] text-gray-600">· {r.transportista_nombre}</span>}
                    {conProblema.length > 0 && <Badge label={`${conProblema.length} con problema`} cls="bg-amber-100 text-amber-800" />}
                  </div>
                  <div className="space-y-1">
                    {r.items.map(i => {
                      const prob = Number(i.cantidad_problema);
                      return (
                        <div key={i.id} className="flex items-center gap-2 text-[11px]">
                          {i.no_recibido ? <X size={11} className="text-gray-500 shrink-0" />
                            : prob > 0 ? <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                            : <Check size={11} className="text-emerald-600 shrink-0" />}
                          <span className="flex-1 min-w-0 truncate text-gray-800">{i.descripcion}</span>
                          <span className="text-gray-600 shrink-0 tabular-nums">
                            {i.no_recibido ? 'no vino' : <>{fmtCantidad(i.cantidad_conforme, i.unidad)} conforme{prob > 0 ? ` · ${fmtCantidad(prob, i.unidad)} con problema` : ''}</>}
                          </span>
                          {i.incidencia && (
                            <button onClick={() => abrir('rec', i.incidencia!.id)} className="text-[10px] font-mono text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 hover:bg-red-100 shrink-0">{i.incidencia.numero}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {r.notas && <p className="text-[11px] text-gray-600 italic mt-1">{r.notas}</p>}
                  {r.adjuntos?.length > 0 && <div className="mt-1.5"><AdjuntosGrid urls={r.adjuntos} size="sm" /></div>}
                </div>
              );
            })}
          </div>
        </Seccion>
      )}

      {/* Reclamos */}
      {reclamos.length > 0 && (
        <Seccion titulo={`Reclamos (${reclamos.length})`}>
          <div className="space-y-1.5">
            {reclamos.map(r => {
              const est = ESTADO_INCIDENCIA[r.estado];
              return (
                <button key={r.id} onClick={() => abrir('rec', r.id)}
                  className={cn('w-full flex items-center gap-2 p-2.5 rounded-xl border border-l-4 text-left hover:bg-gray-50 min-h-11', est.border, 'border-gray-200')}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-gray-700">{r.numero}</span>
                      <Badge label={est.label} cls={est.cls} />
                      <span className="text-xs font-semibold text-gray-900 truncate">{r.item_descripcion}</span>
                    </div>
                    <p className="text-[11px] text-gray-600">{fmtCantidad(r.cantidad_afectada, r.item_unidad)} afectada · {r.descripcion || 'sin detalle'}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </Seccion>
      )}

      {/* Bitácora */}
      {seguimientos.length > 0 && (
        <div>
          <button onClick={() => setVerBitacora(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-900 min-h-11 sm:min-h-0">
            <History size={13} /> Seguimiento ({seguimientos.length}) {verBitacora ? '▾' : '▸'}
          </button>
          {verBitacora && (
            <div className="mt-2 space-y-1.5 border-l-2 border-gray-200 pl-3">
              {seguimientos.map(sg => (
                <div key={sg.id} className="text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{fmtFecha(sg.fecha)}</span>
                    {sg.estado_logistica_nuevo && <Badge label={ESTADO_LOGISTICA[sg.estado_logistica_nuevo].label} cls="bg-gray-100 text-gray-700" />}
                    {sg.usuario_nombre && <span className="text-[10px] text-gray-500">{sg.usuario_nombre}</span>}
                  </div>
                  {sg.respuesta_proveedor && <p className="text-gray-700 italic">"{sg.respuesta_proveedor}"</p>}
                  {sg.observaciones && <p className="text-gray-600">{sg.observaciones}</p>}
                  {sg.nueva_fecha_prometida && <p className="text-sky-700">Nueva fecha: {fmtFecha(sg.nueva_fecha_prometida)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plata y papeles (etapa 3) — solo cuando la orden ya salió del borrador */}
      {!borrador && <PanelEconomico oc={oc} onChanged={() => { onChanged(); cargar(); }} />}

      {faltantes > 0 && oc.estado_logistica !== 'cancelada' && (
        <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 flex items-start gap-3">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">{faltantes} ítem{faltantes > 1 ? 's' : ''} de la operación sin comprar</p>
            <p className="text-xs text-orange-700">Podés completarlos con otra solicitud, al mismo proveedor u otro.</p>
            <button onClick={() => navigate(`/compras/nueva-solicitud?operacion_id=${oc.operacion_id}`)} className="mt-2 inline-flex items-center gap-1.5 bg-orange-500 text-white text-xs font-semibold px-3 h-9 rounded-lg hover:bg-orange-600"><Plus size={12} /> Completar faltantes</button>
          </div>
        </div>
      )}

      {/* Acciones */}
      {editando ? (
        <div className="flex gap-2 justify-end pt-3 border-t border-gray-200">
          <button onClick={() => { setEditando(false); cargar(); }} className={btnSecundario} disabled={ocupado}>Cancelar</button>
          <button onClick={guardarEdicion} className={btnPrimario} disabled={ocupado}><Save size={14} /> {ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      ) : panel === null && (
        <>
          {borrador && (
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 flex-1 self-center">La orden está en borrador: revisala y envíasela al proveedor (WhatsApp / email / marcar enviada).</p>
              <button onClick={() => setPanel('cancelar')} disabled={ocupado} className={btnPeligro}><Ban size={14} /> Cancelar orden</button>
            </div>
          )}
          {esperandoMercaderia && (
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setRecibiendo(true)} disabled={ocupado} className={cn(btnPrimario, 'flex-1 bg-emerald-600 hover:bg-emerald-700')}>
                  <PackageCheck size={15} /> {recepciones.length > 0 ? 'Registrar otra entrega' : 'Registrar recepción'}
                </button>
                {oc.estado_logistica === 'enviada' && (
                  <button onClick={() => { setConfFecha(oc.fecha_prometida ? oc.fecha_prometida.slice(0, 10) : ''); setPanel('confirmacion'); }} disabled={ocupado} className={btnSecundario}>
                    <Check size={14} /> Registrar confirmación
                  </button>
                )}
                {siguiente && (
                  <button onClick={() => cambiarLogistica(siguiente.estado)} disabled={ocupado} className={btnSecundario}>
                    <ChevronRight size={14} /> {siguiente.label}
                  </button>
                )}
                <button onClick={() => setPanel('seguimiento')} disabled={ocupado} className={btnSecundario}>
                  <MessageSquarePlus size={14} /> Registrar contacto
                </button>
                <button onClick={() => setPanel('cancelar')} disabled={ocupado} className={btnPeligro}>Cancelar</button>
              </div>
              {oc.demorada && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2">
                  <CalendarClock size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800">Demorada {oc.dias_demora} día{oc.dias_demora === 1 ? '' : 's'}</p>
                    <p className="text-xs text-red-700">La fecha prometida era el {fmtFecha(oc.fecha_prometida ?? oc.fecha_entrega_est)}. Llamá al proveedor y registrá qué te dijo con "Registrar contacto".</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {oc.estado_logistica === 'recibida' && oc.operacion && (
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl">
                <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div><p className="text-sm font-semibold text-emerald-800">Mercadería recibida</p><p className="text-xs text-emerald-700">Generá el remito de entrega para el cliente.</p></div>
              </div>
              <button onClick={() => navigate(`/remitos/nuevo?operacion_id=${oc.operacion!.id}&cliente_id=${oc.operacion!.cliente?.id ?? ''}`)} className={cn(btnPrimario, 'w-full bg-teal-600 hover:bg-teal-700')}><Truck size={15} /> Generar remito de entrega</button>
            </div>
          )}
        </>
      )}

      {panel === 'cancelar' && (
        <ConfirmacionRoja titulo="¿Cancelar esta orden de compra?"
          texto={recepciones.length > 0
            ? 'Esta orden ya recibió mercadería: el stock que había ingresado se devuelve automáticamente.'
            : 'Los ítems de la solicitud quedan liberados para volver a comprarse.'}
          labelConfirmar="Sí, cancelar" cargando={ocupado} onConfirmar={() => cambiarEstadoLegacy('cancelado')} onCancelar={() => setPanel(null)} />
      )}

      {panel === 'confirmacion' && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
          <p className="text-sm font-bold text-sky-900">El proveedor confirmó la orden</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-sky-900 min-h-11 sm:min-h-0">
              <input type="checkbox" checked={confPrecio} onChange={e => setConfPrecio(e.target.checked)} className="w-4 h-4 accent-sky-600" />
              Confirmó el precio
            </label>
            <label className="flex items-center gap-2 text-sm text-sky-900 min-h-11 sm:min-h-0">
              <input type="checkbox" checked={confCaract} onChange={e => setConfCaract(e.target.checked)} className="w-4 h-4 accent-sky-600" />
              Confirmó medidas y características
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lblCls}>Fecha de entrega prometida</label><input type="date" value={confFecha} onChange={e => setConfFecha(e.target.value)} className={inpCls} /></div>
            <div><label className={lblCls}>Contacto</label><input value={contacto} onChange={e => setContacto(e.target.value)} className={inpCls} placeholder="Con quién hablaste" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={registrarConfirmacion} disabled={ocupado} className={cn(btnPrimario, 'flex-1 bg-sky-600 hover:bg-sky-700')}>{ocupado ? 'Guardando…' : 'Guardar confirmación'}</button>
            <button onClick={() => setPanel(null)} disabled={ocupado} className={btnSecundario}>Volver</button>
          </div>
        </div>
      )}

      {panel === 'seguimiento' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <p className="text-sm font-bold text-amber-900">¿Qué te dijo el proveedor?</p>
          <div><label className={lblCls}>Respuesta</label>
            <textarea value={segRespuesta} onChange={e => setSegRespuesta(e.target.value)} rows={2} className={inpCls} placeholder="Ej: sale el jueves, está en pintura" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lblCls}>Nueva fecha prometida</label><input type="date" value={segFecha} onChange={e => setSegFecha(e.target.value)} className={inpCls} /></div>
            <div><label className={lblCls}>Observaciones internas</label><input value={segObs} onChange={e => setSegObs(e.target.value)} className={inpCls} /></div>
          </div>
          {segFecha && <p className="text-[11px] text-amber-800">Con la fecha nueva la orden deja de figurar como demorada.</p>}
          <div className="flex gap-2">
            <button onClick={registrarSeguimientoUI} disabled={ocupado || (!segRespuesta.trim() && !segObs.trim() && !segFecha)} className={cn(btnPrimario, 'flex-1 bg-amber-600 hover:bg-amber-700')}>
              {ocupado ? 'Guardando…' : 'Guardar contacto'}
            </button>
            <button onClick={() => setPanel(null)} disabled={ocupado} className={btnSecundario}>Volver</button>
          </div>
        </div>
      )}

      {recibiendo && (
        <ModalRecepcion orden={oc} onClose={() => setRecibiendo(false)} onHecho={alRecibir} />
      )}

      {msgPreview && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setMsgPreview(null); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <p className="font-bold text-gray-900 flex items-center gap-2"><Eye size={16} /> Mensaje para {oc.proveedor.nombre}</p>
              <button onClick={() => setMsgPreview(null)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-600">Se envía con el PDF de la orden adjunto por {msgPreview.medio === 'whatsapp' ? `WhatsApp al ${oc.proveedor.telefono}` : `email a ${oc.proveedor.email}`}. {borrador && 'La orden pasa a "Enviada".'}</p>
              <textarea value={msgPreview.mensaje} onChange={e => setMsgPreview({ ...msgPreview, mensaje: e.target.value })} rows={9} className={inpCls} />
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
              <button onClick={() => setMsgPreview(null)} className={btnSecundario}>Cancelar</button>
              <button onClick={() => enviar(msgPreview.medio, msgPreview.mensaje)} disabled={ocupado} className={btnPrimario}><Send size={14} /> {ocupado ? 'Enviando…' : 'Enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
