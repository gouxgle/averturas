import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, MessageCircle, Mail, Send, Check, X, Eye, PackageCheck, Truck, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import { BadgeProveedor } from '@/components/BadgeProveedor';
import type { AbrirDetalle } from './Compras';
import {
  ESTADO_INCIDENCIA, TIPO_INCIDENCIA_LABEL, SOLUCION_LABEL, fmtCantidad, fmtFecha, fmtMoneda, haceCuanto, nombreCliente,
  type Incidencia, type MedioEnvio, type SolucionIncidencia, type TipoIncidencia,
} from './tipos';
import { ModalShell, Cargando, Badge, Seccion, FichaTecnica, AdjuntosGrid, DropzoneAdjuntos, inpCls, lblCls, btnPrimario, btnSecundario } from './ui';

export function DetalleIncidencia({ id, onClose, onChanged, abrir }: {
  id: string; onClose: () => void; onChanged: () => void; abrir: AbrirDetalle;
}) {
  const [inc, setInc] = useState<Incidencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [panel, setPanel] = useState<null | 'respuesta'>(null);
  const [msgPreview, setMsgPreview] = useState<{ medio: MedioEnvio; mensaje: string } | null>(null);
  // edición
  const [tipo, setTipo] = useState<TipoIncidencia>('otro');
  const [cantidad, setCantidad] = useState('1');
  const [descripcion, setDescripcion] = useState('');
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  // respuesta
  const [respuesta, setRespuesta] = useState('');
  const [solucion, setSolucion] = useState<SolucionIncidencia | ''>('');
  const [solucionDetalle, setSolucionDetalle] = useState('');
  const [monto, setMonto] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await api.get<Incidencia>(`/compras/incidencias/${id}`);
      setInc(d);
      setTipo(d.tipo); setCantidad(String(Number(d.cantidad_afectada)));
      setDescripcion(d.descripcion ?? ''); setAdjuntos(d.adjuntos ?? []);
      setRespuesta(d.respuesta_proveedor ?? ''); setSolucion(d.solucion ?? '');
      setSolucionDetalle(d.solucion_detalle ?? ''); setMonto(d.monto_descuento ? String(Number(d.monto_descuento)) : '');
    } catch { toast.error('Error al cargar el reclamo'); onClose(); }
    finally { setLoading(false); }
  }, [id, onClose]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <Cargando />;
  if (!inc) return null;

  const est = ESTADO_INCIDENCIA[inc.estado];
  const cerrada = inc.estado === 'resuelta' || inc.estado === 'rechazada';

  async function previsualizar(medio: MedioEnvio) {
    try {
      const r = await api.get<{ mensaje: string }>(`/compras/incidencias/${id}/mensaje`);
      setMsgPreview({ medio, mensaje: r.mensaje });
    } catch (e) { toastApiError(e, { fallback: 'No se pudo armar el mensaje' }); }
  }

  async function reclamar(medio: MedioEnvio, mensaje?: string) {
    setOcupado(true);
    try {
      await api.post(`/compras/incidencias/${id}/reclamar`, { medio, mensaje });
      toast.success(medio === 'manual' ? 'Marcado como reclamado' : `Reclamo enviado por ${medio === 'whatsapp' ? 'WhatsApp' : 'email'}`);
      setMsgPreview(null); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo enviar el reclamo' }); }
    finally { setOcupado(false); }
  }

  async function guardarEdicion() {
    setOcupado(true);
    try {
      await api.put(`/compras/incidencias/${id}`, {
        tipo, cantidad_afectada: parseFloat(cantidad) || 1, descripcion: descripcion.trim() || undefined, adjuntos,
      });
      toast.success('Reclamo actualizado');
      setEditando(false); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
    finally { setOcupado(false); }
  }

  async function guardarRespuesta() {
    if (!solucion) return;
    setOcupado(true);
    try {
      await api.post(`/compras/incidencias/${id}/respuesta`, {
        respuesta_proveedor: respuesta.trim() || undefined, solucion,
        solucion_detalle: solucionDetalle.trim() || undefined,
        monto_descuento: monto ? parseFloat(monto) : undefined,
      });
      toast.success('Respuesta registrada');
      setPanel(null); onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo registrar la respuesta' }); }
    finally { setOcupado(false); }
  }

  const solOpts = Object.keys(SOLUCION_LABEL) as SolucionIncidencia[];

  return (
    <ModalShell
      icon={<AlertTriangle size={20} />} iconCls="bg-red-50 text-red-700"
      titulo={inc.numero}
      subtitulo={<>{TIPO_INCIDENCIA_LABEL[inc.tipo]} · abierto el {fmtFecha(inc.created_at)}{inc.usuario_nombre ? ` por ${inc.usuario_nombre}` : ''}</>}
      badges={<Badge label={est.label} cls={est.cls} />}
      onClose={onClose}
    >
      {/* Contexto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Ítem afectado</p>
          <p className="font-semibold text-gray-900">{inc.item_descripcion}</p>
          <FichaTecnica e={inc.item_especificaciones} />
          <p className="text-sm text-gray-700 mt-1">
            Afectado: <strong>{fmtCantidad(inc.cantidad_afectada, inc.item_unidad)}</strong> de {fmtCantidad(inc.item_cantidad, inc.item_unidad)} pedidas
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Proveedor y orden</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{inc.proveedor.nombre}</p>
            <BadgeProveedor proveedor={inc.proveedor} />
          </div>
          <div className="flex gap-2 mt-1 flex-wrap">
            <button onClick={() => abrir('oc', inc.orden.id)} className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100">{inc.orden.numero}</button>
            {inc.operacion && <span className="text-[11px] text-gray-600">{inc.operacion.numero.replace(/^OP-/, 'PRO-')} · {nombreCliente(inc.operacion.cliente)}</span>}
          </div>
          {inc.reclamada_at && <p className="text-[11px] text-amber-700 mt-1">Reclamado {haceCuanto(inc.reclamada_at)}{inc.reclamada_medio && inc.reclamada_medio !== 'manual' ? ` por ${inc.reclamada_medio}` : ''}</p>}
        </div>
      </div>

      {/* Descripción y fotos */}
      <Seccion titulo="El problema"
        accion={!cerrada && !editando && <button onClick={() => setEditando(true)} className="text-[11px] text-lime-700 font-semibold hover:underline">Editar</button>}>
        {editando ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className={lblCls}>¿Qué pasó?</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoIncidencia)} className={inpCls}>
                  {(Object.keys(TIPO_INCIDENCIA_LABEL) as TipoIncidencia[]).map(t => <option key={t} value={t}>{TIPO_INCIDENCIA_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={lblCls}>Cantidad afectada</label>
                <input type="number" step="0.01" min="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)} className={inpCls} />
              </div>
            </div>
            <div><label className={lblCls}>Detalle</label><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className={inpCls} /></div>
            <div>
              <label className={lblCls}>Fotos</label>
              <AdjuntosGrid urls={adjuntos} onRemove={u => setAdjuntos(a => a.filter(x => x !== u))} />
              <div className="mt-2"><DropzoneAdjuntos compacto onAdd={u => setAdjuntos(a => [...a, u])} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditando(false); cargar(); }} className={btnSecundario} disabled={ocupado}>Cancelar</button>
              <button onClick={guardarEdicion} className={btnPrimario} disabled={ocupado}><Save size={14} /> Guardar</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{inc.descripcion || <span className="text-gray-500 italic">Sin detalle cargado</span>}</p>
            {inc.adjuntos?.length > 0 && <div className="mt-2"><AdjuntosGrid urls={inc.adjuntos} /></div>}
          </>
        )}
      </Seccion>

      {/* Respuesta del proveedor */}
      {inc.respondida_at && (
        <Seccion titulo="Respuesta del proveedor">
          <div className="p-3 rounded-xl border border-sky-200 bg-sky-50 space-y-1">
            {inc.respuesta_proveedor && <p className="text-sm text-sky-900 whitespace-pre-wrap">"{inc.respuesta_proveedor}"</p>}
            {inc.solucion && (
              <p className="text-sm text-sky-900">
                <strong>{SOLUCION_LABEL[inc.solucion].label}</strong>
                {inc.monto_descuento ? ` · ${fmtMoneda(inc.monto_descuento)}` : ''}
                {inc.solucion_detalle ? ` — ${inc.solucion_detalle}` : ''}
              </p>
            )}
            <p className="text-[11px] text-sky-700">Registrada {haceCuanto(inc.respondida_at)}</p>
          </div>
        </Seccion>
      )}

      {/* Reposición */}
      {inc.reposicion && (
        <Seccion titulo="Reposición">
          <div className={cn('p-3 rounded-xl border flex items-start gap-3',
            inc.reposicion.estado_item === 'recibido' ? 'border-emerald-200 bg-emerald-50' : 'border-indigo-200 bg-indigo-50')}>
            <PackageCheck size={16} className={cn('mt-0.5 shrink-0', inc.reposicion.estado_item === 'recibido' ? 'text-emerald-600' : 'text-indigo-600')} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{inc.reposicion.descripcion}</p>
              <p className="text-xs text-gray-700">
                {fmtCantidad(inc.reposicion.cantidad, inc.item_unidad)} sin costo ·{' '}
                {inc.reposicion.estado_item === 'recibido'
                  ? <span className="text-emerald-700 font-semibold">recibida conforme — el reclamo se cerró solo</span>
                  : <span className="text-indigo-700 font-semibold">esperando que llegue (se registra en la próxima recepción de la orden)</span>}
              </p>
              <button onClick={() => abrir('oc', inc.orden.id)} className="text-[11px] text-emerald-700 font-semibold hover:underline mt-1 inline-flex items-center gap-1">
                <Truck size={11} /> Ver la orden
              </button>
            </div>
          </div>
        </Seccion>
      )}

      {/* Acciones */}
      {!cerrada && !editando && panel === null && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
          {inc.proveedor.telefono && (
            <button disabled={ocupado} onClick={() => previsualizar('whatsapp')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl px-3 h-11 sm:h-10 disabled:opacity-50">
              <MessageCircle size={14} /> {inc.reclamada_at ? 'Reenviar por WhatsApp' : 'Reclamar por WhatsApp'}
            </button>
          )}
          {inc.proveedor.email && (
            <button disabled={ocupado} onClick={() => previsualizar('email')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl px-3 h-11 sm:h-10 disabled:opacity-50">
              <Mail size={14} /> Email
            </button>
          )}
          {!inc.reclamada_at && (
            <button disabled={ocupado} onClick={() => reclamar('manual')} className={btnSecundario} title="Ya lo hablé con el proveedor">
              <Send size={14} /> Ya reclamado
            </button>
          )}
          <button onClick={() => setPanel('respuesta')} className={cn(btnPrimario, 'ml-auto')}>
            <Check size={14} /> {inc.respondida_at ? 'Actualizar respuesta' : 'Registrar respuesta'}
          </button>
        </div>
      )}

      {panel === 'respuesta' && (
        <div className="pt-3 border-t border-gray-200 space-y-3">
          <p className="text-sm font-bold text-gray-900">¿Qué contestó el proveedor?</p>
          <div><label className={lblCls}>Respuesta (textual)</label>
            <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={2} className={inpCls} placeholder="Ej: lo reponen la semana que viene" />
          </div>
          <div>
            <label className={lblCls}>Solución acordada</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {solOpts.map(sk => (
                <button key={sk} type="button" onClick={() => setSolucion(sk)}
                  className={cn('text-left p-2.5 rounded-xl border-2 min-h-11', solucion === sk ? 'border-lime-500 bg-lime-50' : 'border-gray-200 hover:border-gray-300')}>
                  <p className="text-xs font-bold text-gray-900">{SOLUCION_LABEL[sk].label}</p>
                </button>
              ))}
            </div>
            {solucion && <p className="text-[11px] text-gray-600 mt-1.5">{SOLUCION_LABEL[solucion].ayuda}</p>}
          </div>
          {(solucion === 'descuento' || solucion === 'nota_credito') && (
            <div className="sm:max-w-[240px]"><label className={lblCls}>Monto</label><MontoInput value={monto} onChange={setMonto} className={inpCls} /></div>
          )}
          <div><label className={lblCls}>Detalle de la solución</label><input value={solucionDetalle} onChange={e => setSolucionDetalle(e.target.value)} className={inpCls} /></div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPanel(null)} className={btnSecundario} disabled={ocupado}>Volver</button>
            <button onClick={guardarRespuesta} disabled={!solucion || ocupado} className={btnPrimario}>{ocupado ? 'Guardando…' : 'Guardar respuesta'}</button>
          </div>
        </div>
      )}

      {cerrada && (
        <p className="text-xs text-gray-600 flex items-center gap-1.5 pt-3 border-t border-gray-200">
          <Check size={13} className="text-emerald-600" />
          Reclamo {est.label.toLowerCase()}{inc.resuelta_at ? ` el ${fmtFecha(inc.resuelta_at)}` : ''}.
        </p>
      )}

      {msgPreview && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setMsgPreview(null); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <p className="font-bold text-gray-900 flex items-center gap-2"><Eye size={16} /> Reclamo a {inc.proveedor.nombre}</p>
              <button onClick={() => setMsgPreview(null)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-600">
                Se envía por {msgPreview.medio === 'whatsapp' ? `WhatsApp al ${inc.proveedor.telefono}` : `email a ${inc.proveedor.email}`}
                {inc.adjuntos?.length ? ` con ${inc.adjuntos.length} foto${inc.adjuntos.length === 1 ? '' : 's'}` : ' (sin fotos cargadas)'}.
              </p>
              <textarea value={msgPreview.mensaje} onChange={e => setMsgPreview({ ...msgPreview, mensaje: e.target.value })} rows={9} className={inpCls} />
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
              <button onClick={() => setMsgPreview(null)} className={btnSecundario}>Cancelar</button>
              <button onClick={() => reclamar(msgPreview.medio, msgPreview.mensaje)} disabled={ocupado} className={btnPrimario}>
                <Send size={14} /> {ocupado ? 'Enviando…' : 'Enviar reclamo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
