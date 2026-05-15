import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Boxes, Plus, Minus, AlertTriangle, TrendingDown, TrendingUp,
  ChevronDown, ChevronUp, Package, Truck, RotateCcw,
  Wrench, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle,
  History, X, Check, Info, Layers, Zap, BarChart2,
  ChevronLeft, ChevronRight, DollarSign
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { MontoInput } from '@/components/MontoInput';

// ── Tipos ─────────────────────────────────────────────────────
interface ProductoExistencias {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo: 'estandar' | 'a_medida' | 'fabricacion_propia';
  color: string | null;
  imagen_url: string | null;
  stock_minimo: number;
  stock_inicial: number;
  stock_actual: number;
  precio_base: number | null;
  costo_base: number | null;
  tipo_abertura: { id: string; nombre: string } | null;
  sistema: { id: string; nombre: string } | null;
  ventas_30d: number;
  entradas_30d: number;
  ultima_venta_fecha: string | null;
  dias_sin_movimiento: number;
  valor_stock: number;
  estado: 'critico' | 'bajo' | 'justo' | 'ok';
  rotacion: 'alta' | 'media' | 'baja';
}

interface TableroData {
  productos: ProductoExistencias[];
  stats: {
    critico_count: number;
    bajo_minimo_count: number;
    valor_total_stock: number;
    sin_movimiento_count: number;
    activos_count: number;
  };
  alertas: ProductoExistencias[];
  analisis: { alta: number; media: number; baja: number };
  movimiento_30d: { entradas: number; salidas: number; productos_vendidos: number };
}

// tipos para modales (compatible con ProductoExistencias)
interface ProductoStock {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo: 'estandar' | 'a_medida' | 'fabricacion_propia';
  color: string | null;
  imagen_url: string | null;
  stock_minimo: number;
  stock_inicial: number;
  stock_actual: number;
  total_ingresado: number;
  total_egresado: number;
  precio_base: number | null;
  costo_base: number | null;
  tipo_abertura: { id: string; nombre: string } | null;
  sistema: { id: string; nombre: string } | null;
}

interface Proveedor { id: string; nombre: string }

interface LoteItem {
  producto_id: string;
  nombre: string;
  tipo_abertura: string | null;
  cantidad_ingresada: number;
  cantidad_egresada: number;
  stock_remanente: number;
  costo_unitario: number | null;
}

interface Lote {
  id: string;
  numero: string;
  fecha_ingreso: string;
  remito_nro: string | null;
  factura_nro: string | null;
  proveedor_nombre: string | null;
  notas: string | null;
  items: LoteItem[];
}

interface LoteSelect {
  id: string;
  numero: string;
  fecha_ingreso: string;
  remito_nro: string | null;
  proveedor_nombre: string | null;
}

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number | null;
  motivo: string | null;
  notas: string | null;
  referencia_nro: string | null;
  created_at: string;
  lote_numero: string | null;
  lote_fecha: string | null;
  lote_remito: string | null;
  proveedor_nombre: string | null;
  operacion_numero: string | null;
}

// ── Constantes ────────────────────────────────────────────────
const PER_PAGE = 10;

