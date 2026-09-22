import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ClipboardList, ShoppingBag, FileText, Ruler, Package, Factory, AlertCircle, ShieldCheck, RotateCcw,
  Search, Plus, ArrowRight, ArrowLeft, Scale, Zap, Save, Check, RefreshCw, Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { FormPageHeader } from '@/components/FormPageHeader';
import { SectionCard } from '@/components/SectionCard';
import { ModalCatalogoProductos } from '@/components/catalogo/ModalCatalogoProductos';
import type { Producto } from '@/types';
import {
  ORIGEN_LABEL, TIPO_PRODUCTO_LABEL, CAMPOS_ESPEC, UNIDAD_LABEL, fmtFecha, fmtMoneda, nombreCliente,
  type OrigenCompra, type TipoProductoCompra, type Especificaciones, type ProveedorMin, type ClienteMin, type SolicitudDetalle,
} from './tipos';
import { inpCls, lblCls, btnPrimario, btnSecundario, AdjuntosGrid, DropzoneAdjuntos, SelectorProveedores, FichaTecnica, BotonEliminar } from './ui';
import { FormOrden, type OrdenPayload } from './FormOrden';

interface ItemForm {
  _key: string;
  id?: string;
  operacion_item_id?: string | null;
  visita_tecnica_item_id?: string | null;
  producto_id?: string | null;
  producto_nombre?: string | null;
  descripcion: string;
  cantidad: string;
  unidad: string;
  especificaciones: Especificaciones;
  adjuntos: string[];
  observaciones: string;
  costo_referencia?: number | null;
  ya_pedido?: boolean;
  incluir: boolean;
}

interface Preparado {
  cliente_id?: string | null; cliente?: ClienteMin | null;
  operacion?: { id: string; numero: string } | null; visita_tecnica?: { id: string; numero: string } | null;
  proveedor_sugerido_id?: string | null; fecha_necesaria?: string | null; tipo_producto: TipoProductoCompra;
  items: {
    operacion_item_id?: string | null; visita_tecnica_item_id?: string | null; producto_id?: string | null;
    descripcion: string; cantidad: number; unidad: string; especificaciones: Especificaciones; adjuntos: string[];
    costo_referencia?: number | null; ya_pedido?: boolean; proveedor_sugerido_id?: string | null;
  }[];
}

interface OpPendiente { id: string; numero: string; cliente: ClienteMin; items_total: number; items_pendientes: number; proveedor_nombre: string | null; solicitudes_abiertas: number; fecha_entrega_estimada: string | null }
interface VtRow { id: string; numero: string; estado: string; fecha_visita: string | null; cliente?: ClienteMin | null; cliente_nombre?: string; items_count?: number }

const ORIGENES: { value: OrigenCompra; icon: typeof ShoppingBag; desc: string; fuente: 'operacion' | 'visita' | 'producto' | 'manual' }[] = [
  { value: 'venta',             icon: ShoppingBag, desc: 'Presupuesto aprobado y cobrado: comprar lo que falta',   fuente: 'operacion' },
  { value: 'proforma',          icon: FileText,    desc: 'Cotizar antes de cerrar la venta',                        fuente: 'operacion' },
  { value: 'orden_trabajo',     icon: Ruler,       desc: 'Desde un relevamiento de medidas',                        fuente: 'visita' },
  { value: 'reposicion_stock',  icon: Package,     desc: 'Reponer productos del salón / stock',                     fuente: 'producto' },
  { value: 'faltante',          icon: AlertCircle, desc: 'Algo que falta y hay que pedir ya',                       fuente: 'producto' },
  { value: 'produccion_propia', icon: Factory,     desc: 'Insumos para fabricar acá (perfiles, vidrios, herrajes)', fuente: 'manual' },
  { value: 'garantia',          icon: ShieldCheck, desc: 'Reposición por garantía al cliente',                      fuente: 'manual' },
  { value: 'reposicion_falla',  icon: RotateCcw,   desc: 'Reponer una pieza fallada / rota',                        fuente: 'manual' },
];

let keySeq = 0;
const nuevaKey = () => `k${++keySeq}`;

