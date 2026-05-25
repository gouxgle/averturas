import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, ShoppingCart, Truck, Package,
  RefreshCw, Plus, Trash2, MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────

interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  activo: boolean;
}

interface OperacionAprobada {
  id: string;
  numero: string;
  precio_total: number;
  proveedor_id: string | null;
  proveedor_nombre?: string | null;
  cobrado_total?: number;
  cliente: {
    nombre: string | null;
    apellido: string | null;
    razon_social: string | null;
    tipo_persona: 'fisica' | 'juridica';
  };
}

interface OperacionItem {
  id: string;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  producto_id?: string | null;
  tipo_abertura_nombre?: string;
  sistema_nombre?: string;
  producto_proveedor_sku?: string | null;
}

interface OperacionDetalle {
  id: string;
  numero: string;
  precio_total: number;
  proveedor_id: string | null;
  items: OperacionItem[];
  cliente: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    razon_social: string | null;
    tipo_persona: 'fisica' | 'juridica';
    telefono: string | null;
  };
}

interface PedidoItemForm {
  operacion_item_id?: string;
  producto_id?: string;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  proveedor_sku?: string | null;
  precio_de_lista?: boolean;
}

interface PreciosMapa {
  bySku: Record<string, number>;
  byProductoId: Record<string, number>;
}

// ── Helpers ────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

// Busca precio en lista del proveedor: primero por producto_id (FK directo), luego por SKU
function resolverPrecio(precios: PreciosMapa, productoId: string | null | undefined, sku: string | null | undefined): number | null {
  if (productoId && precios.byProductoId[productoId] != null) return precios.byProductoId[productoId];
  if (sku && precios.bySku[sku] != null) return precios.bySku[sku];
  return null;
}

function buildPreciosMapa(lista: { sku: string; precio: number; producto_id: string | null }[]): PreciosMapa {
  const bySku: Record<string, number> = {};
  const byProductoId: Record<string, number> = {};
  for (const p of lista) {
    bySku[p.sku] = Number(p.precio);
    if (p.producto_id) byProductoId[p.producto_id] = Number(p.precio);
  }
  return { bySku, byProductoId };
}

function mapItemFromOp(oi: OperacionItem, precios: PreciosMapa): PedidoItemForm {
  const sku    = oi.producto_proveedor_sku ?? null;
  const precio = resolverPrecio(precios, oi.producto_id, sku);
  return {
    operacion_item_id: oi.id,
    producto_id:       oi.producto_id ?? undefined,
    descripcion:       oi.descripcion,
    cantidad:          oi.cantidad,
    costo_unitario:    precio ?? 0,
    proveedor_sku:     sku,
    precio_de_lista:   precio != null,
  };
}

// Input numérico con separador de miles. Muestra formateado en reposo, raw al editar.
function CostoInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  function handleFocus() {
    setFocused(true);
    setRaw(value > 0 ? String(value) : '');
  }

  function handleBlur() {
    setFocused(false);
    const n = parseFloat(raw.replace(',', '.')) || 0;
    onChange(n);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^\d,]/g, '');
    setRaw(val);
    onChange(parseFloat(val.replace(',', '.')) || 0);
  }

  const display = focused
    ? raw
    : value > 0 ? value.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '';

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder="0"
      className={className}
    />
  );
}

function nombreCliente(op: OperacionAprobada | OperacionDetalle) {
  const c = op.cliente;
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';
}

function SectionCard({
  title, icon: Icon, children, accent,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b rounded-t-xl',
        accent ?? 'bg-gray-50 border-gray-100',
      )}>
        <Icon size={13} className={accent ? 'opacity-70' : 'text-gray-400'} />
        <span className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          accent ? '' : 'text-gray-500',
        )}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function waTextoPedido(proveedor: Proveedor | null, items: PedidoItemForm[], operacion: OperacionAprobada | OperacionDetalle | null, fechaEst: string) {
  if (!proveedor) return '';
  const lineas = items.map(i => `- ${i.descripcion} x${i.cantidad}`).join('\n');
  const opRef  = operacion ? ` para Op. ${operacion.numero}` : '';
  const cliente = operacion ? ` — cliente: ${nombreCliente(operacion)}` : '';
  const fecha  = fechaEst ? `\nNecesito para: ${fechaEst}` : '';
  return `Hola ${proveedor.nombre}!\nTe hago el pedido${opRef}${cliente}:\n\n${lineas}${fecha}\nGracias!`;
}

// ── Componente principal ───────────────────────────────────────