const TIPO_MOV: Record<string, { label: string; icon: React.FC<{ size?: number; className?: string }>; color: string; bg: string }> = {
  ingreso:        { label: 'Ingreso',        icon: ArrowDownCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  egreso_remito:  { label: 'Egreso remito',  icon: Truck,           color: 'text-blue-600',    bg: 'bg-blue-50' },
  egreso_retiro:  { label: 'Retiro local',   icon: ArrowUpCircle,   color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  devolucion:     { label: 'Devolución',     icon: RotateCcw,       color: 'text-amber-600',   bg: 'bg-amber-50' },
  ajuste:         { label: 'Ajuste',         icon: Wrench,          color: 'text-gray-600',    bg: 'bg-gray-100' },
};

const ESTADO_CFG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  critico: { label: 'Crítico', bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-l-red-500',     dot: 'bg-red-500' },
  bajo:    { label: 'Bajo',    bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-l-amber-400',   dot: 'bg-amber-400' },
  justo:   { label: 'Justo',   bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-l-yellow-400',  dot: 'bg-yellow-400' },
  ok:      { label: 'OK',      bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-l-emerald-400', dot: 'bg-emerald-500' },
};

const ROTACION_CFG: Record<string, { label: string; bg: string; text: string }> = {
  alta:  { label: 'Alta',  bg: 'bg-emerald-100', text: 'text-emerald-700' },
  media: { label: 'Media', bg: 'bg-blue-100',    text: 'text-blue-700' },
  baja:  { label: 'Baja',  bg: 'bg-gray-100',    text: 'text-gray-600' },
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtMonto(n: number) {
  return `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── DonutChart ────────────────────────────────────────────────
function DonutChart({ segments, size = 80 }: { segments: { value: number; color: string }[]; size?: number }) {
  const r    = size * 0.37;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;
  const cy   = size / 2;
  const total = segments.reduce((s, g) => s + g.value, 0);

  if (total === 0) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.12} />
    </svg>
  );

  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const pct  = seg.value / total;
        const dash = pct * circ;
        const el   = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={size * 0.12}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-(cumulative * circ)}
          />
        );
        cumulative += pct;
        return el;
      })}
    </svg>
  );
}

// ── ModalIngreso ──────────────────────────────────────────────
function ModalIngreso({
  productos, proveedores, onClose, onSaved, productoPreseleccionado
}: {
  productos: ProductoStock[];
  proveedores: Proveedor[];
  onClose: () => void;
  onSaved: () => void;
  productoPreseleccionado?: string;
}) {
  const [productoId, setProductoId] = useState(productoPreseleccionado ?? '');
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
  const [remitoNro, setRemitoNro] = useState('');
  const [facturaNro, setFacturaNro] = useState('');
  const [notasLote, setNotasLote] = useState('');
  const [notas, setNotas] = useState('');
  const [loteMode, setLoteMode] = useState<'nuevo' | 'existente'>('nuevo');
  const [loteId, setLoteId] = useState('');
  const [lotes, setLotes] = useState<LoteSelect[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loteMode === 'existente' && productoId) {
      api.get<LoteSelect[]>(`/stock/lotes/producto/${productoId}`).then(data => setLotes(data)).catch(() => setLotes([]));
    }
  }, [loteMode, productoId]);

  async function handleSave() {
    if (!productoId) { setError('Seleccioná un producto'); return; }
    if (!cantidad || parseInt(cantidad) <= 0) { setError('Cantidad debe ser > 0'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/stock/ingresar', {
        producto_id:    productoId,
        cantidad:       parseInt(cantidad),
        costo_unitario: costoUnitario ? parseFloat(costoUnitario) : null,
        proveedor_id:   proveedorId   || null,
        fecha_ingreso:  fechaIngreso,
        remito_nro:     remitoNro     || null,
        factura_nro:    facturaNro    || null,
        notas_lote:     notasLote     || null,
        notas:          notas         || null,
        lote_id:        loteMode === 'existente' ? loteId || null : null,
      });
      toast.success('Ingreso de stock registrado');
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al guardar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ArrowDownCircle size={18} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Ingreso de stock</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Producto *</label>
            <select value={productoId} onChange={e => setProductoId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Seleccioná un producto</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.codigo ? ` (${p.codigo})` : ''} — stock: {p.stock_actual}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Cantidad *</label>
              <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Costo unitario</label>
              <MontoInput value={costoUnitario} onChange={setCostoUnitario}
                placeholder="0,00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Lote de ingreso</label>
            <div className="flex gap-2 mb-3">
              {(['nuevo', 'existente'] as const).map(m => (
                <button key={m} onClick={() => setLoteMode(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    loteMode === m
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                  }`}>
                  {m === 'nuevo' ? 'Crear nuevo lote' : 'Lote existente'}
                </button>
              ))}
            </div>

            {loteMode === 'existente' ? (
              <select value={loteId} onChange={e => setLoteId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Seleccioná un lote</option>
                {lotes.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.numero} — {fmtFecha(l.fecha_ingreso)}{l.remito_nro ? ` (R: ${l.remito_nro})` : ''}{l.proveedor_nombre ? ` — ${l.proveedor_nombre}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3 p-3 bg-gray-50 rounded-xl">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Proveedor</label>
                  <select value={proveedorId} onChange={e => setProveedorId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso</label>
                  <input type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">N° Remito</label>
                    <input value={remitoNro} onChange={e => setRemitoNro(e.target.value)} placeholder="R-0001"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">N° Factura</label>
                    <input value={facturaNro} onChange={e => setFacturaNro(e.target.value)} placeholder="FA-0001"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas del lote</label>
                  <input value={notasLote} onChange={e => setNotasLote(e.target.value)} placeholder="Observaciones opcionales"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas del movimiento</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar ingreso
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModalEgreso ───────────────────────────────────────────────
function ModalEgreso({
  productos, onClose, onSaved, productoPreseleccionado
}: {
  productos: ProductoStock[];
  onClose: () => void;
  onSaved: () => void;
  productoPreseleccionado?: string;
}) {
  const [productoId, setProductoId] = useState(productoPreseleccionado ?? '');
  const [tipo, setTipo] = useState<'egreso_remito' | 'egreso_retiro' | 'devolucion'>('egreso_remito');
  const [cantidad, setCantidad] = useState('');
  const [referenciaId, setReferenciaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const conStock = productos.filter(p => p.stock_actual > 0);
  const selected = conStock.find(p => p.id === productoId);

  const TIPOS_EGRESO = [
    { key: 'egreso_remito',  label: 'Remito',     icon: Truck,     desc: 'Entrega con remito' },
    { key: 'egreso_retiro',  label: 'Retiro',     icon: Package,   desc: 'Retiro en local' },
    { key: 'devolucion',     label: 'Devolución', icon: RotateCcw, desc: 'Dev. por falla o cambio' },
  ] as const;

  async function handleSave() {
    if (!productoId) { setError('Seleccioná un producto'); return; }
    if (!cantidad || parseInt(cantidad) <= 0) { setError('Cantidad debe ser > 0'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/stock/egresar', {
        producto_id:    productoId,
        tipo,
        cantidad:       parseInt(cantidad),
        referencia_nro: referenciaId || null,
        motivo:         motivo       || null,
        notas:          notas        || null,
      });
      toast.success('Egreso de stock registrado');
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al guardar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <ArrowUpCircle size={18} className="text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Egreso de stock</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de egreso *</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_EGRESO.map(t => (
                <button key={t.key} onClick={() => setTipo(t.key as typeof tipo)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    tipo === t.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}>
                  <t.icon size={16} className={`mx-auto mb-1 ${tipo === t.key ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className={`text-xs font-medium ${tipo === t.key ? 'text-blue-700' : 'text-gray-600'}`}>{t.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Producto *</label>
            <select value={productoId} onChange={e => setProductoId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccioná un producto</option>
              {conStock.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.codigo ? ` (${p.codigo})` : ''} — stock: {p.stock_actual}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Cantidad *
              {selected && <span className="text-gray-400 font-normal ml-1">(disponible: {selected.stock_actual})</span>}
            </label>
            <input type="number" min="1" max={selected?.stock_actual ?? undefined}
              value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {tipo === 'egreso_remito' ? 'N° Remito' : tipo === 'devolucion' ? 'N° referencia' : 'Referencia'}
            </label>
            <input value={referenciaId} onChange={e => setReferenciaId(e.target.value)} placeholder="Opcional"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {tipo === 'devolucion' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Motivo de devolución</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Seleccioná motivo</option>
                <option value="falla_producto">Falla del producto</option>
                <option value="cambio_temporada">Cambio de temporada</option>
                <option value="renovacion">Renovación de stock</option>
                <option value="error_pedido">Error en pedido</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar egreso
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModalAjuste ───────────────────────────────────────────────
function ModalAjuste({
  productos, onClose, onSaved, productoPreseleccionado
}: {
  productos: ProductoStock[];
  onClose: () => void;
  onSaved: () => void;
  productoPreseleccionado?: string;
}) {
  const [productoId, setProductoId] = useState(productoPreseleccionado ?? '');
  const [modo, setModo] = useState<'absoluto' | 'delta'>('absoluto');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('Ajuste manual');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = productos.find(p => p.id === productoId);
  const delta = selected && valor !== '' ? (
    modo === 'absoluto'
      ? parseInt(valor) - selected.stock_actual
      : parseInt(valor)
  ) : null;

  async function handleSave() {
    if (!productoId) { setError('Seleccioná un producto'); return; }
    if (valor === '') { setError('Ingresá un valor'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/stock/ajustar', {
        producto_id: productoId,
        cantidad:    delta,
        motivo:      motivo || 'Ajuste manual',
        notas:       notas  || null,
      });
      toast.success('Ajuste registrado');
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Error al guardar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <Wrench size={18} className="text-gray-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Ajuste de inventario</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Producto *</label>
            <select value={productoId} onChange={e => setProductoId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="">Seleccioná un producto</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.codigo ? ` (${p.codigo})` : ''} — stock: {p.stock_actual}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Modo de ajuste</label>
            <div className="flex gap-2">
              {(['absoluto', 'delta'] as const).map(m => (
                <button key={m} onClick={() => { setModo(m); setValor(''); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    modo === m ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {m === 'absoluto' ? 'Stock final' : 'Diferencia (+/-)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {modo === 'absoluto' ? 'Ingresá el total de unidades que hay físicamente.' : 'Ingresá +N para sumar o -N para restar.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {modo === 'absoluto' ? 'Stock final *' : 'Diferencia *'}
            </label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)}
              placeholder={modo === 'absoluto' ? '0' : '+5 o -3'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>

          {selected && delta !== null && valor !== '' && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              delta === 0 ? 'bg-gray-50 text-gray-500' :
              delta > 0   ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              <Info size={14} />
              <span>
                Stock actual: <strong>{selected.stock_actual}</strong>
                {delta !== 0 && <> → nuevo: <strong>{selected.stock_actual + delta}</strong> ({delta > 0 ? '+' : ''}{delta})</>}
                {delta === 0 && <> — sin cambio</>}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="Ajuste manual">Ajuste manual</option>
              <option value="Recuento físico">Recuento físico</option>
              <option value="Merma o rotura">Merma o rotura</option>
              <option value="Vencimiento">Vencimiento</option>
              <option value="Corrección de ingreso">Corrección de ingreso</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || delta === 0}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Aplicar ajuste
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MovimientosPanel ──────────────────────────────────────────
function MovimientosPanel({ productoId }: { productoId: string }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Movimiento[]>(`/stock/producto/${productoId}/movimientos`)
      .then(data => setMovimientos(data))
      .finally(() => setLoading(false));
  }, [productoId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <RefreshCw size={14} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (movimientos.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">Sin movimientos registrados</p>;
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {movimientos.map(m => {
        const def  = TIPO_MOV[m.tipo] ?? TIPO_MOV.ajuste;
        const Icon = def.icon;
        return (
          <div key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${def.bg}`}>
              <Icon size={11} className={def.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${m.cantidad > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                </span>
                <span className="text-xs text-gray-500">{def.label}</span>
                {m.lote_numero && <span className="text-xs text-gray-400">· {m.lote_numero}</span>}
                {m.proveedor_nombre && <span className="text-xs text-gray-400">· {m.proveedor_nombre}</span>}
                {m.operacion_numero && <span className="text-xs text-gray-400">· Op. {m.operacion_numero}</span>}
              </div>
              {m.motivo && <p className="text-[10px] text-gray-400">{m.motivo}</p>}
            </div>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtFecha(m.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── LotesTab ──────────────────────────────────────────────────
function LotesTab({ onNuevoIngreso }: { onNuevoIngreso: () => void }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs   = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const data = await api.get<Lote[]>(`/stock/lotes${qs}`);
      setLotes(data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { cargar(); }, [cargar]);

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const fmt = (n: number) =>
    `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, remito o proveedor..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500" title="Actualizar">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={onNuevoIngreso}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
          <Plus size={14} /> Nuevo ingreso
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-gray-400" />
        </div>
      ) : lotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Layers size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">No hay lotes registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lotes.map(lote => {
            const totalIngresado = lote.items.reduce((s, it) => s + it.cantidad_ingresada, 0);
            const totalEgresado  = lote.items.reduce((s, it) => s + it.cantidad_egresada,  0);
            const totalRemanente = lote.items.reduce((s, it) => s + it.stock_remanente,     0);
            const tipos    = [...new Set(lote.items.map(it => it.tipo_abertura).filter(Boolean))];
            const pctUsado = totalIngresado > 0 ? Math.min(100, (totalEgresado / totalIngresado) * 100) : 0;
            const isOpen   = expanded[lote.id];

            return (
              <div key={lote.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggle(lote.id)}>
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Layers size={18} className="text-orange-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-gray-900">{lote.numero}</span>
                      {tipos.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-medium">
                          {t}
                        </span>
                      ))}
                      {lote.proveedor_nombre && (
                        <span className="text-xs text-gray-400">{lote.proveedor_nombre}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{fmtFecha(lote.fecha_ingreso)}</span>
                      {lote.remito_nro  && <span>R: {lote.remito_nro}</span>}
                      {lote.factura_nro && <span>F: {lote.factura_nro}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0 text-right">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">Ingresado</div>
                      <div className="text-sm font-bold text-emerald-600">+{totalIngresado}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">Vendido</div>
                      <div className="text-sm font-bold text-blue-600">{totalEgresado}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">Remanente</div>
                      <div className={`text-sm font-bold ${totalRemanente <= 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {totalRemanente}
                      </div>
                    </div>
                    <div className="w-4">
                      {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pctUsado >= 100 ? 'bg-red-400' : pctUsado >= 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${pctUsado}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{Math.round(pctUsado)}% rotado</span>
                  </div>
                </div>

                {isOpen && lote.items.length > 0 && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                          <th className="text-center px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Ingresado</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vendido</th>
                          <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Remanente</th>
                          <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Costo unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lote.items.map((item, i) => (
                          <tr key={item.producto_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-4 py-2.5 text-sm text-gray-800">{item.nombre}</td>
                            <td className="px-3 py-2.5 text-center">
                              {item.tipo_abertura
                                ? <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md">{item.tipo_abertura}</span>
                                : <span className="text-xs text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm font-semibold text-emerald-600">+{item.cantidad_ingresada}</td>
                            <td className="px-3 py-2.5 text-right text-sm text-blue-600">{item.cantidad_egresada}</td>
                            <td className={`px-3 py-2.5 text-right text-sm font-bold ${item.stock_remanente <= 0 ? 'text-red-500' : 'text-gray-800'}`}>
                              {item.stock_remanente}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-400 font-mono">
                              {item.costo_unitario ? fmt(item.costo_unitario) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {lote.notas && (
                      <div className="px-4 py-2 text-xs text-gray-400 italic border-t border-gray-50">
                        {lote.notas}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ProductoRow ───────────────────────────────────────────────
function ProductoRow({
  producto, onIngreso, onEgreso, onAjuste
}: {
  producto: ProductoExistencias;
  onIngreso: () => void;
  onEgreso:  () => void;
  onAjuste:  () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const estadoCfg  = ESTADO_CFG[producto.estado];
  const rotCfg     = ROTACION_CFG[producto.rotacion];

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm border-l-4 ${estadoCfg.border} overflow-hidden`}>
      <div
        className="grid items-center gap-3 px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
        style={{ gridTemplateColumns: '1fr 65px 90px 80px 70px 100px 100px' }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Producto */}
        <div className="min-w-0 flex items-center gap-2.5">
          {/* Miniatura */}
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
            {producto.imagen_url ? (
              <img src={producto.imagen_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={16} className="text-gray-300" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{producto.nombre}</p>
              {producto.tipo !== 'estandar' && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                  producto.tipo === 'fabricacion_propia' ? 'bg-purple-50 text-purple-600' : 'bg-sky-50 text-sky-600'
                }`}>
                  {producto.tipo === 'fabricacion_propia' ? 'Fab.' : 'A medida'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              {producto.codigo && <span>{producto.codigo}</span>}
              {producto.tipo_abertura && <span>{producto.tipo_abertura.nombre}</span>}
              {producto.color && <span>{producto.color}</span>}
            </div>
          </div>
        </div>

        {/* Stock */}
        <div className="text-center">
          <span className={`text-lg font-bold ${estadoCfg.text}`}>{producto.stock_actual}</span>
          {producto.stock_minimo > 0 && (
            <p className="text-[10px] text-gray-400">mín {producto.stock_minimo}</p>
          )}
        </div>

        {/* Estado */}
        <div className="text-center">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${estadoCfg.bg} ${estadoCfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg.dot}`} />
            {estadoCfg.label}
          </span>
        </div>

        {/* Rotación */}
        <div className="text-center">
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${rotCfg.bg} ${rotCfg.text}`}>
            {rotCfg.label}
          </span>
        </div>

        {/* Ventas 30d */}
        <div className="text-center">
          <span className="text-sm font-semibold text-gray-700">{producto.ventas_30d}</span>
          <p className="text-[10px] text-gray-400">unidades</p>
        </div>

        {/* Valor stock */}
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-700">
            {producto.valor_stock > 0 ? fmtMonto(producto.valor_stock) : '—'}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onIngreso} title="Ingresar"
            className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors">
            <Plus size={14} />
          </button>
          <button onClick={onEgreso} disabled={producto.stock_actual <= 0} title="Egresar"
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <Minus size={14} />
          </button>
          <button onClick={onAjuste} title="Ajustar"
            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors">
            <Wrench size={13} />
          </button>
          <button onClick={() => setExpanded(v => !v)} title="Historial"
            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
            <History size={12} /> Últimos movimientos
          </p>
          <MovimientosPanel productoId={producto.id} />
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
type FiltroTab = 'todos' | 'critico' | 'bajo' | 'sin_movimiento';
type OrdenTab  = 'estado' | 'nombre' | 'ventas_30d' | 'stock_asc' | 'valor';

export function Stock() {
  const [tablero, setTablero]         = useState<TableroData | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<'existencias' | 'lotes'>('existencias');
  const [filtro, setFiltro]           = useState<FiltroTab>('todos');
  const [orden, setOrden]             = useState<OrdenTab>('estado');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [modal, setModal]             = useState<'ingreso' | 'egreso' | 'ajuste' | null>(null);
  const [ingresoProducto, setIngresoProducto] = useState<string | undefined>();
  const [egresoProducto, setEgresoProducto]   = useState<string | undefined>();
  const [ajusteProducto, setAjusteProducto]   = useState<string | undefined>();

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [tbl, provs] = await Promise.all([
        api.get<TableroData>('/stock/tablero'),
        api.get<Proveedor[]>('/catalogo/proveedores'),
      ]);
      setTablero(tbl);
      setProveedores(provs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // reset página cuando cambia filtro/búsqueda/orden
  useEffect(() => { setPage(1); }, [filtro, search, orden]);

  function abrirIngreso(id?: string) { setIngresoProducto(id); setModal('ingreso'); }
  function abrirEgreso(id?: string)  { setEgresoProducto(id);  setModal('egreso');  }
  function abrirAjuste(id?: string)  { setAjusteProducto(id);  setModal('ajuste');  }

  function onSaved() { setModal(null); cargar(); }

  // productos para modales
  const productosModal = useMemo((): ProductoStock[] =>
    (tablero?.productos ?? []).map(p => ({
      ...p,
      total_ingresado: p.entradas_30d,
      total_egresado:  p.ventas_30d,
    })),
  [tablero]);

  // lista filtrada + ordenada
  const filtered = useMemo(() => {
    let list = tablero?.productos ?? [];

    if (filtro === 'critico')        list = list.filter(p => p.estado === 'critico');
    else if (filtro === 'bajo')      list = list.filter(p => p.estado === 'bajo');
    else if (filtro === 'sin_movimiento') list = list.filter(p => p.dias_sin_movimiento >= 60);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo ?? '').toLowerCase().includes(q) ||
        (p.tipo_abertura?.nombre ?? '').toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (orden === 'nombre')     sorted.sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (orden === 'ventas_30d') sorted.sort((a, b) => b.ventas_30d - a.ventas_30d);
    if (orden === 'stock_asc')  sorted.sort((a, b) => a.stock_actual - b.stock_actual);
    if (orden === 'valor')      sorted.sort((a, b) => b.valor_stock - a.valor_stock);
    // 'estado' keeps backend order (worst first)

    return sorted;
  }, [tablero, filtro, search, orden]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = tablero?.stats;
  const anal  = tablero?.analisis ?? { alta: 0, media: 0, baja: 0 };
  const mov30 = tablero?.movimiento_30d;

  const FILTROS: { key: FiltroTab; label: string; count?: number; color?: string }[] = [
    { key: 'todos',          label: 'Todos',          count: stats?.activos_count },
    { key: 'critico',        label: 'Críticos',        count: stats?.critico_count,       color: 'text-red-600' },
    { key: 'bajo',           label: 'Bajo mínimo',     count: stats?.bajo_minimo_count,   color: 'text-amber-600' },
    { key: 'sin_movimiento', label: 'Sin movimiento',  count: stats?.sin_movimiento_count, color: 'text-gray-500' },
  ];

  // reposición sugerida (sidebar)
  const reposicion = useMemo(() =>
    (tablero?.productos ?? [])
      .filter(p => p.estado === 'critico' || p.estado === 'bajo')
      .slice(0, 5),
  [tablero]);

  return (
    <div className="p-6 flex gap-6 min-h-0">
      {/* ── Contenido principal ── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Boxes size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Existencias</h1>
              <p className="text-sm text-gray-500">
                {stats ? `${stats.activos_count} productos activos` : 'Cargando...'}
                {stats && stats.critico_count > 0 && ` · ${stats.critico_count} críticos`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => abrirEgreso()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium">
              <Minus size={14} /> Egresar
            </button>
            <button onClick={() => abrirIngreso()}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
              <Plus size={14} /> Ingresar
            </button>
          </div>
        </div>

        {/* KPI tiles */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-gray-400" />
          </div>
        ) : stats && (
          <>
            <div className="grid grid-cols-5 gap-3">
              {/* Críticos */}
              <button onClick={() => { setFiltro('critico'); setTab('existencias'); }}
                className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all ${
                  filtro === 'critico' ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle size={15} className="text-red-600" />
                  </div>
                  {stats.critico_count > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.critico_count}</p>
                <p className="text-xs text-gray-500 mt-0.5">Críticos</p>
              </button>

              {/* Bajo mínimo */}
              <button onClick={() => { setFiltro('bajo'); setTab('existencias'); }}
                className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all ${
                  filtro === 'bajo' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-100'
                }`}>
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
                  <TrendingDown size={15} className="text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-600">{stats.bajo_minimo_count}</p>
                <p className="text-xs text-gray-500 mt-0.5">Bajo mínimo</p>
              </button>

              {/* Valor total */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                  <DollarSign size={15} className="text-blue-600" />
                </div>
                <p className="text-lg font-bold text-blue-600 leading-tight">{fmtMonto(stats.valor_total_stock)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Valor en stock</p>
              </div>

              {/* Sin movimiento */}
              <button onClick={() => { setFiltro('sin_movimiento'); setTab('existencias'); }}
                className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all ${
                  filtro === 'sin_movimiento' ? 'border-gray-400 ring-1 ring-gray-200' : 'border-gray-100'
                }`}>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mb-2">
                  <BarChart2 size={15} className="text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-600">{stats.sin_movimiento_count}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sin movimiento 60d</p>
              </button>

              {/* Activos */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                  <Boxes size={15} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.activos_count}</p>
                <p className="text-xs text-gray-500 mt-0.5">Productos activos</p>
              </div>
            </div>

            {/* Alertas importantes */}
            {tablero!.alertas.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Alertas importantes
                </p>
                <div className="space-y-2">
                  {tablero!.alertas.map((p, i) => {
                    const cfg = ESTADO_CFG[p.estado];
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-red-100">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        {/* Miniatura */}
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                          {p.imagen_url ? (
                            <img src={p.imagen_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package size={14} className="text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {p.tipo_abertura?.nombre ?? 'Sin categoría'}
                            {p.stock_minimo > 0 && ` · mín ${p.stock_minimo}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-lg font-bold ${cfg.text}`}>{p.stock_actual}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <button onClick={() => abrirIngreso(p.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex-shrink-0">
                          <Plus size={11} /> Ingresar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {([
                { key: 'existencias', label: 'Productos', icon: Boxes },
                { key: 'lotes',       label: 'Lotes',     icon: Layers },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            {/* Lotes tab */}
            {tab === 'lotes' && (
              <LotesTab onNuevoIngreso={() => { setTab('existencias'); abrirIngreso(); }} />
            )}

            {/* Existencias tab */}
            {tab === 'existencias' && (
              <>
                {/* Controles */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por nombre, código o categoría..."
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>

                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-shrink-0">
                    {FILTROS.map(f => (
                      <button key={f.key} onClick={() => setFiltro(f.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          filtro === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        {f.label}
                        {(f.count ?? 0) > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/80 ${f.color ?? 'text-gray-600'} ${filtro === f.key ? '' : 'bg-gray-200'}`}>
                            {f.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <select value={orden} onChange={e => setOrden(e.target.value as OrdenTab)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white flex-shrink-0">
                    <option value="estado">Por estado</option>
                    <option value="nombre">Por nombre</option>
                    <option value="ventas_30d">Más vendidos</option>
                    <option value="stock_asc">Menos stock</option>
                    <option value="valor">Mayor valor</option>
                  </select>
                </div>

                {/* Header tabla */}
                <div className="grid items-center gap-3 px-4 py-2"
                  style={{ gridTemplateColumns: '1fr 65px 90px 80px 70px 100px 100px' }}>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Stock</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Estado</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Rotación</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">30d</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Valor</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</span>
                </div>

                {/* Filas */}
                {paginated.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                    <Boxes size={32} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-sm text-gray-400">
                      {filtro !== 'todos' || search
                        ? 'Ningún producto coincide con los filtros'
                        : 'No hay productos estándar cargados'}
                    </p>
                    {(filtro !== 'todos' || search) && (
                      <button onClick={() => { setFiltro('todos'); setSearch(''); }}
                        className="mt-3 text-xs text-orange-600 hover:underline">
                        Ver todos
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {paginated.map(p => (
                      <ProductoRow
                        key={p.id}
                        producto={p}
                        onIngreso={() => abrirIngreso(p.id)}
                        onEgreso={() => abrirEgreso(p.id)}
                        onAjuste={() => abrirAjuste(p.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-gray-400">
                      {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length} productos
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pg = Math.min(Math.max(page - 2, 1) + i, totalPages);
                        return (
                          <button key={pg} onClick={() => setPage(pg)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium ${
                              pg === page ? 'bg-orange-500 text-white' : 'hover:bg-gray-100 text-gray-600'
                            }`}>
                            {pg}
                          </button>
                        );
                      })}
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div className="w-64 shrink-0 space-y-4">

        {/* Reposición sugerida */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Zap size={12} className="text-orange-500" /> Reposición sugerida
          </p>
          {reposicion.length === 0 ? (
            <div className="text-center py-4">
              <Check size={20} className="mx-auto mb-1 text-emerald-400" />
              <p className="text-xs text-gray-400">Stock saludable</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reposicion.map(p => {
                const pct = p.stock_minimo > 0
                  ? Math.min(100, (p.stock_actual / p.stock_minimo) * 100)
                  : p.stock_actual > 0 ? 100 : 0;
                const cfg = ESTADO_CFG[p.estado];
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">{p.nombre}</p>
                      <button onClick={() => abrirIngreso(p.id)}
                        className="flex-shrink-0 p-1 hover:bg-emerald-50 text-emerald-600 rounded-md">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold ${cfg.text}`}>{p.stock_actual}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rotación de inventario */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Rotación
          </p>
          <div className="flex items-center justify-center mb-3">
            <DonutChart
              size={90}
              segments={[
                { value: anal.alta,  color: '#10b981' },
                { value: anal.media, color: '#3b82f6' },
                { value: anal.baja,  color: '#d1d5db' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            {[
              { key: 'alta',  label: 'Rotación alta',  color: 'bg-emerald-500', val: anal.alta },
              { key: 'media', label: 'Rotación media', color: 'bg-blue-500',    val: anal.media },
              { key: 'baja',  label: 'Rotación baja',  color: 'bg-gray-300',    val: anal.baja },
            ].map(s => {
              const total = anal.alta + anal.media + anal.baja;
              const pct = total > 0 ? Math.round(s.val / total * 100) : 0;
              return (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
                  <span className="flex-1 text-gray-600">{s.label}</span>
                  <span className="font-semibold text-gray-800">{s.val}</span>
                  <span className="text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Movimiento 30d */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Movimiento 30 días
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <ArrowDownCircle size={13} className="text-emerald-500" />
                Entradas
              </div>
              <span className="text-sm font-bold text-emerald-600">+{mov30?.entradas ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <ArrowUpCircle size={13} className="text-red-400" />
                Salidas
              </div>
              <span className="text-sm font-bold text-red-500">{mov30?.salidas ?? 0}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Productos vendidos</span>
              <span className="text-sm font-bold text-gray-700">{mov30?.productos_vendidos ?? 0}</span>
            </div>
            {mov30 && mov30.entradas > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Rotación neta</span>
                <span className={`text-sm font-bold ${mov30.salidas > mov30.entradas ? 'text-red-500' : 'text-emerald-600'}`}>
                  {mov30.salidas > mov30.entradas ? '-' : '+'}{Math.abs(mov30.entradas - mov30.salidas)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Acciones rápidas
          </p>
          <div className="space-y-1.5">
            <button onClick={() => abrirIngreso()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-emerald-700 transition-colors text-sm font-medium text-left">
              <ArrowDownCircle size={15} /> Registrar ingreso
            </button>
            <button onClick={() => abrirEgreso()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 text-blue-700 transition-colors text-sm font-medium text-left">
              <ArrowUpCircle size={15} /> Registrar egreso
            </button>
            <button onClick={() => abrirAjuste()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors text-sm font-medium text-left">
              <Wrench size={15} /> Ajuste de inventario
            </button>
            <button onClick={() => { setTab('lotes'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-orange-50 text-orange-700 transition-colors text-sm font-medium text-left">
              <Layers size={15} /> Ver lotes
            </button>
          </div>
        </div>
      </div>

      {/* Modales */}
      {modal === 'ingreso' && (
        <ModalIngreso
          productos={productosModal}
          proveedores={proveedores}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          productoPreseleccionado={ingresoProducto}
        />
      )}
      {modal === 'egreso' && (
        <ModalEgreso
          productos={productosModal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          productoPreseleccionado={egresoProducto}
        />
      )}
      {modal === 'ajuste' && (
        <ModalAjuste
          productos={productosModal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          productoPreseleccionado={ajusteProducto}
        />
      )}
    </div>
  );
}
