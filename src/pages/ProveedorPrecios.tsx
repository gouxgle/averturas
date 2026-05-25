import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X,
  Search, Upload, Download, RefreshCw, Tag,
  AlertCircle, Package, Link, Link2Off, TrendingUp,
  Percent, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────
interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  margen_venta: number;
}

interface PrecioProv {
  id: string;
  proveedor_id: string;
  sku: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  updated_at: string;
  producto_id: string | null;
  producto_nombre: string | null;
  margen_efectivo: number;
  margen_fuente: 'producto' | 'tipo' | 'proveedor' | 'ninguno';
  tipo_nombre: string | null;
}

interface CatalogoProducto {
  id: string;
  nombre: string;
  tipo: string;
  costo_base: number;
  precio_base: number;
  precio_manual: boolean;
}

interface FilaForm {
  sku: string;
  descripcion: string;
  precio: string;
}

interface DiffItem {
  id: string;
  sku: string;
  descripcion: string;
  precio_actual: number;
  precio_nuevo: number;
  margen_efectivo: number;
  precio_venta_nuevo: number;
  producto_nombre: string | null;
  actualizar_catalogo: boolean;
  es_nuevo: boolean; // no existe aún en la lista
}

// ── Helpers ────────────────────────────────────────────────────
function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function parseCsv(text: string): FilaForm[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const filas: FilaForm[] = [];
  for (const line of lines) {
    const cols = line.match(/("(?:[^"]|"")*"|[^,\t]*)(?:[,\t]|$)/g)
      ?.map(c => c.replace(/,$/, '').replace(/^\t$/, '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim())
      ?? [];
    const [sku, descripcion, precioStr] = cols;
    if (!sku || !descripcion) continue;
    const precio = parseFloat(precioStr?.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!sku || sku.toLowerCase() === 'sku' || sku.toLowerCase() === 'codigo') continue;
    filas.push({ sku, descripcion, precio: isNaN(precio) ? '0' : String(precio) } as unknown as FilaForm);
  }
  return filas;
}

// ── Badge margen fuente ────────────────────────────────────────
function MargenBadge({ fuente, nombre, valor }: { fuente: string; nombre: string | null; valor: number }) {
  const cfg = {
    producto:  'bg-blue-50 text-blue-700 border-blue-200',
    tipo:      'bg-violet-50 text-violet-700 border-violet-200',
    proveedor: 'bg-gray-100 text-gray-600 border-gray-200',
    ninguno:   'bg-gray-50 text-gray-400 border-gray-100',
  }[fuente] ?? 'bg-gray-50 text-gray-400';

  const label = {
    producto:  'Producto',
    tipo:      nombre ?? 'Tipo',
    proveedor: 'Proveedor',
    ninguno:   '—',
  }[fuente] ?? '—';

  if (fuente === 'ninguno') return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-semibold text-gray-800 text-xs">{valor}%</span>
      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', cfg)}>{label}</span>
    </div>
  );
}

// ── Modal vincular producto ────────────────────────────────────
function VincularModal({
  precio, onVinculado, onClose,
}: {
  precio: PrecioProv;
  onVinculado: () => void;
  onClose: () => void;
}) {
  const [search, setSearch]     = useState('');
  const [lista,  setLista]      = useState<CatalogoProducto[]>([]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setLista([]); return; }
    const t = setTimeout(async () => {
      const data = await api.get<CatalogoProducto[]>(
        `/productos?search=${encodeURIComponent(search)}`
      );
      setLista(data.slice(0, 20));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function vincular(productoId: string | null) {
    setSaving(true);
    try {
      await api.put(`/catalogo/proveedor-precios/${precio.id}`, { producto_id: productoId });
      toast.success(productoId ? 'Vinculado al catálogo' : 'Vínculo eliminado');
      onVinculado();
    } catch {
      toast.error('Error al vincular');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Vincular al catálogo</h2>
            <p className="text-xs text-gray-400 mt-0.5">{precio.sku} — {precio.descripcion}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {precio.producto_id && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-blue-800">Vinculado a:</p>
                <p className="text-sm text-blue-900">{precio.producto_nombre}</p>
              </div>
              <button onClick={() => vincular(null)} disabled={saving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                <Link2Off size={12} /> Desvincular
              </button>
            </div>
          )}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto en catálogo..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
            />
          </div>
          {lista.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-gray-50">
              {lista.map(p => (
                <button key={p.id} onClick={() => vincular(p.id)} disabled={saving}
                  className="w-full text-left px-4 py-3 hover:bg-lime-50 transition-colors flex items-center justify-between group disabled:opacity-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400">Venta: {formatCurrency(p.precio_base)} · Costo: {formatCurrency(p.costo_base)}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-lime-500 transition-colors" />
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && lista.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal actualizar precios ───────────────────────────────────
function ActualizarPreciosModal({
  proveedor, precios, onActualizado, onClose,
}: {
  proveedor: Proveedor;
  precios: PrecioProv[];
  onActualizado: () => void;
  onClose: () => void;
}) {
  const [paso,   setPaso]   = useState<1 | 2 | 3>(1);
  const [metodo, setMetodo] = useState<'porcentaje' | 'csv'>('porcentaje');
  const [pct,    setPct]    = useState('');
  const [diff,   setDiff]   = useState<DiffItem[]>([]);
  const [propagarPrecioBase, setPropagarPrecioBase] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function generarDiffPorcentaje() {
    const p = parseFloat(pct);
    if (!p || p <= 0) { toast.error('Ingresá un porcentaje válido mayor a 0'); return; }
    const items: DiffItem[] = precios.map(pp => {
      const nuevo = Math.round(pp.precio * (1 + p / 100));
      return {
        id: pp.id, sku: pp.sku, descripcion: pp.descripcion,
        precio_actual: pp.precio, precio_nuevo: nuevo,
        margen_efectivo: Number(pp.margen_efectivo) || 0,
        precio_venta_nuevo: Math.round(nuevo * (1 + (Number(pp.margen_efectivo) || 0) / 100)),
        producto_nombre: pp.producto_nombre,
        actualizar_catalogo: Boolean(pp.producto_id),
        es_nuevo: false,
      };
    });
    setDiff(items);
    setPaso(2);
  }

  function generarDiffCsv(filas: FilaForm[]) {
    const mapaExistente = new Map(precios.map(p => [p.sku, p]));
    const items: DiffItem[] = filas.map(f => {
      const existe = mapaExistente.get(f.sku);
      const nuevo = parseFloat(String(f.precio)) || 0;
      const margen = Number(existe?.margen_efectivo) || 0;
      return {
        id: existe?.id ?? '',
        sku: f.sku, descripcion: f.descripcion,
        precio_actual: existe?.precio ?? 0,
        precio_nuevo: nuevo,
        margen_efectivo: margen,
        precio_venta_nuevo: Math.round(nuevo * (1 + margen / 100)),
        producto_nombre: existe?.producto_nombre ?? null,
        actualizar_catalogo: Boolean(existe?.producto_id),
        es_nuevo: !existe,
      };
    });
    setDiff(items);
    setPaso(2);
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) { toast.error('No se encontraron filas válidas'); return; }
      generarDiffCsv(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function toggleItem(idx: number, field: 'actualizar_catalogo') {
    setDiff(prev => prev.map((d, i) => i === idx ? { ...d, [field]: !d[field] } : d));
  }

  async function confirmar() {
    setSaving(true);
    try {
      const itemsConId = diff.filter(d => d.id && !d.es_nuevo);
      const result = await api.post<{ preciosActualizados: number; catalogoActualizados: number }>(
        '/catalogo/proveedor-precios/aplicar-actualizacion',
        {
          proveedor_id: proveedor.id,
          items: itemsConId.map(d => ({
            id: d.id,
            precio_nuevo: d.precio_nuevo,
            actualizar_catalogo: d.actualizar_catalogo,
          })),
          propagar_precio_base: propagarPrecioBase,
        }
      );
      toast.success(`${result.preciosActualizados} precios actualizados · ${result.catalogoActualizados} productos del catálogo actualizados`);
      onActualizado();
    } catch {
      toast.error('Error al aplicar la actualización');
    } finally {
      setSaving(false);
    }
  }

  const sinCambio  = diff.filter(d => d.precio_actual === d.precio_nuevo && !d.es_nuevo);
  const conCambio  = diff.filter(d => d.precio_actual !== d.precio_nuevo && !d.es_nuevo);
  const nuevos     = diff.filter(d => d.es_nuevo);
  const vinculados = diff.filter(d => d.producto_nombre);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Actualizar lista de precios</h2>
            <p className="text-xs text-gray-400">{proveedor.nombre}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Pasos */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {[1, 2, 3].map(n => (
                <span key={n} className={cn('flex items-center gap-1.5',
                  paso === n ? 'text-lime-600 font-semibold' : paso > n ? 'text-gray-600' : '')}>
                  <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border',
                    paso === n ? 'bg-lime-500 text-white border-lime-500' :
                    paso > n  ? 'bg-gray-200 text-gray-600 border-gray-200' :
                    'border-gray-200 text-gray-400')}>
                    {n}
                  </span>
                  {n < 3 && <ChevronRight size={12} />}
                </span>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
          </div>
        </div>

        {/* Paso 1: método */}
        {paso === 1 && (
          <div className="p-6 space-y-5 overflow-y-auto">
            <p className="text-sm font-semibold text-gray-700">¿Cómo querés actualizar los precios?</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setMetodo('porcentaje')}
                className={cn('border-2 rounded-2xl p-5 text-left transition-all',
                  metodo === 'porcentaje' ? 'border-lime-400 bg-lime-50' : 'border-gray-200 hover:border-gray-300')}>
                <Percent size={20} className={metodo === 'porcentaje' ? 'text-lime-600' : 'text-gray-400'} />
                <p className="font-semibold text-gray-800 mt-2 text-sm">Porcentaje de aumento</p>
                <p className="text-xs text-gray-400 mt-1">Aplica el mismo % a toda la lista</p>
              </button>
              <button onClick={() => setMetodo('csv')}
                className={cn('border-2 rounded-2xl p-5 text-left transition-all',
                  metodo === 'csv' ? 'border-lime-400 bg-lime-50' : 'border-gray-200 hover:border-gray-300')}>
                <Upload size={20} className={metodo === 'csv' ? 'text-lime-600' : 'text-gray-400'} />
                <p className="font-semibold text-gray-800 mt-2 text-sm">Importar CSV nuevo</p>
                <p className="text-xs text-gray-400 mt-1">Compará con precios actuales</p>
              </button>
            </div>

            {metodo === 'porcentaje' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600">Porcentaje de aumento</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="0.1" max="999" step="0.5"
                    value={pct} onChange={e => setPct(e.target.value)}
                    placeholder="Ej: 15"
                    className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
                    autoFocus
                  />
                  <span className="text-sm text-gray-500">% sobre los {precios.length} precios actuales</span>
                </div>
                <button onClick={generarDiffPorcentaje}
                  className="flex items-center gap-2 px-5 py-2.5 bg-lime-500 text-white rounded-xl font-semibold text-sm hover:bg-lime-600 transition-colors">
                  Ver previsualización <ChevronRight size={15} />
                </button>
              </div>
            )}

            {metodo === 'csv' && (
              <div className="space-y-3">
                <div
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleCsvFile(e.dataTransfer.files[0]); }}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-lime-400 hover:bg-lime-50 transition-colors"
                >
                  <Upload size={28} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Arrastrá el CSV o hacé click</p>
                  <p className="text-xs text-gray-400 mt-1">Formato: sku, descripcion, precio</p>
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: diff */}
        {paso === 2 && (
          <>
            <div className="px-5 py-3 border-b bg-gray-50 shrink-0">
              <div className="flex items-center gap-4 text-xs">
                {conCambio.length > 0 && <span className="text-orange-600 font-semibold">{conCambio.length} con cambio</span>}
                {sinCambio.length > 0 && <span className="text-gray-400">{sinCambio.length} sin cambio</span>}
                {nuevos.length   > 0 && <span className="text-blue-600 font-semibold">{nuevos.length} nuevos (no se actualizan)</span>}
                {vinculados.length > 0 && <span className="text-violet-600">{vinculados.filter(d => d.actualizar_catalogo).length} / {vinculados.length} vinculados seleccionados</span>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0 border-b">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">SKU</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Descripción</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Actual</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Nuevo</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Δ%</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">P.Venta nuevo</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Catálogo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {diff.map((d, i) => {
                    const delta = d.precio_actual > 0
                      ? ((d.precio_nuevo - d.precio_actual) / d.precio_actual * 100)
                      : 0;
                    return (
                      <tr key={d.id || d.sku} className={cn(
                        d.es_nuevo ? 'bg-blue-50' :
                        d.precio_nuevo > d.precio_actual ? 'bg-red-50/30' :
                        d.precio_nuevo < d.precio_actual ? 'bg-green-50/30' : ''
                      )}>
                        <td className="px-3 py-2">
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{d.sku}</code>
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{d.descripcion}</td>
                        <td className="px-3 py-2 text-right text-gray-400">
                          {d.es_nuevo ? '—' : formatCurrency(d.precio_actual)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          {formatCurrency(d.precio_nuevo)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {d.es_nuevo ? (
                            <span className="text-blue-500 font-semibold">nuevo</span>
                          ) : delta === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className={cn('font-semibold', delta > 0 ? 'text-red-500' : 'text-green-600')}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {d.margen_efectivo > 0 ? formatCurrency(d.precio_venta_nuevo) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {d.producto_nombre && !d.es_nuevo ? (
                            <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={d.actualizar_catalogo}
                                onChange={() => toggleItem(i, 'actualizar_catalogo')}
                                className="w-3.5 h-3.5 accent-violet-500" />
                              <span className="text-[10px] text-violet-600 max-w-[80px] truncate">{d.producto_nombre}</span>
                            </label>
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex gap-3 shrink-0">
              <button onClick={() => setPaso(3)}
                className="flex-1 bg-lime-500 text-white font-semibold py-2.5 rounded-xl hover:bg-lime-600 flex items-center justify-center gap-2">
                Continuar <ChevronRight size={15} />
              </button>
              <button onClick={() => setPaso(1)}
                className="flex items-center gap-1.5 px-4 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50">
                <ChevronLeft size={14} /> Volver
              </button>
            </div>
          </>
        )}

        {/* Paso 3: confirmar */}
        {paso === 3 && (
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Resumen</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{diff.filter(d => !d.es_nuevo && d.precio_actual !== d.precio_nuevo).length}</p>
                  <p className="text-xs text-gray-400">precios a cambiar</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-violet-600">{diff.filter(d => d.actualizar_catalogo && !d.es_nuevo).length}</p>
                  <p className="text-xs text-gray-400">productos del catálogo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">{diff.filter(d => d.es_nuevo).length}</p>
                  <p className="text-xs text-gray-400">nuevos (se omiten)</p>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={propagarPrecioBase} onChange={e => setPropagarPrecioBase(e.target.checked)}
                className="w-4 h-4 accent-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Recalcular precio de venta en catálogo</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Para cada producto vinculado y seleccionado, actualiza <code className="bg-gray-100 px-1 rounded">costo_base</code> y
                  recalcula <code className="bg-gray-100 px-1 rounded">precio_base = precio × (1 + margen%)</code>.
                  No aplica a productos con <em>precio manual</em>.
                </p>
              </div>
            </label>

            {diff.filter(d => d.es_nuevo).length > 0 && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Los {diff.filter(d => d.es_nuevo).length} items nuevos del CSV <strong>no se agregarán</strong> automáticamente.
                  Importalos por separado desde "Import CSV" para añadirlos a la lista.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={confirmar} disabled={saving}
                className="flex-1 bg-lime-500 text-white font-semibold py-3 rounded-xl hover:bg-lime-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><RefreshCw size={14} className="animate-spin" /> Aplicando...</> : <><Check size={14} /> Confirmar actualización</>}
              </button>
              <button onClick={() => setPaso(2)}
                className="flex items-center gap-1.5 px-4 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50">
                <ChevronLeft size={14} /> Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila editable ──────────────────────────────────────────────
function FilaEditable({
  precio, onSave, onCancel,
}: {
  precio: PrecioProv;
  onSave: (data: Partial<PrecioProv>) => Promise<void>;
  onCancel: () => void;
}) {
  const [sku,  setSku]  = useState(precio.sku);
  const [desc, setDesc] = useState(precio.descripcion);
  const [prec, setPrec] = useState(String(precio.precio));
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({ sku, descripcion: desc, precio: parseFloat(prec) || 0 });
    setSaving(false);
  }

  return (
    <tr className="bg-amber-50">
      <td className="px-3 py-2">
        <input value={sku} onChange={e => setSku(e.target.value)}
          className="w-full border border-amber-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400" />
      </td>
      <td className="px-3 py-2">
        <input value={desc} onChange={e => setDesc(e.target.value)}
          className="w-full border border-amber-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
      </td>
      <td className="px-3 py-2">
        <input type="number" min={0} value={prec} onChange={e => setPrec(e.target.value)}
          className="w-full border border-amber-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-400" />
      </td>
      <td colSpan={3} />
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <button onClick={submit} disabled={saving}
            className="p-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button onClick={onCancel}
            className="p-1.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modal nueva fila ──────────────────────────────────────────
function NuevoPrecioModal({
  proveedorId, onSaved, onClose,
}: {
  proveedorId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [sku,  setSku]  = useState('');
  const [desc, setDesc] = useState('');
  const [prec, setPrec] = useState('');
  const [saving, setSaving] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);

  useEffect(() => { skuRef.current?.focus(); }, []);

  async function submit(e: React.FormEvent, cerrar = false) {
    e.preventDefault();
    if (!sku.trim() || !desc.trim()) { toast.error('SKU y descripción requeridos'); return; }
    setSaving(true);
    try {
      await api.post('/catalogo/proveedor-precios', {
        proveedor_id: proveedorId, sku: sku.trim(),
        descripcion: desc.trim(), precio: parseFloat(prec) || 0,
      });
      toast.success('Precio guardado');
      onSaved();
      if (cerrar) { onClose(); return; }
      // Resetear y quedar abierto para agregar otro
      setSku(''); setDesc(''); setPrec('');
      setTimeout(() => skuRef.current?.focus(), 50);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">Nuevo precio</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">SKU / Código *</label>
            <input ref={skuRef} value={sku} onChange={e => setSku(e.target.value)}
              placeholder="Ej: VEN-1200-PVC-BL"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción *</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Ventana 1.20x0.80 PVC blanco"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Precio ($)</label>
            <input type="number" min={0} value={prec} onChange={e => setPrec(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-lime-500 text-white font-semibold py-2.5 rounded-xl hover:bg-lime-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
              Guardar y agregar otro
            </button>
            <button type="button" disabled={saving} onClick={e => submit(e as unknown as React.FormEvent, true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-lime-700 text-white font-semibold rounded-xl hover:bg-lime-800 disabled:opacity-50 text-sm whitespace-nowrap">
              <Check size={13} /> Guardar y cerrar
            </button>
            <button type="button" onClick={onClose}
              className="px-3 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal import CSV ───────────────────────────────────────────
function ImportCsvModal({
  proveedorId, onImported, onClose,
}: {
  proveedorId: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const [filas,    setFilas]    = useState<FilaForm[]>([]);
  const [paso,     setPaso]     = useState<'upload' | 'preview'>('upload');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error('No se encontraron filas válidas. Verificá el formato (sku,descripcion,precio)');
        return;
      }
      setFilas(parsed);
      setPaso('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function confirmarImport() {
    setImporting(true);
    try {
      const result = await api.post<{ insertados: number; actualizados: number; total: number }>(
        '/catalogo/proveedor-precios/import',
        {
          proveedor_id: proveedorId,
          filas: filas.map(f => ({
            sku: f.sku,
            descripcion: f.descripcion,
            precio: parseFloat(String(f.precio)) || 0,
          })),
        }
      );
      toast.success(`Importados: ${result.insertados} nuevos, ${result.actualizados} actualizados`);
      onImported();
    } catch {
      toast.error('Error en la importación');
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = 'sku,descripcion,precio\nVEN-1200-BL,Ventana 1.20x0.80 PVC blanco batiente,15000\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'template_precios.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">
            {paso === 'upload' ? 'Importar lista de precios CSV' : `Vista previa — ${filas.length} productos`}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        {paso === 'upload' && (
          <div className="p-5 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700">
                <p className="font-semibold mb-0.5">Formato requerido: 3 columnas</p>
                <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">sku,descripcion,precio</code>
                <p className="mt-1 opacity-70">Separador: coma o tabulación. La primera fila puede ser encabezado (se ignora si no es numérica).</p>
              </div>
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-lime-400 hover:bg-lime-50 transition-colors"
            >
              <Upload size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Arrastrá un CSV o hacé click para seleccionar</p>
              <p className="text-xs text-gray-400 mt-1">Archivos .csv o .txt</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <Download size={13} /> Descargar plantilla de ejemplo
            </button>
          </div>
        )}

        {paso === 'preview' && (
          <>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">SKU</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Descripción</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-700">{f.sku}</td>
                      <td className="px-4 py-2 text-gray-700">{f.descripcion}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(parseFloat(String(f.precio)) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={confirmarImport} disabled={importing}
                className="flex-1 bg-lime-500 text-white font-semibold py-2.5 rounded-xl hover:bg-lime-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {importing
                  ? <><RefreshCw size={14} className="animate-spin" /> Importando...</>
                  : <><Check size={14} /> Confirmar importación ({filas.length})</>}
              </button>
              <button onClick={() => setPaso('upload')}
                className="w-28 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50">
                Volver
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────
export function ProveedorPrecios() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [precios,   setPrecios]   = useState<PrecioProv[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [editId,    setEditId]    = useState<string | null>(null);
  const [modal,     setModal]     = useState<'nuevo' | 'csv' | 'actualizar' | null>(null);
  const [vincularPrecio, setVincularPrecio] = useState<PrecioProv | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [prov, lista] = await Promise.all([
        api.get<Proveedor>(`/catalogo/proveedores/${id}`),
        api.get<PrecioProv[]>(`/catalogo/proveedor-precios?proveedor_id=${id}`),
      ]);
      setProveedor(prov);
      setPrecios(lista);
    } catch {
      toast.error('Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleUpdate(precioId: string, data: Partial<PrecioProv>) {
    await api.put(`/catalogo/proveedor-precios/${precioId}`, data);
    toast.success('Actualizado');
    setEditId(null);
    await cargar();
  }

  async function handleDelete(precio: PrecioProv) {
    if (!window.confirm(`¿Eliminar "${precio.sku} — ${precio.descripcion}"?`)) return;
    await api.delete(`/catalogo/proveedor-precios/${precio.id}`);
    toast.success('Eliminado');
    cargar();
  }

  function downloadCsv() {
    const rows = precios.map(p =>
      `"${p.sku}","${p.descripcion.replace(/"/g, '""')}",${p.precio}`
    );
    const csv = ['sku,descripcion,precio', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precios_${proveedor?.nombre ?? id}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtrados = precios.filter(p => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return p.sku.toLowerCase().includes(s) || p.descripcion.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-lime-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 xl:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/proveedores')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            Lista de precios — {proveedor?.nombre ?? '…'}
          </h1>
          <p className="text-sm text-gray-500">
            {precios.length} productos · actualizada {precios.length > 0
              ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(
                  new Date(precios.reduce((a, b) => a.updated_at > b.updated_at ? a : b).updated_at)
                )
              : 'nunca'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {precios.length > 0 && (
            <>
              <button onClick={downloadCsv}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Download size={14} /> Exportar
              </button>
              <button onClick={() => setModal('actualizar')}
                className="flex items-center gap-1.5 px-3 py-2 border border-orange-200 bg-orange-50 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors">
                <TrendingUp size={14} /> Actualizar precios
              </button>
            </>
          )}
          <button onClick={() => setModal('csv')}
            className="flex items-center gap-1.5 px-3 py-2 border border-lime-200 bg-lime-50 text-lime-700 rounded-xl text-sm font-medium hover:bg-lime-100 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => setModal('nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-lime-500 text-white rounded-xl text-sm font-semibold hover:bg-lime-600 transition-colors">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Buscador */}
      {precios.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por SKU o descripción..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
          />
        </div>
      )}

      {/* Tabla */}
      {precios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Tag size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="font-semibold text-gray-500 mb-1">Sin precios cargados</p>
          <p className="text-sm text-gray-400 mb-6">Agregá precios manualmente o importá un CSV del proveedor</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setModal('csv')}
              className="flex items-center gap-2 px-4 py-2.5 bg-lime-500 text-white rounded-xl font-semibold text-sm hover:bg-lime-600 transition-colors">
              <Upload size={15} /> Importar CSV
            </button>
            <button onClick={() => setModal('nuevo')}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
              <Plus size={15} /> Agregar uno
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  { h: 'SKU / Código', align: 'left' },
                  { h: 'Descripción', align: 'left' },
                  { h: 'Precio', align: 'right' },
                  { h: 'Margen', align: 'left' },
                  { h: 'P.Venta', align: 'right' },
                  { h: 'Producto vinculado', align: 'left' },
                  { h: 'Acciones', align: 'right' },
                ].map(col => (
                  <th key={col.h} className={cn(
                    'px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider',
                    col.align === 'right' ? 'text-right' : 'text-left',
                  )}>{col.h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    Sin resultados para "{search}"
                  </td>
                </tr>
              ) : filtrados.map(precio => (
                editId === precio.id ? (
                  <FilaEditable key={precio.id} precio={precio}
                    onSave={data => handleUpdate(precio.id, data)}
                    onCancel={() => setEditId(null)} />
                ) : (
                  <tr key={precio.id} className={cn('hover:bg-gray-50', !precio.activo && 'opacity-50')}>
                    <td className="px-3 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                        {precio.sku}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-gray-700 max-w-[220px] truncate">{precio.descripcion}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(Number(precio.precio))}
                    </td>
                    <td className="px-3 py-3">
                      <MargenBadge
                        fuente={precio.margen_fuente}
                        nombre={precio.tipo_nombre}
                        valor={Number(precio.margen_efectivo)}
                      />
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600 text-xs">
                      {precio.margen_efectivo > 0
                        ? formatCurrency(Math.round(Number(precio.precio) * (1 + Number(precio.margen_efectivo) / 100)))
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {precio.producto_nombre ? (
                        <button onClick={() => setVincularPrecio(precio)}
                          className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 hover:bg-violet-100 transition-colors max-w-[160px] truncate">
                          <Link size={10} className="shrink-0" />
                          <span className="truncate">{precio.producto_nombre}</span>
                        </button>
                      ) : (
                        <button onClick={() => setVincularPrecio(precio)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 hover:bg-violet-50 border border-dashed border-gray-200 hover:border-violet-300 rounded-lg px-2 py-1 transition-colors">
                          <Link size={10} /> Vincular
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditId(precio.id)}
                          className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(precio)}
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg" title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          {filtrados.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {filtrados.length} de {precios.length} productos
                {precios.filter(p => p.producto_id).length > 0 && (
                  <span className="ml-2 text-violet-500">· {precios.filter(p => p.producto_id).length} vinculados</span>
                )}
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Package size={11} />
                Total lista: {formatCurrency(filtrados.reduce((a, b) => a + Number(b.precio), 0))}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modal === 'nuevo' && id && (
        <NuevoPrecioModal
          proveedorId={id}
          onSaved={cargar}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'csv' && id && (
        <ImportCsvModal
          proveedorId={id}
          onImported={() => { setModal(null); cargar(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'actualizar' && proveedor && (
        <ActualizarPreciosModal
          proveedor={proveedor}
          precios={precios}
          onActualizado={() => { setModal(null); cargar(); }}
          onClose={() => setModal(null)}
        />
      )}
      {vincularPrecio && (
        <VincularModal
          precio={vincularPrecio}
          onVinculado={() => { setVincularPrecio(null); cargar(); }}
          onClose={() => setVincularPrecio(null)}
        />
      )}
    </div>
  );
}
