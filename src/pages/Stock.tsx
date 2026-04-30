import { useState, useEffect, useCallback } from 'react';
import {
  Boxes, Plus, Minus, AlertTriangle, TrendingDown,
  ChevronDown, ChevronUp, Package, Truck, RotateCcw,
  Wrench, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle,
  History, X, Check, Info, Layers
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { MontoInput } from '@/components/MontoInput';

// ── Tipos ─────────────────────────────────────────────────────
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

interface Proveedor {
  id: string;
  nombre: string;
}

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

interface Alertas {
  sin_stock: number;
  bajo_minimo: number;
  total: number;
}

// ── Constantes ────────────────────────────────────────────────
const TIPO_MOV: Record<string, { label: string; icon: React.FC<{ size?: number; className?: string }>; color: string; bg: string }> = {
  ingreso:        { label: 'Ingreso',        icon: ArrowDownCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  egreso_remito:  { label: 'Egreso remito',  icon: Truck,           color: 'text-blue-600',    bg: 'bg-blue-50' },
  egreso_retiro:  { label: 'Retiro local',   icon: ArrowUpCircle,   color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  devolucion:     { label: 'Devolución',     icon: RotateCcw,       color: 'text-amber-600',   bg: 'bg-amber-50' },
  ajuste:         { label: 'Ajuste',         icon: Wrench,          color: 'text-gray-600',    bg: 'bg-gray-100' },
};

function stockStatus(actual: number, minimo: number) {
  if (actual <= 0)       return { label: 'Sin stock',    color: 'text-red-600',    bg: 'bg-red-50',    bar: 'bg-red-400' };
  if (actual <= minimo)  return { label: 'Bajo mínimo',  color: 'text-amber-600',  bg: 'bg-amber-50',  bar: 'bg-amber-400' };
  return                        { label: 'OK',           color: 'text-emerald-600',bg: 'bg-emerald-50',bar: 'bg-emerald-500' };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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

          {/* Producto */}
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

          {/* Cantidad y costo */}
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

          {/* Lote */}
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

          {/* Notas del movimiento */}
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
    { key: 'egreso_remito',  label: 'Remito',    icon: Truck,        desc: 'Entrega con remito' },
    { key: 'egreso_retiro',  label: 'Retiro',    icon: Package,      desc: 'Retiro en local' },
    { key: 'devolucion',     label: 'Devolución',icon: RotateCcw,    desc: 'Dev. por falla o cambio' },
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

          {/* Tipo de egreso */}
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

          {/* Producto */}
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

          {/* Cantidad */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Cantidad *
              {selected && <span className="text-gray-400 font-normal ml-1">(disponible: {selected.stock_actual})</span>}
            </label>
            <input type="number" min="1" max={selected?.stock_actual ?? undefined}
              value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Referencia / Nro remito */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {tipo === 'egreso_remito' ? 'N° Remito' : tipo === 'devolucion' ? 'N° referencia' : 'Referencia'}
            </label>
            <input value={referenciaId} onChange={e => setReferenciaId(e.target.value)} placeholder="Opcional"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Motivo — solo para devolución */}
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
        const def = TIPO_MOV[m.tipo] ?? TIPO_MOV.ajuste;
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

// ── ProductoCard ──────────────────────────────────────────────
function ProductoCard({
  producto, onIngreso, onEgreso, onAjuste
}: {
  producto: ProductoStock;
  onIngreso: () => void;
  onEgreso:  () => void;
  onAjuste:  () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const st = stockStatus(producto.stock_actual, producto.stock_minimo);
  const pct = producto.stock_minimo > 0
    ? Math.min(100, (producto.stock_actual / (producto.stock_minimo * 2)) * 100)
    : producto.stock_actual > 0 ? 100 : 0;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      producto.stock_actual <= 0
        ? 'border-red-200'
        : producto.stock_actual <= producto.stock_minimo
        ? 'border-amber-200'
        : 'border-gray-100'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Imagen / placeholder */}
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
            {producto.imagen_url
              ? <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <Package size={20} className="text-gray-300" />
                </div>
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{producto.nombre}</h3>
                  {producto.tipo !== 'estandar' && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                      producto.tipo === 'fabricacion_propia'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-sky-50 text-sky-600'
                    }`}>
                      {producto.tipo === 'fabricacion_propia' ? 'Fab. propia' : 'A medida'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {producto.codigo && <span className="text-xs text-gray-400">{producto.codigo}</span>}
                  {producto.tipo_abertura && (
                    <span className="text-xs text-gray-400 truncate">{producto.tipo_abertura.nombre}</span>
                  )}
                  {producto.color && (
                    <span className="text-xs text-gray-400">{producto.color}</span>
                  )}
                </div>
              </div>

              {/* Stock number */}
              <div className="text-right flex-shrink-0">
                <div className={`text-2xl font-bold leading-tight ${st.color}`}>{producto.stock_actual}</div>
                <div className="text-[10px] text-gray-400">unidades</div>
              </div>
            </div>

            {/* Barra de stock */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${st.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${st.bg} ${st.color}`}>
                {st.label}
              </span>
            </div>

            {producto.stock_minimo > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">Mínimo: {producto.stock_minimo} u.</p>
            )}
          </div>
        </div>

        {/* Stats + acciones */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <ArrowDownCircle size={11} className="text-emerald-500" />
              {producto.total_ingresado} ing.
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpCircle size={11} className="text-red-400" />
              {producto.total_egresado} egr.
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={onIngreso} title="Ingresar stock"
              className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors">
              <Plus size={15} />
            </button>
            <button onClick={onEgreso} disabled={producto.stock_actual <= 0} title="Egresar stock"
              className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <Minus size={15} />
            </button>
            <button onClick={onAjuste} title="Ajuste de inventario"
              className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors">
              <Wrench size={14} />
            </button>
            <button onClick={() => setExpanded(v => !v)} title="Ver historial"
              className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors">
              <History size={14} />
              {expanded ? <ChevronUp size={10} className="inline ml-0.5" /> : <ChevronDown size={10} className="inline ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-3">
          <MovimientosPanel productoId={producto.id} />
        </div>
      )}
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
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
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
            const tipos = [...new Set(lote.items.map(it => it.tipo_abertura).filter(Boolean))];
            const pctUsado = totalIngresado > 0 ? Math.min(100, (totalEgresado / totalIngresado) * 100) : 0;
            const isOpen = expanded[lote.id];

            return (
              <div key={lote.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header del lote */}
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

                  {/* Totales rápidos */}
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

                {/* Barra de rotación */}
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

                {/* Detalle de productos del lote */}
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

// ── Página principal ──────────────────────────────────────────
export function Stock() {
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [alertas, setAlertas] = useState<Alertas>({ sin_stock: 0, bajo_minimo: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'sin_stock' | 'bajo_minimo'>('todos');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stock' | 'lotes'>('stock');
  const [modal, setModal] = useState<'ingreso' | 'egreso' | 'ajuste' | null>(null);
  const [ingresoProducto, setIngresoProducto] = useState<string | undefined>();
  const [egresoProducto, setEgresoProducto]   = useState<string | undefined>();
  const [ajusteProducto, setAjusteProducto]   = useState<string | undefined>();

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ search, filtro }).toString();
      const [productos, proveedores, alertas] = await Promise.all([
        api.get<ProductoStock[]>(`/stock?${qs}`),
        api.get<Proveedor[]>('/catalogo/proveedores'),
        api.get<Alertas>('/stock/alertas'),
      ]);
      setProductos(productos);
      setProveedores(proveedores);
      setAlertas(alertas);
    } finally {
      setLoading(false);
    }
  }, [search, filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirIngreso(productoId?: string) {
    setIngresoProducto(productoId);
    setModal('ingreso');
  }
  function abrirEgreso(productoId?: string) {
    setEgresoProducto(productoId);
    setModal('egreso');
  }
  function abrirAjuste(productoId?: string) {
    setAjusteProducto(productoId);
    setModal('ajuste');
  }

  function onSaved() {
    setModal(null);
    cargar();
  }

  const FILTROS = [
    { key: 'todos',       label: 'Todos', count: alertas.total },
    { key: 'sin_stock',   label: 'Sin stock', count: alertas.sin_stock },
    { key: 'bajo_minimo', label: 'Bajo mínimo', count: alertas.bajo_minimo },
  ] as const;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Boxes size={20} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stock</h1>
            <p className="text-sm text-gray-500">
              {alertas.total} productos — {alertas.sin_stock > 0 ? `${alertas.sin_stock} sin stock` : 'todos con stock'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500" title="Actualizar">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {tab === 'stock' && <>
            <button onClick={() => abrirEgreso()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium">
              <Minus size={14} /> Egresar
            </button>
            <button onClick={() => abrirIngreso()}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
              <Plus size={14} /> Ingresar
            </button>
          </>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {([
          { key: 'stock', label: 'Productos', icon: Boxes },
          { key: 'lotes', label: 'Lotes',     icon: Layers },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Lotes */}
      {tab === 'lotes' && (
        <LotesTab onNuevoIngreso={() => { setTab('stock'); abrirIngreso(); }} />
      )}

      {/* Tab Stock */}
      {tab === 'stock' && <>

      {/* Alertas */}
      {(alertas.sin_stock > 0 || alertas.bajo_minimo > 0) && (
        <div className="flex gap-3 mb-5">
          {alertas.sin_stock > 0 && (
            <button onClick={() => setFiltro('sin_stock')}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-100 transition-colors">
              <AlertTriangle size={14} />
              <strong>{alertas.sin_stock}</strong> sin stock
            </button>
          )}
          {alertas.bajo_minimo > 0 && (
            <button onClick={() => setFiltro('bajo_minimo')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 hover:bg-amber-100 transition-colors">
              <TrendingDown size={14} />
              <strong>{alertas.bajo_minimo}</strong> bajo mínimo
            </button>
          )}
        </div>
      )}

      {/* Buscador + filtros */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtro === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f.label}
              {f.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  f.key === 'sin_stock' ? 'bg-red-100 text-red-600' :
                  f.key === 'bajo_minimo' ? 'bg-amber-100 text-amber-600' :
                  'bg-gray-200 text-gray-600'
                }`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-gray-400" />
        </div>
      ) : productos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Boxes size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">
            {filtro !== 'todos'
              ? 'Ningún producto coincide con el filtro actual'
              : search
              ? 'No se encontraron productos'
              : 'No hay productos estándar cargados'}
          </p>
          {filtro !== 'todos' && (
            <button onClick={() => setFiltro('todos')} className="mt-3 text-xs text-orange-600 hover:underline">
              Ver todos
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {productos.map(p => (
            <ProductoCard
              key={p.id}
              producto={p}
              onIngreso={() => abrirIngreso(p.id)}
              onEgreso={() => abrirEgreso(p.id)}
              onAjuste={() => abrirAjuste(p.id)}
            />
          ))}
        </div>
      )}

      </> /* fin tab stock */}

      {/* Modales */}
      {modal === 'ingreso' && (
        <ModalIngreso
          productos={productos}
          proveedores={proveedores}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          productoPreseleccionado={ingresoProducto}
        />
      )}
      {modal === 'egreso' && (
        <ModalEgreso
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          productoPreseleccionado={egresoProducto}
        />
      )}
      {modal === 'ajuste' && (
        <ModalAjuste
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          productoPreseleccionado={ajusteProducto}
        />
      )}
    </div>
  );
}