function itemVacio(): ItemForm {
  return { _key: nuevaKey(), descripcion: '', cantidad: '1', unidad: 'u', especificaciones: {}, adjuntos: [], observaciones: '', incluir: true };
}

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [params] = useSearchParams();
  const esEdicion = !!editId;

  const [paso, setPaso] = useState<1 | 2 | 3>(esEdicion ? 2 : 1);
  const [origen, setOrigen] = useState<OrigenCompra | null>(null);
  const [cargandoOrigen, setCargandoOrigen] = useState(false);
  // Cabecera
  const [tipoProducto, setTipoProducto] = useState<TipoProductoCompra>('abertura_medida');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteMin | null>(null);
  const [operacion, setOperacion] = useState<{ id: string; numero: string } | null>(null);
  const [visita, setVisita] = useState<{ id: string; numero: string } | null>(null);
  const [obra, setObra] = useState('');
  const [fechaNecesaria, setFechaNecesaria] = useState('');
  const [proveedorSugeridoId, setProveedorSugeridoId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [items, setItems] = useState<ItemForm[]>([]);
  // Selectores del paso 1
  const [opsPend, setOpsPend] = useState<OpPendiente[]>([]);
  const [busqOp, setBusqOp] = useState('');
  const [vts, setVts] = useState<VtRow[]>([]);
  const [busqVt, setBusqVt] = useState('');
  const [galeria, setGaleria] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosLoading, setProductosLoading] = useState(false);
  // Paso 3
  const [proveedores, setProveedores] = useState<ProveedorMin[]>([]);
  const [siguiente, setSiguiente] = useState<'cotizar' | 'directa' | 'guardar' | null>(null);
  const [provSel, setProvSel] = useState<string[]>([]);
  const [fechaLimite, setFechaLimite] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get<ProveedorMin[]>('/catalogo/proveedores').then(setProveedores).catch(() => {});
  }, []);

  // Edición: precargar
  useEffect(() => {
    if (!editId) return;
    api.get<SolicitudDetalle>(`/compras/solicitudes/${editId}`).then(sc => {
      if (sc.estado !== 'abierta') { toast.error('Solo se puede editar una solicitud abierta'); navigate(`/compras?sc=${editId}`); return; }
      setOrigen(sc.origen); setTipoProducto(sc.tipo_producto); setClienteId(sc.cliente_id); setCliente(sc.cliente);
      setOperacion(sc.operacion); setVisita(sc.visita_tecnica); setObra(sc.obra ?? '');
      setFechaNecesaria(sc.fecha_necesaria ? sc.fecha_necesaria.slice(0, 10) : ''); setProveedorSugeridoId(sc.proveedor_sugerido_id ?? '');
      setObservaciones(sc.observaciones ?? ''); setAdjuntos(sc.adjuntos ?? []);
      setItems(sc.items.map(i => ({
        _key: nuevaKey(), id: i.id, operacion_item_id: i.operacion_item_id, visita_tecnica_item_id: i.visita_tecnica_item_id, producto_id: i.producto_id,
        producto_nombre: i.producto_nombre, descripcion: i.descripcion, cantidad: String(Number(i.cantidad)), unidad: i.unidad,
        especificaciones: i.especificaciones ?? {}, adjuntos: i.adjuntos ?? [], observaciones: i.observaciones ?? '',
        costo_referencia: i.costo_referencia != null ? Number(i.costo_referencia) : null, incluir: i.estado !== 'cancelado',
      })));
    }).catch(() => { toast.error('No se pudo cargar la solicitud'); navigate('/compras'); });
  }, [editId, navigate]);

  // Preselección por query (?operacion_id= desde Presupuestos / Operaciones / recibo)
  useEffect(() => {
    const opId = params.get('operacion_id');
    const vtId = params.get('visita_tecnica_id');
    if (esEdicion) return;
    if (opId) { setOrigen('venta'); preparar({ operacion_id: opId }); }
    else if (vtId) { setOrigen('orden_trabajo'); preparar({ visita_tecnica_id: vtId }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listas del paso 1 según origen
  useEffect(() => {
    const cfg = ORIGENES.find(o => o.value === origen);
    if (cfg?.fuente === 'operacion' && opsPend.length === 0) {
      api.get<OpPendiente[]>('/compras/solicitudes/pendientes-desde-operaciones').then(setOpsPend).catch(() => {});
    }
    if (cfg?.fuente === 'visita' && vts.length === 0) {
      api.get<VtRow[]>('/visitas-tecnicas').then(rows => setVts(rows.filter(v => v.estado !== 'cancelada'))).catch(() => {});
    }
    if (cfg?.fuente === 'producto' && !galeria && paso === 1 && origen) {
      setGaleria(true);
      if (productos.length === 0) {
        setProductosLoading(true);
        api.get<Producto[]>('/catalogo/productos').then(setProductos).catch(() => toast.error('No se pudo cargar el catálogo')).finally(() => setProductosLoading(false));
      }
    }
  }, [origen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function preparar(q: { operacion_id?: string; visita_tecnica_id?: string; producto_id?: string; cantidad?: number }) {
    setCargandoOrigen(true);
    try {
      const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
      const p = await api.get<Preparado>(`/compras/solicitudes/preparar?${qs}`);
      if (q.producto_id) {
        // Se agregan al listado actual (varios productos en una misma SC)
        setItems(prev => [...prev, ...p.items.map(i => aItemForm(i, true))]);
        setTipoProducto(t => prev0(t, p.tipo_producto));
        if (!proveedorSugeridoId && p.proveedor_sugerido_id) setProveedorSugeridoId(p.proveedor_sugerido_id);
        return;
      }
      setClienteId(p.cliente_id ?? null); setCliente(p.cliente ?? null);
      setOperacion(p.operacion ?? null); setVisita(p.visita_tecnica ?? null);
      setTipoProducto(p.tipo_producto);
      if (p.proveedor_sugerido_id) setProveedorSugeridoId(p.proveedor_sugerido_id);
      if (p.fecha_necesaria) setFechaNecesaria(p.fecha_necesaria.slice(0, 10));
      setItems(p.items.map(i => aItemForm(i, !i.ya_pedido)));
      setPaso(2);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo preparar la solicitud' }); }
    finally { setCargandoOrigen(false); }
  }
  const prev0 = (actual: TipoProductoCompra, nuevo: TipoProductoCompra) => items.length ? actual : nuevo;

  function aItemForm(i: Preparado['items'][number], incluir: boolean): ItemForm {
    return {
      _key: nuevaKey(), operacion_item_id: i.operacion_item_id ?? null, visita_tecnica_item_id: i.visita_tecnica_item_id ?? null,
      producto_id: i.producto_id ?? null, descripcion: i.descripcion, cantidad: String(i.cantidad), unidad: i.unidad,
      especificaciones: i.especificaciones ?? {}, adjuntos: i.adjuntos ?? [], observaciones: '',
      costo_referencia: i.costo_referencia ?? null, ya_pedido: i.ya_pedido, incluir,
    };
  }

  const upItem = (key: string, patch: Partial<ItemForm>) => setItems(ls => ls.map(i => i._key === key ? { ...i, ...patch } : i));
  const upEspec = (key: string, k: string, v: unknown) => setItems(ls => ls.map(i => i._key === key ? { ...i, especificaciones: { ...i.especificaciones, [k]: v === '' ? undefined : v } } : i));

  const itemsIncluidos = items.filter(i => i.incluir && !i.ya_pedido);
  const valido = itemsIncluidos.length > 0 && itemsIncluidos.every(i => i.descripcion.trim() && (parseFloat(i.cantidad) || 0) > 0);

  function payloadSc() {
    return {
      origen, operacion_id: operacion?.id ?? null, visita_tecnica_id: visita?.id ?? null, cliente_id: clienteId,
      obra: obra.trim() || undefined, tipo_producto: tipoProducto, fecha_necesaria: fechaNecesaria || null,
      observaciones: observaciones.trim() || undefined, adjuntos, proveedor_sugerido_id: proveedorSugeridoId || null,
      items: itemsIncluidos.map(i => ({
        id: i.id, operacion_item_id: i.operacion_item_id ?? null, visita_tecnica_item_id: i.visita_tecnica_item_id ?? null, producto_id: i.producto_id ?? null,
        descripcion: i.descripcion.trim(), cantidad: parseFloat(i.cantidad) || 1, unidad: i.unidad,
        especificaciones: Object.fromEntries(Object.entries(i.especificaciones).filter(([, v]) => v !== undefined && v !== null && v !== '')),
        adjuntos: i.adjuntos, observaciones: i.observaciones.trim() || undefined,
      })),
    };
  }

  async function guardar(modo: 'guardar' | 'cotizar' | 'directa', orden?: OrdenPayload) {
    if (!valido || !origen) return;
    setGuardando(true);
    try {
      if (esEdicion) {
        await api.put(`/compras/solicitudes/${editId}`, payloadSc());
        toast.success('Solicitud actualizada');
        navigate(`/compras?sc=${editId}`);
        return;
      }
      const sc = await api.post<{ id: string; numero: string }>('/compras/solicitudes', payloadSc());
      if (modo === 'guardar') { toast.success(`Solicitud ${sc.numero} creada`); navigate(`/compras?sc=${sc.id}`); return; }
      const det = await api.get<SolicitudDetalle>(`/compras/solicitudes/${sc.id}`);
      const ids = det.items.map(i => i.id);
      if (modo === 'cotizar') {
        const pc = await api.post<{ id: string; numero: string }>('/compras/cotizaciones', { solicitud_id: sc.id, item_ids: ids, proveedor_ids: provSel, fecha_limite: fechaLimite || null });
        toast.success(`Solicitud ${sc.numero} y cotización ${pc.numero} creadas`);
        navigate(`/compras?pc=${pc.id}`);
      } else if (orden) {
        // Los ítems del form se mapearon por posición: reasignar los ids reales de la SC
        const porPos = orden.items.map((it, idx) => ({ ...it, solicitud_item_id: ids[idx] }));
        const oc = await api.post<{ id: string; numero: string }>('/compras/ordenes/directa', { ...orden, solicitud_id: sc.id, items: porPos });
        toast.success(`Solicitud ${sc.numero} y orden ${oc.numero} creadas`);
        navigate(`/compras?oc=${oc.id}`);
      }
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
    finally { setGuardando(false); }
  }

  const cfgOrigen = ORIGENES.find(o => o.value === origen);
  const opsFiltradas = useMemo(() => {
    const q = busqOp.trim().toLowerCase();
    return opsPend.filter(o => !q || o.numero.toLowerCase().includes(q) || nombreCliente(o.cliente).toLowerCase().includes(q));
  }, [opsPend, busqOp]);
  const vtsFiltradas = useMemo(() => {
    const q = busqVt.trim().toLowerCase();
    return vts.filter(v => !q || v.numero.toLowerCase().includes(q) || (v.cliente ? nombreCliente(v.cliente) : v.cliente_nombre ?? '').toLowerCase().includes(q)).slice(0, 30);
  }, [vts, busqVt]);

  const titulo = esEdicion ? 'Editar solicitud' : 'Nueva solicitud de compra';
  const pasos = [{ n: 1, l: 'Origen' }, { n: 2, l: 'Ítems' }, { n: 3, l: '¿Cómo seguimos?' }];

  return (
    <div className="p-3 sm:p-4 xl:p-6 max-w-5xl mx-auto" data-section="pedidos">
      <FormPageHeader onBack={() => navigate(-1)} icon={ClipboardList} iconColorClass="bg-lime-100 text-lime-700" title={titulo}
        sub={origen ? <>{ORIGEN_LABEL[origen]}{cliente ? ` · ${nombreCliente(cliente)}` : ''}{operacion ? ` · ${operacion.numero.replace(/^OP-/, 'PRO-')}` : ''}{visita ? ` · ${visita.numero}` : ''}</> : 'Qué necesitamos comprar y para quién'} />

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {pasos.filter(p => !esEdicion || p.n === 2).map((p, i, arr) => (
          <div key={p.n} className="flex items-center gap-2 shrink-0">
            <button onClick={() => p.n < paso && setPaso(p.n as 1 | 2 | 3)} disabled={p.n >= paso}
              className={cn('flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold border', paso === p.n ? 'bg-lime-600 text-white border-lime-600' : p.n < paso ? 'bg-white text-lime-700 border-lime-300' : 'bg-white text-gray-400 border-gray-200')}>
              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', paso === p.n ? 'bg-white/20' : p.n < paso ? 'bg-lime-100' : 'bg-gray-100')}>{p.n < paso ? <Check size={11} /> : p.n}</span>
              {p.l}
            </button>
            {i < arr.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ── Paso 1: origen ─────────────────────────────────────────── */}
      {paso === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {ORIGENES.map(o => (
              <button key={o.value} onClick={() => { setOrigen(o.value); setItems([]); if (o.fuente === 'manual') { setItems([itemVacio()]); setTipoProducto(o.value === 'produccion_propia' ? 'perfil' : 'abertura_medida'); setPaso(2); } }}
                className={cn('flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all min-h-[96px]', origen === o.value ? 'border-lime-500 bg-lime-50' : 'border-gray-200 bg-white hover:border-lime-300')}>
                <o.icon size={20} className={origen === o.value ? 'text-lime-700' : 'text-gray-500'} />
                <p className="text-sm font-bold text-gray-900">{ORIGEN_LABEL[o.value]}</p>
                <p className="text-[11px] text-gray-600 leading-snug">{o.desc}</p>
              </button>
            ))}
          </div>

          {cfgOrigen?.fuente === 'operacion' && (
            <SectionCard title="Elegí el presupuesto" icon={ShoppingBag}>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={busqOp} onChange={e => setBusqOp(e.target.value)} placeholder="Buscar por número o cliente…" className={cn(inpCls, 'pl-8')} autoFocus />
              </div>
              {cargandoOrigen ? <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-lime-600" /></div> : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl max-h-[420px] overflow-y-auto">
                  {opsFiltradas.length === 0 && <p className="text-sm text-gray-600 p-4">No hay presupuestos cobrados con ítems sin comprar{busqOp ? ' que coincidan' : ''}.</p>}
                  {opsFiltradas.map(o => (
                    <button key={o.id} onClick={() => preparar({ operacion_id: o.id })} className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-lime-50/60 min-h-11">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{nombreCliente(o.cliente)} <span className="font-mono text-xs text-blue-700 ml-1">{o.numero.replace(/^OP-/, 'PRO-')}</span></p>
                        <p className="text-[11px] text-gray-600">{o.items_pendientes} de {o.items_total} ítem{o.items_total === 1 ? '' : 's'} sin comprar{o.proveedor_nombre ? ` · prov. sugerido: ${o.proveedor_nombre}` : ''}{o.fecha_entrega_estimada ? ` · entrega ${fmtFecha(o.fecha_entrega_estimada)}` : ''}</p>
                        {o.solicitudes_abiertas > 0 && <p className="text-[11px] text-amber-700">Ya tiene {o.solicitudes_abiertas} solicitud{o.solicitudes_abiertas === 1 ? '' : 'es'} abierta{o.solicitudes_abiertas === 1 ? '' : 's'}</p>}
                      </div>
                      <ArrowRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {cfgOrigen?.fuente === 'visita' && (
            <SectionCard title="Elegí el relevamiento" icon={Ruler}>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={busqVt} onChange={e => setBusqVt(e.target.value)} placeholder="Buscar VT- o cliente…" className={cn(inpCls, 'pl-8')} autoFocus />
              </div>
              {cargandoOrigen ? <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-lime-600" /></div> : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl max-h-[420px] overflow-y-auto">
                  {vtsFiltradas.length === 0 && <p className="text-sm text-gray-600 p-4">Sin relevamientos.</p>}
                  {vtsFiltradas.map(v => (
                    <button key={v.id} onClick={() => preparar({ visita_tecnica_id: v.id })} className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-lime-50/60 min-h-11">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{v.cliente ? nombreCliente(v.cliente) : v.cliente_nombre} <span className="font-mono text-xs text-blue-700 ml-1">{v.numero}</span></p>
                        <p className="text-[11px] text-gray-600">{v.estado}{v.fecha_visita ? ` · ${fmtFecha(v.fecha_visita)}` : ''}</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {cfgOrigen?.fuente === 'producto' && (
            <SectionCard title="Productos a reponer" icon={Package}>
              {items.length === 0 ? <p className="text-sm text-gray-600">Elegí productos del catálogo.</p> : (
                <div className="space-y-1.5 mb-3">
                  {items.map(i => (
                    <div key={i._key} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-xl">
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900">{i.descripcion}</p><FichaTecnica e={i.especificaciones} /></div>
                      <input type="number" min="1" step="1" value={i.cantidad} onChange={e => upItem(i._key, { cantidad: e.target.value })} className={cn(inpCls, 'w-20 text-right')} />
                      <BotonEliminar onClick={() => setItems(ls => ls.filter(x => x._key !== i._key))} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setGaleria(true)} className={btnSecundario}><Plus size={14} /> Agregar del catálogo</button>
                <button onClick={() => setPaso(2)} disabled={items.length === 0} className={btnPrimario}>Continuar <ArrowRight size={14} /></button>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Paso 2: ítems y cabecera ───────────────────────────────── */}
      {paso === 2 && origen && (
        <div className="space-y-4">
          <SectionCard title="Datos de la solicitud" icon={ClipboardList}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><label className={lblCls}>Tipo de producto</label>
                <select value={tipoProducto} onChange={e => setTipoProducto(e.target.value as TipoProductoCompra)} className={inpCls}>
                  {(Object.keys(TIPO_PRODUCTO_LABEL) as TipoProductoCompra[]).map(t => <option key={t} value={t}>{TIPO_PRODUCTO_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={lblCls}>Obra / referencia</label><input value={obra} onChange={e => setObra(e.target.value)} className={inpCls} placeholder={cliente ? 'Ej: casa Av. 25 de Mayo' : 'Opcional'} /></div>
              <div><label className={lblCls}>Fecha necesaria</label><input type="date" value={fechaNecesaria} onChange={e => setFechaNecesaria(e.target.value)} className={inpCls} /></div>
              <div><label className={lblCls}>Proveedor sugerido</label>
                <select value={proveedorSugeridoId} onChange={e => setProveedorSugeridoId(e.target.value)} className={inpCls}>
                  <option value="">—</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4"><label className={lblCls}>Observaciones</label><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className={inpCls} /></div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={lblCls}>Adjuntos generales (planos, fotos, PDF)</label>
                <AdjuntosGrid urls={adjuntos} size="sm" onRemove={u => setAdjuntos(a => a.filter(x => x !== u))} />
                <div className="mt-2"><DropzoneAdjuntos compacto onAdd={u => setAdjuntos(a => [...a, u])} /></div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={`Ítems (${itemsIncluidos.length} a pedir)`} icon={Package}>
            <div className="space-y-3">
              {items.map(it => {
                const campos = CAMPOS_ESPEC[tipoProducto];
                const bloqueado = !!it.ya_pedido;
                return (
                  <div key={it._key} className={cn('border rounded-xl p-3', bloqueado ? 'border-gray-200 bg-gray-50 opacity-70' : it.incluir ? 'border-lime-300' : 'border-gray-200 bg-gray-50')}>
                    <div className="flex items-start gap-3">
                      {!bloqueado && (
                        <button type="button" onClick={() => upItem(it._key, { incluir: !it.incluir })} title={it.incluir ? 'Dejar afuera' : 'Incluir'}
                          className={cn('w-6 h-6 mt-1 rounded-md border flex items-center justify-center shrink-0', it.incluir ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-300 bg-white')}>
                          {it.incluir && <Check size={13} />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_90px] gap-2">
                          <div>
                            <label className={lblCls}>Descripción</label>
                            <input value={it.descripcion} onChange={e => upItem(it._key, { descripcion: e.target.value })} disabled={bloqueado} className={inpCls} placeholder="Ej: Ventana corrediza 1,20 × 1,50" />
                          </div>
                          <div><label className={lblCls}>Cantidad</label><input type="number" step="0.01" min="0.01" value={it.cantidad} onChange={e => upItem(it._key, { cantidad: e.target.value })} disabled={bloqueado} className={inpCls} /></div>
                          <div><label className={lblCls}>Unidad</label>
                            <select value={it.unidad} onChange={e => upItem(it._key, { unidad: e.target.value })} disabled={bloqueado} className={inpCls}>
                              {Object.entries(UNIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                        </div>
                        {bloqueado ? (
                          <p className="text-[11px] text-emerald-700 font-semibold">Ya está en una orden de compra activa — no se vuelve a pedir.</p>
                        ) : (
                          <details className="group" open={!it.producto_id}>
                            <summary className="text-[11px] font-semibold text-gray-600 cursor-pointer select-none flex items-center gap-2">
                              Ficha técnica <span className="font-normal text-gray-500 truncate">{Object.keys(it.especificaciones).length ? '— ' : '(vacía, tocá para completar)'}<FichaTecnica e={it.especificaciones} className="inline" /></span>
                            </summary>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
                              {campos.map(c => (
                                <div key={c.key}>
                                  <label className={lblCls}>{c.label}{c.sufijo ? ` (${c.sufijo})` : ''}</label>
                                  {c.tipo === 'bool' ? (
                                    <select value={it.especificaciones[c.key] === true ? 'si' : it.especificaciones[c.key] === false ? 'no' : ''} onChange={e => upEspec(it._key, c.key, e.target.value === '' ? '' : e.target.value === 'si')} className={inpCls}>
                                      <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
                                    </select>
                                  ) : c.tipo === 'num' ? (
                                    <input type="number" step="any" min="0" value={(it.especificaciones[c.key] as number | undefined) ?? ''} onChange={e => upEspec(it._key, c.key, e.target.value === '' ? '' : Number(e.target.value))} className={inpCls} />
                                  ) : (
                                    <input value={(it.especificaciones[c.key] as string | undefined) ?? ''} onChange={e => upEspec(it._key, c.key, e.target.value)} className={inpCls} />
                                  )}
                                </div>
                              ))}
                              <div className="col-span-2 sm:col-span-3 lg:col-span-5"><label className={lblCls}>Observaciones del ítem</label><input value={it.observaciones} onChange={e => upItem(it._key, { observaciones: e.target.value })} className={inpCls} /></div>
                              <div className="col-span-2 sm:col-span-3 lg:col-span-5">
                                <AdjuntosGrid urls={it.adjuntos} size="sm" onRemove={u => upItem(it._key, { adjuntos: it.adjuntos.filter(x => x !== u) })} />
                                <div className="mt-1"><DropzoneAdjuntos compacto onAdd={u => upItem(it._key, { adjuntos: [...it.adjuntos, u] })} /></div>
                              </div>
                            </div>
                          </details>
                        )}
                        {it.costo_referencia ? <p className="text-[10px] text-gray-500">Costo de referencia: {fmtMoneda(it.costo_referencia)}</p> : null}
                      </div>
                      {!bloqueado && !it.operacion_item_id && !it.visita_tecnica_item_id && (
                        <button type="button" onClick={() => setItems(ls => ls.filter(x => x._key !== it._key))} className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setItems(ls => [...ls, itemVacio()])} className={btnSecundario}><Plus size={14} /> Agregar ítem manual</button>
                <button type="button" onClick={() => { setGaleria(true); if (productos.length === 0) { setProductosLoading(true); api.get<Producto[]>('/catalogo/productos').then(setProductos).catch(() => {}).finally(() => setProductosLoading(false)); } }} className={btnSecundario}><Package size={14} /> Del catálogo</button>
              </div>
            </div>
          </SectionCard>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-2">
            {!esEdicion ? <button onClick={() => setPaso(1)} className={btnSecundario}><ArrowLeft size={14} /> Volver</button> : <span />}
            {esEdicion
              ? <button onClick={() => guardar('guardar')} disabled={!valido || guardando} className={btnPrimario}><Save size={14} /> {guardando ? 'Guardando…' : 'Guardar cambios'}</button>
              : <button onClick={() => { setPaso(3); if (proveedorSugeridoId) setProvSel([proveedorSugeridoId]); }} disabled={!valido} className={btnPrimario}>Continuar <ArrowRight size={14} /></button>}
          </div>
        </div>
      )}

      {/* ── Paso 3: cómo seguimos ──────────────────────────────────── */}
      {paso === 3 && origen && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { v: 'cotizar', icon: Scale, t: 'Pedir cotización', d: 'A uno o varios proveedores. Después comparás y elegís.', cls: 'border-sky-300 bg-sky-50/60 text-sky-900' },
              { v: 'directa', icon: Zap,   t: 'Comprar directo',  d: 'Ya sabés a quién: generá la orden de compra ahora.',   cls: 'border-emerald-300 bg-emerald-50/60 text-emerald-900' },
              { v: 'guardar', icon: Save,  t: 'Solo guardar',     d: 'Queda como solicitud abierta para resolver después.',  cls: 'border-gray-300 bg-gray-50 text-gray-800' },
            ] as const).map(o => (
              <button key={o.v} onClick={() => setSiguiente(o.v)}
                className={cn('flex items-start gap-3 p-3 rounded-xl border-2 text-left min-h-[80px]', o.cls, siguiente === o.v ? 'ring-2 ring-lime-500 border-lime-500' : 'hover:border-gray-400')}>
                <o.icon size={20} className="shrink-0 mt-0.5" />
                <div><p className="text-sm font-bold">{o.t}</p><p className="text-xs opacity-80">{o.d}</p></div>
              </button>
            ))}
          </div>

          {siguiente === 'cotizar' && (
            <SectionCard title="Proveedores a invitar" icon={Scale}>
              <SelectorProveedores proveedores={proveedores} seleccionados={provSel} onChange={setProvSel} sugeridoId={proveedorSugeridoId || null} />
              <div className="mt-3 sm:max-w-xs"><label className={lblCls}>Responder antes del</label><input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} className={inpCls} /></div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setPaso(2)} className={btnSecundario}><ArrowLeft size={14} /> Volver</button>
                <button onClick={() => guardar('cotizar')} disabled={!provSel.length || guardando} className={btnPrimario}>{guardando ? 'Creando…' : `Crear solicitud y cotización (${provSel.length} prov.)`}</button>
              </div>
            </SectionCard>
          )}

          {siguiente === 'directa' && (
            <SectionCard title="Orden de compra directa" icon={Zap}>
              <FormOrden
                items={itemsIncluidos.map(i => ({ id: i._key, descripcion: i.descripcion, cantidad: parseFloat(i.cantidad) || 1, unidad: i.unidad, costo_referencia: i.costo_referencia ?? null, especificaciones: i.especificaciones }))}
                sugeridoId={proveedorSugeridoId || null}
                onSubmit={p => guardar('directa', p)} onCancel={() => setPaso(2)} enviando={guardando} labelSubmit="Crear solicitud y orden"
              />
            </SectionCard>
          )}

          {siguiente === 'guardar' && (
            <div className="flex justify-end gap-2">
              <button onClick={() => setPaso(2)} className={btnSecundario}><ArrowLeft size={14} /> Volver</button>
              <button onClick={() => guardar('guardar')} disabled={guardando} className={btnPrimario}><Save size={14} /> {guardando ? 'Guardando…' : 'Guardar solicitud'}</button>
            </div>
          )}
          {!siguiente && <div className="flex justify-start"><button onClick={() => setPaso(2)} className={btnSecundario}><ArrowLeft size={14} /> Volver</button></div>}
        </div>
      )}

      {galeria && (
        <ModalCatalogoProductos
          productos={productos} loading={productosLoading}
          onSelect={p => preparar({ producto_id: p.id, cantidad: 1 })}
          onAgregar={p => preparar({ producto_id: p.id, cantidad: 1 })}
          cantidadEnCarrito={p => items.filter(i => i.producto_id === p.id).reduce((a, i) => a + (parseFloat(i.cantidad) || 0), 0)}
          itemsEnCarrito={items.length}
          onClose={() => setGaleria(false)}
        />
      )}
    </div>
  );
}
