import { useEffect, useMemo, useState } from 'react';
import { Layers, Check, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { fmtCantidad, fmtFecha, nombreCliente, type ClienteMin, type Especificaciones, type ProveedorMin } from './tipos';
import { ModalShell, Badge, FichaTecnica, SelectorProveedores, lblCls, btnPrimario, btnSecundario } from './ui';
import { FormOrden, type OrdenPayload } from './FormOrden';

interface ItemPendiente {
  id: string; descripcion: string; cantidad: number | string; unidad: string; especificaciones: Especificaciones;
  costo_referencia: number | string | null; proveedor_sku: string | null; estado: string;
  producto_id: string | null; producto_nombre: string | null;
  solicitud_id: string; solicitud_numero: string; obra: string | null; fecha_necesaria: string | null; origen: string;
  proveedor_sugerido_id: string | null; proveedor_sugerido_nombre: string | null;
  cliente: ClienteMin | null; operacion_numero: string | null;
}

/**
 * Consolidar: ítems pendientes de varias solicitudes (varios clientes) al mismo proveedor
 * en una sola OC. El flete se prorratea por monto al mostrar la orden; cada ítem sabe de
 * qué solicitud/cliente viene.
 */
export function ModalConsolidar({ onClose, onCreated }: { onClose: () => void; onCreated: (ocId: string) => void }) {
  const [items, setItems] = useState<ItemPendiente[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [proveedorId, setProveedorId] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([api.get<ItemPendiente[]>('/compras/solicitudes/items-pendientes'), api.get<ProveedorMin[]>('/catalogo/proveedores')])
      .then(([it, ps]) => { setItems(it); setProveedores(ps); })
      .catch(() => toast.error('Error al cargar ítems pendientes'))
      .finally(() => setLoading(false));
  }, []);

  // Proveedores con ítems sugeridos primero
  const conteoSugerido = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.proveedor_sugerido_id) m.set(i.proveedor_sugerido_id, (m.get(i.proveedor_sugerido_id) ?? 0) + 1);
    return m;
  }, [items]);
  const sugeridoTop = [...conteoSugerido.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Al elegir proveedor, preseleccionar sus ítems sugeridos
  function elegirProveedor(id: string) {
    setProveedorId(id);
    if (id) setSel(items.filter(i => i.proveedor_sugerido_id === id).map(i => i.id));
  }

  const grupos = useMemo(() => {
    const m = new Map<string, { titulo: string; items: ItemPendiente[] }>();
    for (const i of items) {
      const key = i.solicitud_id;
      if (!m.has(key)) m.set(key, { titulo: `${i.solicitud_numero} · ${i.cliente ? nombreCliente(i.cliente) : 'Stock propio'}${i.obra ? ` · ${i.obra}` : ''}`, items: [] });
      m.get(key)!.items.push(i);
    }
    return [...m.values()];
  }, [items]);

  const itemsSel = items.filter(i => sel.includes(i.id));
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  async function crear(p: OrdenPayload) {
    setEnviando(true);
    try {
      const r = await api.post<{ id: string; numero: string }>('/compras/ordenes/consolidar', { ...p, proveedor_id: proveedorId });
      toast.success(`Orden ${r.numero} creada en borrador`);
      onCreated(r.id);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo crear la orden' }); }
    finally { setEnviando(false); }
  }

  const prov = proveedores.find(p => p.id === proveedorId);

  return (
    <ModalShell icon={<Layers size={20} />} iconCls="bg-violet-50 text-violet-700" titulo="Consolidar compras"
      subtitulo={paso === 1 ? 'Elegí el proveedor y los ítems pendientes de distintas solicitudes que le vas a pedir juntos' : `Orden a ${prov?.nombre} · ${itemsSel.length} ítem${itemsSel.length === 1 ? '' : 's'}`}
      onClose={onClose} ancho="sm:max-w-4xl">
      {loading ? <p className="text-sm text-gray-600">Cargando…</p> : paso === 1 ? (
        <>
          <div>
            <label className={lblCls}>Proveedor</label>
            <SelectorProveedores proveedores={proveedores} seleccionados={proveedorId ? [proveedorId] : []} onChange={ids => elegirProveedor(ids[0] ?? '')} multiple={false} sugeridoId={sugeridoTop} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lblCls}>Ítems pendientes ({items.length})</label>
              {items.length > 0 && <button onClick={() => setSel(sel.length === items.length ? [] : items.map(i => i.id))} className="text-[11px] text-lime-700 font-semibold hover:underline">{sel.length === items.length ? 'Ninguno' : 'Todos'}</button>}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-xl border border-gray-200">No hay ítems pendientes en solicitudes abiertas. Creá una solicitud primero.</p>
            ) : (
              <div className="space-y-3">
                {grupos.map(g => (
                  <div key={g.titulo} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-between gap-2">
                      <span className="truncate">{g.titulo}</span>
                      {g.items[0].fecha_necesaria && <span className="text-[10px] text-gray-500 shrink-0">necesaria {fmtFecha(g.items[0].fecha_necesaria)}</span>}
                    </div>
                    <div className="divide-y divide-gray-100">
                      {g.items.map(i => {
                        const marcado = sel.includes(i.id);
                        const sug = i.proveedor_sugerido_id === proveedorId && !!proveedorId;
                        return (
                          <button key={i.id} type="button" onClick={() => toggle(i.id)} className={cn('w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-lime-50/50 min-h-11', marcado && 'bg-lime-50/60')}>
                            <span className={cn('w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0', marcado ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-300 bg-white')}>{marcado && <Check size={12} />}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">{i.descripcion}</p>
                                {sug && <Badge label="sugerido" cls="bg-lime-100 text-lime-800" />}
                                {i.estado === 'en_cotizacion' && <Badge label="en cotización" cls="bg-sky-100 text-sky-800" />}
                                {i.proveedor_sugerido_nombre && !sug && <span className="text-[10px] text-gray-500">sug.: {i.proveedor_sugerido_nombre}</span>}
                              </div>
                              <FichaTecnica e={i.especificaciones} />
                            </div>
                            <span className="text-sm font-bold text-gray-800 shrink-0">×{fmtCantidad(i.cantidad, i.unidad)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button onClick={onClose} className={btnSecundario}>Cancelar</button>
            <button onClick={() => setPaso(2)} disabled={!proveedorId || sel.length === 0} className={btnPrimario}>
              Continuar con {sel.length} ítem{sel.length === 1 ? '' : 's'} <ArrowRight size={14} />
            </button>
          </div>
        </>
      ) : (
        <FormOrden
          items={itemsSel.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad, costo_referencia: i.costo_referencia, proveedor_sku: i.proveedor_sku, especificaciones: i.especificaciones, cliente: i.cliente, solicitud_numero: i.solicitud_numero }))}
          proveedorFijoId={proveedorId} mostrarCliente
          onSubmit={crear} onCancel={() => setPaso(1)} enviando={enviando} labelSubmit="Crear orden consolidada"
        />
      )}
    </ModalShell>
  );
}