export default function NuevoPedido() {
  const navigate     = useNavigate();
  const { id }       = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit       = Boolean(id);

  const urlOperacionId = searchParams.get('operacion_id');

  // Estado del formulario
  const [proveedorId,   setProveedorId]   = useState('');
  const [proveedorSel,  setProveedorSel]  = useState<Proveedor | null>(null);
  const [operacionId,   setOperacionId]   = useState(urlOperacionId ?? '');
  const [operacionSel,  setOperacionSel]  = useState<OperacionAprobada | null>(null);
  const [items,         setItems]         = useState<PedidoItemForm[]>([
    { descripcion: '', cantidad: 1, costo_unitario: 0 },
  ]);
  const [fechaPedido,   setFechaPedido]   = useState(new Date().toISOString().split('T')[0]);
  const [fechaEst,      setFechaEst]      = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [notas,         setNotas]         = useState('');

  // Estado de UI
  const [saving,        setSaving]        = useState(false);
  const [savedId,       setSavedId]       = useState<string | null>(null);
  const [savedNumero,   setSavedNumero]   = useState('');

  // Búsqueda proveedores
  const [busqProv,  setBusqProv]  = useState('');
  const [provs,     setProvs]     = useState<Proveedor[]>([]);
  const [showProvs, setShowProvs] = useState(false);
  const provRef = useRef<HTMLDivElement>(null);

  // Búsqueda operaciones
  const [busqOp,   setBusqOp]   = useState('');
  const [ops,      setOps]      = useState<OperacionAprobada[]>([]);
  const [showOps,  setShowOps]  = useState(false);
  const opRef = useRef<HTMLDivElement>(null);

  const [loadingOp, setLoadingOp] = useState(false);

  // Lista de operaciones disponibles (aprobadas con pago, sin pedido)
  const [opsDisponibles,        setOpsDisponibles]        = useState<OperacionAprobada[]>([]);
  const [loadingOpsDisponibles, setLoadingOpsDisponibles] = useState(false);

  // Mapas de precios del proveedor: bySku y byProductoId
  const [preciosProveedor, setPreciosProveedor] = useState<PreciosMapa>({ bySku: {}, byProductoId: {} });

  // ── Cargar precios cuando cambia proveedor + re-pricear items de operacion ──
  useEffect(() => {
    if (!proveedorId) { setPreciosProveedor({ bySku: {}, byProductoId: {} }); return; }
    api.get<{ sku: string; precio: number; producto_id: string | null }[]>(
      `/catalogo/proveedor-precios?proveedor_id=${proveedorId}&activo=true`
    ).then(lista => {
      const nuevos = buildPreciosMapa(lista);
      setPreciosProveedor(nuevos);
      // Re-aplicar precios a items cargados desde operacion
      setItems(prev => prev.map(item => {
        if (!item.operacion_item_id) return item;
        const precio = resolverPrecio(nuevos, item.producto_id, item.proveedor_sku);
        if (precio == null) return { ...item, precio_de_lista: false };
        return { ...item, costo_unitario: precio, precio_de_lista: true };
      }));
    }).catch(() => {});
  }, [proveedorId]);

  // ── Cargar ops disponibles al montar (sin URL param, sin edición) ──
  useEffect(() => {
    if (urlOperacionId || isEdit) return;
    setLoadingOpsDisponibles(true);
    api.get<OperacionAprobada[]>('/pedidos/operaciones-disponibles')
      .then(setOpsDisponibles)
      .catch(() => {})
      .finally(() => setLoadingOpsDisponibles(false));
  }, [urlOperacionId, isEdit]);

  // ── Carga inicial si hay operacion_id en URL ──────────────────
  useEffect(() => {
    if (!urlOperacionId) return;
    (async () => {
      setLoadingOp(true);
      try {
        const op = await api.get<OperacionDetalle>(`/operaciones/${urlOperacionId}`);
        setOperacionId(op.id);
        setOperacionSel({
          id: op.id, numero: op.numero, precio_total: op.precio_total,
          proveedor_id: op.proveedor_id, cliente: op.cliente,
        });
        setBusqOp(op.numero);

        let preciosMapa: PreciosMapa = { bySku: {}, byProductoId: {} };
        if (op.proveedor_id) {
          setProveedorId(op.proveedor_id);
          try {
            const [prov, lista] = await Promise.all([
              api.get<Proveedor>(`/catalogo/proveedores/${op.proveedor_id}`),
              api.get<{ sku: string; precio: number; producto_id: string | null }[]>(
                `/catalogo/proveedor-precios?proveedor_id=${op.proveedor_id}&activo=true`
              ),
            ]);
            setProveedorSel(prov);
            setBusqProv(prov.nombre);
            preciosMapa = buildPreciosMapa(lista);
            setPreciosProveedor(preciosMapa);
          } catch { /* sin proveedor o sin precios */ }
        }

        if (op.items?.length) {
          setItems(op.items.map(oi => mapItemFromOp(oi, preciosMapa)));
        }
      } catch {
        toast.error('No se pudo cargar la operación');
      } finally {
        setLoadingOp(false);
      }
    })();
  }, [urlOperacionId]);

  // ── Carga para edición ────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return;
    api.get<{
      id: string; numero: string; proveedor_id: string; operacion_id: string | null;
      fecha_pedido: string; fecha_entrega_est: string | null; notas: string | null;
      proveedor: Proveedor;
      operacion: OperacionAprobada | null;
      items: (PedidoItemForm & { id: string })[];
    }>(`/pedidos/${id}`).then(p => {
      setProveedorId(p.proveedor_id);
      setProveedorSel(p.proveedor);
      setBusqProv(p.proveedor.nombre);
      if (p.operacion) {
        setOperacionId(p.operacion_id ?? '');
        setOperacionSel(p.operacion);
        setBusqOp(p.operacion.numero);
      }
      setItems(p.items.map(i => ({
        operacion_item_id: i.operacion_item_id,
        producto_id: i.producto_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        costo_unitario: i.costo_unitario,
      })));
      setFechaPedido(p.fecha_pedido);
      if (p.fecha_entrega_est) setFechaEst(p.fecha_entrega_est);
      setNotas(p.notas ?? '');
    }).catch(() => toast.error('Error al cargar el pedido'));
  }, [isEdit, id]);

  // ── Búsqueda proveedores ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!busqProv.trim()) { setProvs([]); return; }
      try {
        const data = await api.get<Proveedor[]>(`/catalogo/proveedores?search=${encodeURIComponent(busqProv)}&activo=true`);
        setProvs(data);
      } catch { setProvs([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [busqProv]);

  // ── Búsqueda operaciones aprobadas ────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!busqOp.trim()) { setOps([]); return; }
      try {
        const data = await api.get<OperacionAprobada[]>(
          `/operaciones?estado=aprobado&search=${encodeURIComponent(busqOp)}`
        );
        setOps(data);
      } catch { setOps([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [busqOp]);

  // ── Seleccionar op disponible ─────────────────────────────────
  async function seleccionarOp(op: OperacionAprobada) {
    setOperacionId(op.id);
    setOperacionSel(op);
    setBusqOp(op.numero);
    try {
      const det = await api.get<OperacionDetalle>(`/operaciones/${op.id}`);

      // Asegurar proveedor cargado antes de mapear precios
      let preciosMapa: PreciosMapa = preciosProveedor;
      if (det.proveedor_id && !proveedorId) {
        const prov = await api.get<Proveedor>(`/catalogo/proveedores/${det.proveedor_id}`);
        setProveedorId(prov.id);
        setProveedorSel(prov);
        setBusqProv(prov.nombre);
        try {
          const lista = await api.get<{ sku: string; precio: number; producto_id: string | null }[]>(
            `/catalogo/proveedor-precios?proveedor_id=${prov.id}&activo=true`
          );
          preciosMapa = buildPreciosMapa(lista);
          setPreciosProveedor(preciosMapa);
        } catch { /* sin precios */ }
      }

      if (det.items?.length) {
        setItems(det.items.map(oi => mapItemFromOp(oi, preciosMapa)));
      }
    } catch { /* op sin items */ }
  }

  // ── Items helpers ─────────────────────────────────────────────
  function updateItem(idx: number, field: keyof PedidoItemForm, value: string | number) {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  }

  function addItem() {
    setItems(prev => [...prev, { descripcion: '', cantidad: 1, costo_unitario: 0 }]);
  }

  function removeItem(idx: number) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const montoItems  = items.reduce((acc, i) => acc + (i.costo_unitario || 0) * (i.cantidad || 1), 0);
  const costoEnvio  = montoItems > 0 ? Math.round(montoItems * 0.10) : 0;
  const montoTotal  = montoItems + costoEnvio;

  // ── Guardar ───────────────────────────────────────────────────
  async function handleSave() {
    if (!proveedorId) { toast.error('Seleccioná un proveedor'); return; }
    if (items.some(i => !i.descripcion.trim())) { toast.error('Completá la descripción de todos los items'); return; }
    if (items.some(i => i.cantidad < 1)) { toast.error('La cantidad debe ser mayor a 0'); return; }

    setSaving(true);
    try {
      const payload = {
        proveedor_id:    proveedorId,
        operacion_id:    operacionId || null,
        fecha_pedido:    fechaPedido,
        fecha_entrega_est: fechaEst || null,
        notas:           notas || null,
        costo_envio:     costoEnvio,
        items:           items.map(i => ({
          operacion_item_id: i.operacion_item_id || null,
          producto_id:       i.producto_id || null,
          descripcion:       i.descripcion,
          cantidad:          i.cantidad,
          costo_unitario:    i.costo_unitario,
        })),
      };

      if (isEdit && id) {
        await api.put(`/pedidos/${id}`, payload);
        toast.success('Pedido actualizado');
        navigate('/pedidos');
      } else {
        const { id: newId, numero } = await api.post<{ id: string; numero: string }>('/pedidos', payload);
        setSavedId(newId);
        setSavedNumero(numero);
        toast.success(`Pedido ${numero} creado`);
      }
    } catch {
      toast.error('Error al guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  // ── Post-guardado ─────────────────────────────────────────────
  if (savedId) {
    const waText = waTextoPedido(proveedorSel, items, operacionSel, fechaEst);
    const waNum  = proveedorSel?.telefono?.replace(/\D/g, '') ?? '';
    const waUrl  = waNum
      ? `https://wa.me/${waNum.startsWith('54') ? waNum : '54' + waNum}?text=${encodeURIComponent(waText)}`
      : null;

    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={28} className="text-lime-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Pedido creado</h2>
          <p className="text-gray-500 text-sm mb-6">{savedNumero}</p>

          <div className="space-y-3">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 text-white font-semibold py-3 rounded-xl hover:bg-green-600 transition-colors"
              >
                <MessageCircle size={18} />
                Enviar por WhatsApp al proveedor
              </a>
            )}
            <button
              onClick={() => navigate(`/pedidos`)}
              className="flex items-center justify-center gap-2 w-full bg-lime-500 text-white font-semibold py-3 rounded-xl hover:bg-lime-600 transition-colors"
            >
              Ver pedidos
            </button>
            {operacionId && (
              <button
                onClick={() => navigate(`/presupuestos`)}
                className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Volver a presupuestos
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loadingOp) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-lime-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 xl:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/pedidos')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Editar pedido' : 'Nuevo pedido al proveedor'}
          </h1>
          <p className="text-sm text-gray-500">Orden de compra</p>
        </div>
      </div>

      <div className="space-y-4">

        {/* Proveedor */}
        <SectionCard title="Proveedor *" icon={Truck}>
          {proveedorSel ? (
            <div className="flex items-center justify-between p-3 bg-lime-50 rounded-xl border border-lime-100">
              <div>
                <p className="font-semibold text-gray-900">{proveedorSel.nombre}</p>
                {proveedorSel.contacto && <p className="text-sm text-gray-500">{proveedorSel.contacto}</p>}
                {proveedorSel.telefono && <p className="text-sm text-gray-500">{proveedorSel.telefono}</p>}
              </div>
              <button
                onClick={() => { setProveedorSel(null); setProveedorId(''); setBusqProv(''); }}
                className="p-1.5 rounded-lg hover:bg-lime-100 text-gray-400"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative" ref={provRef}>
              <input
                value={busqProv}
                onChange={e => { setBusqProv(e.target.value); setShowProvs(true); }}
                onFocus={() => setShowProvs(true)}
                onBlur={() => setTimeout(() => setShowProvs(false), 150)}
                placeholder="Buscar proveedor..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
              {showProvs && provs.length > 0 && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {provs.map(prov => (
                    <button
                      key={prov.id}
                      onMouseDown={() => {
                        setProveedorId(prov.id);
                        setProveedorSel(prov);
                        setBusqProv(prov.nombre);
                        setShowProvs(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-lime-50 border-b border-gray-50 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{prov.nombre}</p>
                      {prov.telefono && <p className="text-xs text-gray-400">{prov.telefono}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Operación vinculada */}
        <SectionCard title="Operación vinculada (opcional)" icon={Package}>
          {operacionSel ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div>
                <p className="font-semibold text-gray-900">{operacionSel.numero}</p>
                <p className="text-sm text-gray-500">{nombreCliente(operacionSel)}</p>
                {operacionSel.proveedor_nombre && (
                  <p className="text-xs text-blue-500">Proveedor: {operacionSel.proveedor_nombre}</p>
                )}
              </div>
              {!urlOperacionId && (
                <button
                  onClick={() => { setOperacionSel(null); setOperacionId(''); setBusqOp(''); setItems([{ descripcion: '', cantidad: 1, costo_unitario: 0 }]); }}
                  className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Lista de ops disponibles */}
              {!isEdit && (
                loadingOpsDisponibles ? (
                  <p className="text-xs text-gray-400 text-center py-2">Cargando operaciones disponibles...</p>
                ) : opsDisponibles.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Listas para pedir ({opsDisponibles.length})
                    </p>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {opsDisponibles.map(op => (
                        <button
                          key={op.id}
                          onClick={() => seleccionarOp(op)}
                          className="w-full text-left px-3 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-semibold text-blue-700">{op.numero}</p>
                            {op.cobrado_total != null && op.cobrado_total > 0 && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                                Cobrado {formatCurrency(Number(op.cobrado_total))}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{nombreCliente(op)}</p>
                          {op.proveedor_nombre && (
                            <p className="text-[10px] text-gray-400">{op.proveedor_nombre}</p>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                      O buscá otra operación abajo
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-1">
                    Sin operaciones pendientes de pedido
                  </p>
                )
              )}

              {/* Búsqueda manual */}
              <div className="relative" ref={opRef}>
                <input
                  value={busqOp}
                  onChange={e => { setBusqOp(e.target.value); setShowOps(true); }}
                  onFocus={() => setShowOps(true)}
                  onBlur={() => setTimeout(() => setShowOps(false), 150)}
                  placeholder="Buscar por número o cliente..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {showOps && ops.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {ops.map(op => (
                      <button
                        key={op.id}
                        onMouseDown={async () => {
                          setShowOps(false);
                          await seleccionarOp(op);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{op.numero}</p>
                        <p className="text-xs text-gray-500">{nombreCliente(op)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Items */}
        <SectionCard title="Items del pedido *" icon={Package}>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {item.proveedor_sku && (
                      <p className="text-[10px] text-lime-700 bg-lime-50 border border-lime-100 rounded px-2 py-0.5">
                        Ref: <span className="font-mono font-semibold">{item.proveedor_sku}</span>
                      </p>
                    )}
                    {item.operacion_item_id && item.precio_de_lista && (
                      <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 font-semibold">
                        ✓ Precio de lista
                      </p>
                    )}
                    {item.operacion_item_id && !item.precio_de_lista && proveedorId && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-0.5 font-semibold">
                        ⚠ Sin precio en lista — ingresar manualmente
                      </p>
                    )}
                  </div>
                  <input
                    value={item.descripcion}
                    onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                    placeholder="Descripción del producto"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-0.5">Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={e => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-0.5">Costo unitario</label>
                      <CostoInput
                        value={item.costo_unitario}
                        onChange={v => updateItem(idx, 'costo_unitario', v)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
                      />
                    </div>
                  </div>
                  {item.costo_unitario > 0 && (
                    <p className="text-[11px] text-gray-500 text-right">
                      Subtotal: {formatCurrency(item.costo_unitario * item.cantidad)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 disabled:opacity-0 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={addItem}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 text-gray-500 text-sm py-2.5 rounded-xl hover:border-lime-400 hover:text-lime-600 transition-colors"
            >
              <Plus size={14} />
              Agregar ítem
            </button>

            {montoItems > 0 && (
              <div className="pt-2 border-t border-gray-200 space-y-1.5">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Subtotal productos</span>
                  <span>{formatCurrency(montoItems)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Costo de envío (10%)</span>
                  <span>{formatCurrency(costoEnvio)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Total al proveedor</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(montoTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Fecha y notas */}
        <SectionCard title="Fecha y notas" icon={ShoppingCart}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha del pedido</label>
              <input
                type="date"
                value={fechaPedido}
                onChange={e => setFechaPedido(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Entrega estimada</label>
              <input
                type="date"
                value={fechaEst}
                onChange={e => setFechaEst(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
              />
              <p className="text-[10px] text-gray-400 mt-1">Por defecto: 3 días hábiles</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notas internas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Instrucciones, especificaciones adicionales..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200 resize-none"
            />
          </div>
        </SectionCard>

        {/* Resumen y guardar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-lime-500 text-white font-semibold py-3 rounded-xl hover:bg-lime-600 disabled:opacity-50 transition-colors"
            >
              {saving
                ? <RefreshCw size={16} className="animate-spin" />
                : <Save size={16} />}
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear pedido'}
            </button>
            <button
              onClick={() => navigate('/pedidos')}
              className="sm:w-32 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
