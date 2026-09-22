import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Edit, Scale, Zap, XCircle, Check, Calendar, User, Building2, Truck, Ban, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import type { AbrirDetalle } from './Compras';
import {
  ESTADO_SC, ESTADO_ITEM_SC, ORIGEN_LABEL, TIPO_PRODUCTO_LABEL, fmtFecha, fmtCantidad, fmtMoneda, nombreCliente,
  type SolicitudDetalle as SC, type ProveedorMin,
} from './tipos';
import { ModalShell, Cargando, Badge, Seccion, FichaTecnica, AdjuntosGrid, ConfirmacionRoja, SelectorProveedores, inpCls, lblCls, btnPrimario, btnSecundario, btnPeligro } from './ui';
import { FormOrden, type OrdenPayload } from './FormOrden';

type Panel = null | 'cotizar' | 'directa' | 'cancelar';

export function DetalleSolicitud({ id, onClose, onChanged, abrir }: { id: string; onClose: () => void; onChanged: () => void; abrir: AbrirDetalle }) {
  const navigate = useNavigate();
  const [sc, setSc] = useState<SC | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  // Panel cotizar
  const [proveedores, setProveedores] = useState<ProveedorMin[]>([]);
  const [provSel, setProvSel] = useState<string[]>([]);
  const [fechaLimite, setFechaLimite] = useState('');
  const [obsPc, setObsPc] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await api.get<SC>(`/compras/solicitudes/${id}`);
      setSc(d);
      setSel(d.items.filter(i => i.estado === 'pendiente').map(i => i.id));
    } catch { toast.error('Error al cargar la solicitud'); onClose(); }
    finally { setLoading(false); }
  }, [id, onClose]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (panel === 'cotizar' && proveedores.length === 0) {
      api.get<ProveedorMin[]>('/catalogo/proveedores').then(ps => {
        setProveedores(ps);
        if (sc?.proveedor_sugerido_id && ps.some(p => p.id === sc.proveedor_sugerido_id)) setProvSel([sc.proveedor_sugerido_id]);
      }).catch(() => {});
    }
  }, [panel, proveedores.length, sc?.proveedor_sugerido_id]);

  if (loading) return <Cargando />;
  if (!sc) return null;

  const est = ESTADO_SC[sc.estado];
  const activa = sc.estado === 'abierta' || sc.estado === 'en_cotizacion';
  const pendientes = sc.items.filter(i => i.estado === 'pendiente' || i.estado === 'en_cotizacion');
  const seleccionables = sc.items.filter(i => i.estado === 'pendiente' || i.estado === 'en_cotizacion');
  const itemsSel = sc.items.filter(i => sel.includes(i.id));
  const toggle = (iid: string) => setSel(s => s.includes(iid) ? s.filter(x => x !== iid) : [...s, iid]);

  async function pedirCotizacion() {
    if (!sc || !provSel.length || !sel.length) return;
    setEnviando(true);
    try {
      const r = await api.post<{ id: string; numero: string }>('/compras/cotizaciones', {
        solicitud_id: sc.id, item_ids: sel, proveedor_ids: provSel, fecha_limite: fechaLimite || null, observaciones: obsPc.trim() || undefined,
      });
      toast.success(`Cotización ${r.numero} creada`);
      onChanged();
      abrir('pc', r.id);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo crear la cotización' }); }
    finally { setEnviando(false); }
  }

  async function comprarDirecto(p: OrdenPayload) {
    if (!sc) return;
    setEnviando(true);
    try {
      const r = await api.post<{ id: string; numero: string }>('/compras/ordenes/directa', { solicitud_id: sc.id, ...p });
      toast.success(`Orden ${r.numero} creada en borrador`);
      onChanged();
      abrir('oc', r.id);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo crear la orden' }); }
    finally { setEnviando(false); }
  }

  async function cambiarEstado(estado: 'cancelada' | 'cerrada' | 'abierta', motivo?: string) {
    setEnviando(true);
    try {
      await api.patch(`/compras/solicitudes/${id}/estado`, { estado, motivo: motivo || undefined });
      toast.success(estado === 'cancelada' ? 'Solicitud cancelada' : estado === 'cerrada' ? 'Solicitud cerrada' : 'Solicitud reabierta');
      setPanel(null); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cambiar el estado' }); }
    finally { setEnviando(false); }
  }

  const origenNombre = sc.cliente ? nombreCliente(sc.cliente) : (sc.origen === 'reposicion_stock' || sc.origen === 'faltante' ? 'Stock propio' : ORIGEN_LABEL[sc.origen]);

  return (
    <ModalShell
      icon={<ClipboardList size={20} />} iconCls="bg-amber-50 text-amber-700"
      titulo={sc.numero}
      subtitulo={<>{ORIGEN_LABEL[sc.origen]} · {TIPO_PRODUCTO_LABEL[sc.tipo_producto]} · creada el {fmtFecha(sc.created_at)}</>}
      badges={<Badge label={est.label} cls={est.cls} />}
      acciones={sc.estado === 'abierta' && (
        <button onClick={() => navigate(`/compras/solicitudes/${id}/editar`)} className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center" title="Editar">
          <Edit size={16} />
        </button>
      )}
      onClose={onClose}
    >
      {/* Origen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1 flex items-center gap-1"><User size={10} /> Para</p>
          <p className="font-semibold text-gray-900">{origenNombre}</p>
          {sc.obra && <p className="text-sm text-gray-700 flex items-center gap-1"><Building2 size={11} /> {sc.obra}</p>}
          <div className="flex gap-2 mt-1 flex-wrap">
            {sc.operacion && <button onClick={() => navigate(`/operaciones/${sc.operacion!.id}`)} className="text-[11px] font-mono text-blue-700 hover:underline">{sc.operacion.numero.replace(/^OP-/, 'PRO-')}</button>}
            {sc.visita_tecnica && <button onClick={() => navigate(`/presupuestos/visitas-tecnicas/${sc.visita_tecnica!.id}`)} className="text-[11px] font-mono text-blue-700 hover:underline">{sc.visita_tecnica.numero}</button>}
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
          <p className="text-sm text-gray-700 flex items-center gap-1.5"><Calendar size={12} className="text-gray-500" /> Necesaria: <strong>{fmtFecha(sc.fecha_necesaria)}</strong></p>
          <p className="text-sm text-gray-700 flex items-center gap-1.5"><Truck size={12} className="text-gray-500" /> Proveedor sugerido: <strong>{sc.proveedor_sugerido?.nombre ?? '—'}</strong></p>
          {sc.observaciones && <p className="text-xs text-gray-600 whitespace-pre-wrap pt-1 border-t border-gray-200">{sc.observaciones}</p>}
        </div>
      </div>

      {sc.adjuntos?.length > 0 && <Seccion titulo="Adjuntos"><AdjuntosGrid urls={sc.adjuntos} size="sm" /></Seccion>}

      {/* Ítems */}
      <Seccion titulo={`Ítems (${sc.items.length})`}
        accion={activa && seleccionables.length > 1 && !panel && (
          <button onClick={() => setSel(sel.length === seleccionables.length ? [] : seleccionables.map(i => i.id))} className="text-[11px] text-lime-700 font-semibold hover:underline">
            {sel.length === seleccionables.length ? 'Ninguno' : 'Todos'}
          </button>
        )}>
        <div className="space-y-2">
          {sc.items.map(it => {
            const ie = ESTADO_ITEM_SC[it.estado];
            const puede = activa && (it.estado === 'pendiente' || it.estado === 'en_cotizacion') && !panel;
            const marcado = sel.includes(it.id);
            return (
              <div key={it.id} onClick={() => puede && toggle(it.id)}
                className={cn('flex items-start gap-3 p-3 border rounded-xl transition-colors', puede && 'cursor-pointer hover:bg-lime-50/50',
                  marcado && puede ? 'border-lime-400 bg-lime-50/40' : 'border-gray-200', it.estado === 'cancelado' && 'opacity-60')}>
                {activa && (
                  <span className={cn('w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0',
                    marcado && puede ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-300 bg-white', !puede && 'invisible')}>
                    {marcado && <Check size={12} />}
                  </span>
                )}
                {it.producto_imagen_url && <img src={it.producto_imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{it.descripcion}</p>
                    <Badge label={ie.label} cls={ie.cls} />
                  </div>
                  <FichaTecnica e={it.especificaciones} className="mt-0.5" />
                  {it.observaciones && <p className="text-[11px] text-gray-500 italic mt-0.5">{it.observaciones}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap" onClick={e => e.stopPropagation()}>
                    {it.orden_compra && <button onClick={() => abrir('oc', it.orden_compra!.id)} className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100">{it.orden_compra.numero}</button>}
                    {(it.cotizaciones ?? []).filter(pc => pc.estado === 'abierta').map(pc => (
                      <button key={pc.id} onClick={() => abrir('pc', pc.id)} className="text-[10px] font-mono text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5 hover:bg-sky-100">{pc.numero}</button>
                    ))}
                    {it.adjuntos?.length > 0 && <AdjuntosGrid urls={it.adjuntos} size="sm" />}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-800">×{fmtCantidad(it.cantidad, it.unidad)}</p>
                  {it.costo_referencia && <p className="text-[10px] text-gray-500">ref. {fmtMoneda(it.costo_referencia)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Seccion>

      {/* Vinculados */}
      {(sc.cotizaciones.length > 0 || sc.ordenes.length > 0) && (
        <Seccion titulo="Vinculado a">
          <div className="flex flex-wrap gap-2">
            {sc.cotizaciones.map(pc => (
              <button key={pc.id} onClick={() => abrir('pc', pc.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 h-9 hover:bg-sky-100">
                <Scale size={12} /> {pc.numero} <span className="font-normal opacity-70">· {pc.estado.replace('_', ' ')}</span>
              </button>
            ))}
            {sc.ordenes.map(oc => (
              <button key={oc.id} onClick={() => abrir('oc', oc.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 h-9 hover:bg-emerald-100">
                <Truck size={12} /> {oc.numero} <span className="font-normal opacity-70">· {oc.estado_logistica.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        </Seccion>
      )}

      {/* ¿Cómo seguimos? */}
      {activa && !panel && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
            ¿Cómo seguimos? {itemsSel.length > 0 && <span className="normal-case font-normal text-gray-500">({itemsSel.length} ítem{itemsSel.length === 1 ? '' : 's'} seleccionado{itemsSel.length === 1 ? '' : 's'})</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={() => setPanel('cotizar')} disabled={!itemsSel.length}
              className="flex items-start gap-3 p-3 rounded-xl border-2 border-sky-200 bg-sky-50/60 hover:border-sky-400 text-left disabled:opacity-50 min-h-11">
              <Scale size={20} className="text-sky-700 shrink-0 mt-0.5" />
              <div><p className="text-sm font-bold text-sky-900">Pedir cotización</p><p className="text-xs text-sky-800/80">A uno o varios proveedores. Después comparás y elegís.</p></div>
            </button>
            <button onClick={() => setPanel('directa')} disabled={!itemsSel.length}
              className="flex items-start gap-3 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 text-left disabled:opacity-50 min-h-11">
              <Zap size={20} className="text-emerald-700 shrink-0 mt-0.5" />
              <div><p className="text-sm font-bold text-emerald-900">Comprar directo</p><p className="text-xs text-emerald-800/80">Ya sabés a quién: generá la orden de compra ahora.</p></div>
            </button>
          </div>
          <div className="flex gap-2 mt-3 justify-end flex-wrap">
            {pendientes.length === 0 && <button onClick={() => cambiarEstado('cerrada')} className={btnSecundario}><Check size={14} /> Cerrar solicitud</button>}
            <button onClick={() => setPanel('cancelar')} className={btnPeligro}><Ban size={14} /> Cancelar solicitud</button>
          </div>
        </div>
      )}

      {sc.estado === 'cancelada' && (
        <div className="pt-3 border-t border-gray-200 flex justify-end">
          <button onClick={() => cambiarEstado('abierta')} disabled={enviando} className={btnSecundario}><RotateCcw size={14} /> Reabrir</button>
        </div>
      )}

      {panel === 'cotizar' && (
        <div className="pt-3 border-t border-gray-200 space-y-3">
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2"><Scale size={16} className="text-sky-700" /> Pedir cotización de {itemsSel.length} ítem{itemsSel.length === 1 ? '' : 's'}</p>
          <div>
            <label className={lblCls}>Proveedores a invitar</label>
            <SelectorProveedores proveedores={proveedores} seleccionados={provSel} onChange={setProvSel} sugeridoId={sc.proveedor_sugerido_id} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lblCls}>Responder antes del</label><input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} className={inpCls} /></div>
            <div><label className={lblCls}>Observaciones para el proveedor</label><input value={obsPc} onChange={e => setObsPc(e.target.value)} className={inpCls} placeholder="Opcional" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPanel(null)} className={btnSecundario} disabled={enviando}>Volver</button>
            <button onClick={pedirCotizacion} disabled={!provSel.length || enviando} className={btnPrimario}>
              {enviando ? 'Creando…' : `Crear cotización (${provSel.length} prov.)`}
            </button>
          </div>
        </div>
      )}

      {panel === 'directa' && (
        <div className="pt-3 border-t border-gray-200 space-y-3">
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2"><Zap size={16} className="text-emerald-700" /> Comprar directo · {itemsSel.length} ítem{itemsSel.length === 1 ? '' : 's'}</p>
          <FormOrden
            items={itemsSel.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad, costo_referencia: i.costo_referencia, proveedor_sku: i.proveedor_sku, especificaciones: i.especificaciones }))}
            sugeridoId={sc.proveedor_sugerido_id}
            onSubmit={comprarDirecto} onCancel={() => setPanel(null)} enviando={enviando}
          />
        </div>
      )}

      {panel === 'cancelar' && (
        <ConfirmacionRoja titulo="¿Cancelar esta solicitud?" texto="Se cancelan los ítems que no tengan orden de compra y las cotizaciones abiertas."
          conMotivo labelConfirmar="Sí, cancelar" cargando={enviando}
          onConfirmar={m => cambiarEstado('cancelada', m)} onCancelar={() => setPanel(null)} />
      )}
      {!activa && sc.estado !== 'cancelada' && <p className="text-xs text-gray-500 flex items-center gap-1"><XCircle size={12} /> Solicitud {est.label.toLowerCase()}: sin acciones pendientes.</p>}
    </ModalShell>
  );
}
