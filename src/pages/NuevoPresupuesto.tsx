import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, FileText, ChevronDown, ScanLine, Search, Package, X, LayoutGrid, Truck, MapPin, Gift, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Cliente, TipoAbertura, Sistema } from '@/types';
import { MontoInput } from '@/components/MontoInput';
import { PDFDialog } from '@/components/PDFDialog';

// ── Catálogos estáticos ───────────────────────────────────────────────────────

const TIPOS_PROYECTO = [
  'Vivienda', 'Frente comercial', 'Quincho', 'Baño', 'Habitación', 'Obra completa',
];

const VIDRIO_OPTS    = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];
const FORMA_PAGO = [
  'Precio de lista',
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Tarjeta de crédito 3 cuotas sin interés',
];

const FORMAS_ENVIO = [
  { value: 'retiro_local',    label: 'Retiro en local',               icon: MapPin,     color: 'text-gray-600' },
  { value: 'envio_bonificado',label: 'Envío bonificado',              icon: Gift,       color: 'text-emerald-600' },
  { value: 'envio_destino',   label: 'Envío a destino (paga cliente)',icon: Truck,      color: 'text-sky-600' },
  { value: 'envio_empresa',   label: 'Envío a cargo de la empresa',   icon: Building2,  color: 'text-violet-600' },
] as const;
const COLORES_ITEM   = ['Blanco', 'Negro', 'Anodizado', 'Otro'];

const LABEL_USO: Record<string, string> = {
  interior: 'Interior', exterior: 'Exterior', ambos: 'Interior y exterior',
};
const LABEL_CONFIG_HOJAS: Record<string, string> = {
  hoja_simple: 'Hoja simple', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', puerta_pano_fijo: 'Con paño fijo',
  '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
};
const LABEL_PROVISION: Record<string, string> = {
  hoja_sola: 'Solo hoja', hoja_marco: 'Hoja + marco',
};
const LABEL_APERTURA: Record<string, string> = {
  abatir: 'Abatir', correr: 'Corrediza', plegable: 'Plegable', vaiven: 'Vaivén', pivotante: 'Pivotante',
};

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  costo_base: number;
  precio_base: number;
  tipo_abertura_id: string | null;
  tipo_abertura: { id: string; nombre: string } | null;
  sistema_id: string | null;
  sistema: { id: string; nombre: string } | null;
  color: string | null;
  vidrio: string | null;
  premarco: boolean;
  accesorios: string[];
  ancho: number | null;
  alto: number | null;
  atributos: Record<string, unknown>;
  stock_actual: number;
  imagen_url: string | null;
  imagenes: string[];
  caracteristica_1: string | null;
  caracteristica_2: string | null;
}

// ── Tipo para carga de edición ────────────────────────────────────────────────

interface FullOperacion {
  id: string; numero: string; estado: string; cliente_id: string; tipo: string;
  tipo_proyecto: string | null; forma_pago: string | null;
  tiempo_entrega: number | null; fecha_validez: string | null;
  notas: string | null; notas_internas: string | null;
  forma_envio: string | null; costo_envio: number;
  items: Array<{
    tipo_abertura_id: string | null; sistema_id: string | null;
    descripcion: string; medida_ancho: number | null; medida_alto: number | null;
    cantidad: number; costo_unitario: number; precio_unitario: number;
    incluye_instalacion: boolean; costo_instalacion: number; precio_instalacion: number;
    vidrio: string | null; premarco: boolean; origen: string | null;
    color: string | null; accesorios: string[]; producto_id: string | null;
    tipo_abertura_nombre: string | null; sistema_nombre: string | null;
  }>;
}

// ── Galería de productos ──────────────────────────────────────────────────────

function GaleriaModal({
  onSelect, onClose,
}: {
  onSelect: (p: CatalogProduct) => void;
  onClose: () => void;
}) {
  const [productos, setProductos] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CatalogProduct[]>('/catalogo/productos')
      .then(r => { setProductos(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtrados = productos.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.nombre.toLowerCase().includes(q)
      || (p.codigo ?? '').toLowerCase().includes(q)
      || (p.tipo_abertura?.nombre ?? '').toLowerCase().includes(q)
      || (p.sistema?.nombre ?? '').toLowerCase().includes(q)
      || (p.caracteristica_1 ?? '').toLowerCase().includes(q)
      || (p.caracteristica_2 ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-violet-600" />
            <h2 className="text-sm font-bold text-gray-900">Galería de productos</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400">
            <Search size={14} className="text-gray-300 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar por nombre, código, tipo..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none"
            />
            {search && <button onMouseDown={() => setSearch('')} className="text-gray-300 hover:text-gray-500"><X size={13} /></button>}
          </div>
        </div>

        {/* Grid */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Sin resultados</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtrados.map(p => {
                const img = p.imagenes?.[0] || p.imagen_url;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelect(p); onClose(); }}
                    className="text-left rounded-xl border border-gray-200 hover:border-violet-400 hover:shadow-md transition-all overflow-hidden group"
                  >
                    <div className="aspect-square bg-gray-50 overflow-hidden">
                      {img
                        ? <img src={img} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={28} className="text-gray-200" /></div>
                      }
                    </div>
                    <div className="p-2.5">
                      {p.codigo && (
                        <span className="font-mono text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded mb-1 inline-block">{p.codigo}</span>
                      )}
                      <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{p.nombre}</p>
                      {p.tipo_abertura && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{p.tipo_abertura.nombre}{p.sistema ? ` · ${p.sistema.nombre}` : ''}</p>
                      )}
                      <p className="text-xs font-bold text-violet-700 mt-1">{formatCurrency(Number(p.precio_base))}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Ítem vacío ────────────────────────────────────────────────────────────────

interface ItemForm {
  _key: string;
  producto_id: string;   // id de catálogo — '' si ítem manual
  tipo_item: 'estandar' | 'a_medida';
  tipo_abertura_id: string;
  sistema_id: string;
  descripcion: string;
  medida_ancho: string;
  medida_alto: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  incluye_instalacion: boolean;
  costo_instalacion: number;
  precio_instalacion: number;
  vidrio: string;
  premarco: boolean;
  origen: 'proveedor' | 'fabricacion';
  color: string;
  accesorios: string[];
  // datos del producto vinculado (solo lectura en UI)
  _prod_ancho: number | null;
  _prod_alto: number | null;
  _prod_atributos: Record<string, unknown>;
  _prod_stock: number;
  _prod_tipo_nombre: string;
  _prod_sistema_nombre: string;
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyItem(): ItemForm {
  return {
    _key: uuid(),
    producto_id: '',
    tipo_item: 'estandar',
    tipo_abertura_id: '', sistema_id: '', descripcion: '',
    medida_ancho: '', medida_alto: '',
    cantidad: 1,
    costo_unitario: 0, precio_unitario: 0,
    incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
    vidrio: '', premarco: false, origen: 'proveedor', color: '', accesorios: [],
    _prod_ancho: null, _prod_alto: null, _prod_atributos: {}, _prod_stock: 0,
    _prod_tipo_nombre: '', _prod_sistema_nombre: '',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemPrecioTotal(item: ItemForm) {
  const base = item.precio_unitario + (item.incluye_instalacion ? item.precio_instalacion : 0);
  return base * item.cantidad;
}
function itemCostoTotal(item: ItemForm) {
  const base = item.costo_unitario + (item.incluye_instalacion ? item.costo_instalacion : 0);
  return base * item.cantidad;
}

// ── Componente ítem ───────────────────────────────────────────────────────────

function ItemCard({
  item, idx, tiposAbertura, sistemas, coloresDB, onChange, onRemove, canRemove,
}: {
  item: ItemForm;
  idx: number;
  tiposAbertura: TipoAbertura[];
  sistemas: Sistema[];
  coloresDB: { id: string; nombre: string }[];
  onChange: (key: string, field: keyof ItemForm, value: unknown) => void;
  onRemove: (key: string) => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(true);
  const up = (f: keyof ItemForm, v: unknown) => onChange(item._key, f, v);

  // Buscador de producto interno
  const [prodSearch, setProdSearch]   = useState('');
  const [prodResults, setProdResults] = useState<CatalogProduct[]>([]);
  const [showProdDrop, setShowProdDrop] = useState(false);
  const [prodLoading, setProdLoading] = useState(false);

  useEffect(() => {
    if (!prodSearch.trim()) { setProdResults([]); setShowProdDrop(false); return; }
    const t = setTimeout(async () => {
      setProdLoading(true);
      try {
        const res = await api.get<CatalogProduct[]>(`/catalogo/productos?search=${encodeURIComponent(prodSearch.trim())}`);
        setProdResults(res.slice(0, 8));
        setShowProdDrop(res.length > 0);
      } catch { /* silencioso */ }
      finally { setProdLoading(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [prodSearch]);

  function selectProduct(p: CatalogProduct) {
    up('producto_id',          p.id);
    up('tipo_abertura_id',     p.tipo_abertura_id   ?? '');
    up('sistema_id',           p.sistema_id         ?? '');
    up('color',                p.color              ?? '');
    up('vidrio',               p.vidrio             ?? '');
    up('premarco',             p.premarco           ?? false);
    up('accesorios',           p.accesorios         ?? []);
    up('costo_unitario',       Number(p.costo_base)  || 0);
    up('precio_unitario',      Number(p.precio_base) || 0);
    up('descripcion',          p.codigo ? `${p.codigo} — ${p.nombre}` : p.nombre);
    up('_prod_ancho',          p.ancho              ?? null);
    up('_prod_alto',           p.alto               ?? null);
    up('_prod_atributos',      p.atributos          ?? {});
    up('_prod_stock',          p.stock_actual        ?? 0);
    up('_prod_tipo_nombre',    p.tipo_abertura?.nombre ?? '');
    up('_prod_sistema_nombre', p.sistema?.nombre       ?? '');
    setProdSearch(''); setProdResults([]); setShowProdDrop(false);
  }

  const precioItem = itemPrecioTotal(item);

  const sel   = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const inp   = sel;
  const label = 'block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  // Auto-generate description from fields
  useEffect(() => {
    if (item.producto_id) return; // si tiene producto vinculado, no pisar la descripción
    const ta   = tiposAbertura.find(t => t.id === item.tipo_abertura_id)?.nombre ?? '';
    const sis  = sistemas.find(s => s.id === item.sistema_id)?.nombre ?? '';
    const med  = item.medida_ancho && item.medida_alto ? ` ${item.medida_ancho}×${item.medida_alto}m` : '';
    const desc = [ta, sis, med].filter(Boolean).join(' · ');
    if (desc) onChange(item._key, 'descripcion', desc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.tipo_abertura_id, item.sistema_id, item.medida_ancho, item.medida_alto]);

  const esMedida = item.tipo_item === 'a_medida';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header del ítem */}
      <div
        className={cn('flex items-center justify-between px-4 py-3 cursor-pointer select-none',
          open ? 'bg-violet-50 border-b border-violet-100' : 'bg-gray-50 hover:bg-gray-100')}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown size={15} className={cn('text-gray-400 transition-transform', open ? 'rotate-0' : '-rotate-90')} />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Ítem {idx + 1}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
            esMedida ? 'bg-violet-100 text-violet-600' : 'bg-sky-100 text-sky-600')}>
            {esMedida ? 'A medida' : 'Estándar'}
          </span>
          {item.descripcion && <span className="text-xs text-gray-500 hidden sm:inline">— {item.descripcion}</span>}
        </div>
        <div className="flex items-center gap-3">
          {precioItem > 0 && (
            <span className="text-xs font-semibold text-gray-700">{formatCurrency(precioItem)}</span>
          )}
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(item._key); }}
              className="text-red-400 hover:text-red-600 p-0.5">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">

          {/* Buscador de producto — rellena tipo, sistema, color automáticamente */}
          <div className="relative">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
              item.producto_id
                ? 'bg-violet-50 border-violet-200'
                : 'border-gray-200 focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400'
            )}>
              <Package size={13} className={item.producto_id ? 'text-violet-500 shrink-0' : 'text-gray-300 shrink-0'} />
              {item.producto_id ? (
                <span className="flex-1 text-xs text-violet-700 font-medium truncate">{item.descripcion}</span>
              ) : (
                <input
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  onFocus={() => prodSearch && setShowProdDrop(true)}
                  onBlur={() => setTimeout(() => setShowProdDrop(false), 150)}
                  placeholder="Buscar producto del catálogo para auto-completar tipo, sistema, color..."
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none"
                />
              )}
              {item.producto_id
                ? <button type="button" onMouseDown={() => {
                    up('producto_id', ''); up('tipo_abertura_id', ''); up('sistema_id', '');
                    up('color', ''); up('precio_unitario', 0); up('costo_unitario', 0);
                  }} className="text-violet-400 hover:text-violet-600 shrink-0"><X size={13} /></button>
                : prodLoading
                ? <Search size={12} className="text-gray-300 animate-pulse shrink-0" />
                : prodSearch && <button onMouseDown={() => { setProdSearch(''); setProdResults([]); }} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={12} /></button>
              }
            </div>

            {/* Dropdown resultados */}
            {showProdDrop && prodResults.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {prodResults.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {p.codigo && (
                          <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">{p.codigo}</span>
                        )}
                        <span className="text-sm font-medium text-gray-800 truncate">{p.nombre}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-violet-700 shrink-0">
                      {formatCurrency(Number(p.precio_base))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tipo de ítem — solo visible en ítems manuales */}
          {!item.producto_id && (
            <div className="flex gap-2">
              {(['estandar', 'a_medida'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => up('tipo_item', t)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    item.tipo_item === t
                      ? t === 'estandar' ? 'bg-sky-600 text-white border-sky-600' : 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}>
                  {t === 'estandar' ? 'Producto estándar' : 'A medida / Fabricación'}
                </button>
              ))}
            </div>
          )}

          {item.producto_id ? (
            /* ── PRODUCTO VINCULADO: atributos de solo lectura ── */
            <>
              {/* Tarjeta de atributos del producto */}
              {(() => {
                const attr = item._prod_atributos;
                const uso        = attr.uso        ? (LABEL_USO[attr.uso as string]         ?? String(attr.uso))        : null;
                const cfgHojas   = attr.config_hojas ? (LABEL_CONFIG_HOJAS[attr.config_hojas as string] ?? String(attr.config_hojas)) : null;
                const provision  = attr.tipo_provision ? (LABEL_PROVISION[attr.tipo_provision as string] ?? String(attr.tipo_provision)) : null;
                const apertura   = attr.apertura   ? (LABEL_APERTURA[attr.apertura as string] ?? String(attr.apertura)) : null;
                const medidas    = item._prod_ancho && item._prod_alto
                  ? `${item._prod_ancho} × ${item._prod_alto} cm`
                  : item._prod_ancho ? `${item._prod_ancho} cm ancho`
                  : item._prod_alto  ? `${item._prod_alto} cm alto`
                  : null;
                const stockColor = item._prod_stock <= 0
                  ? 'text-red-600 bg-red-50'
                  : item._prod_stock <= 3
                  ? 'text-amber-600 bg-amber-50'
                  : 'text-emerald-700 bg-emerald-50';

                const Attr = ({ lbl, val }: { lbl: string; val: string }) => (
                  <div className="min-w-[80px]">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">{lbl}</span>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-tight">{val}</p>
                  </div>
                );

                return (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Ficha del producto
                      </p>
                      {/* Stock para el vendedor */}
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg', stockColor)}>
                        Stock: {item._prod_stock} u.
                        {item._prod_stock <= 0 && ' — Sin stock'}
                        {item._prod_stock > 0 && item._prod_stock <= 3 && ' — Poco stock'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                      {item._prod_tipo_nombre    && <Attr lbl="Tipo"              val={item._prod_tipo_nombre} />}
                      {item._prod_sistema_nombre && <Attr lbl="Sistema"           val={item._prod_sistema_nombre} />}
                      {uso                       && <Attr lbl="Uso"               val={uso} />}
                      {cfgHojas                  && <Attr lbl="Config. de hoja"   val={cfgHojas} />}
                      {provision                 && <Attr lbl="Provisión"         val={provision} />}
                      {apertura                  && <Attr lbl="Apertura"          val={apertura} />}
                      {medidas                   && <Attr lbl="Medidas estándar"  val={medidas} />}
                      {item.color                && <Attr lbl="Color"             val={item.color} />}
                      {item.vidrio               && <Attr lbl="Vidrio"            val={item.vidrio} />}
                      {item.accesorios.length > 0 && <Attr lbl="Incluye" val={item.accesorios.join(', ')} />}
                    </div>
                  </div>
                );
              })()}

              {/* Editable: Cantidad + Precio + Instalación */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={label}>Cantidad</label>
                  <input type="number" min={1} value={item.cantidad}
                    onChange={e => up('cantidad', parseInt(e.target.value) || 1)} className={inp} />
                </div>
                <div>
                  <label className={label}>Precio de venta</label>
                  <MontoInput value={item.precio_unitario ? String(item.precio_unitario) : ''}
                    onChange={v => up('precio_unitario', parseFloat(v) || 0)}
                    placeholder="0,00" className={inp} />
                </div>
                <div>
                  <label className={label}>Instalación</label>
                  <select value={item.incluye_instalacion ? 'si' : 'no'}
                    onChange={e => up('incluye_instalacion', e.target.value === 'si')} className={sel}>
                    <option value="no">No incluye</option>
                    <option value="si">Incluye instalación</option>
                  </select>
                </div>
              </div>

            </>
          ) : (
            /* ── ÍTEM MANUAL: todos los campos editables ── */
            <>
              {/* Fila 1: Tipo abertura + Sistema + Color + Cantidad */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={label}>Tipo de abertura</label>
                  <select value={item.tipo_abertura_id} onChange={e => up('tipo_abertura_id', e.target.value)} className={sel}>
                    <option value="">Seleccionar...</option>
                    {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Sistema</label>
                  <select value={item.sistema_id} onChange={e => up('sistema_id', e.target.value)} className={sel}>
                    <option value="">Seleccionar...</option>
                    {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Color</label>
                  <select value={item.color} onChange={e => up('color', e.target.value)} className={sel}>
                    <option value="">—</option>
                    {coloresDB.length
                      ? coloresDB.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                      : COLORES_ITEM.map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className={label}>Cantidad</label>
                  <input type="number" min={1} value={item.cantidad}
                    onChange={e => up('cantidad', parseInt(e.target.value) || 1)} className={inp} />
                </div>
              </div>

              {/* Campos exclusivos A medida */}
              {esMedida && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-violet-50/50 rounded-lg p-3 border border-violet-100">
                  <div>
                    <label className={label}>Ancho (m)</label>
                    <input type="number" step="0.01" value={item.medida_ancho}
                      onChange={e => up('medida_ancho', e.target.value)}
                      placeholder="1.20" className={inp} />
                  </div>
                  <div>
                    <label className={label}>Alto (m)</label>
                    <input type="number" step="0.01" value={item.medida_alto}
                      onChange={e => up('medida_alto', e.target.value)}
                      placeholder="2.05" className={inp} />
                  </div>
                  <div>
                    <label className={label}>Vidrio</label>
                    <select value={item.vidrio} onChange={e => up('vidrio', e.target.value)} className={sel}>
                      <option value="">—</option>
                      {VIDRIO_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Premarco</label>
                    <select value={item.premarco ? 'si' : 'no'} onChange={e => up('premarco', e.target.value === 'si')} className={sel}>
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Origen</label>
                    <select value={item.origen} onChange={e => up('origen', e.target.value)} className={sel}>
                      <option value="proveedor">Proveedor</option>
                      <option value="fabricacion">Fabricación propia</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Fila precios + accesorios */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={label}>Precio de venta</label>
                  <MontoInput value={item.precio_unitario ? String(item.precio_unitario) : ''}
                    onChange={v => up('precio_unitario', parseFloat(v) || 0)}
                    placeholder="0,00" className={inp} />
                </div>
                <div>
                  <label className={label}>Instalación</label>
                  <select value={item.incluye_instalacion ? 'si' : 'no'}
                    onChange={e => up('incluye_instalacion', e.target.value === 'si')} className={sel}>
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Accesorios</label>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1.5">
                    {ACCESORIO_OPTS.map(a => (
                      <label key={a} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox"
                          checked={item.accesorios.includes(a)}
                          onChange={e => up('accesorios',
                            e.target.checked
                              ? [...item.accesorios, a]
                              : item.accesorios.filter(x => x !== a)
                          )}
                          className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                        />
                        <span className="text-xs text-gray-600">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Precio instalación (condicional) */}
          {item.incluye_instalacion && (
            <div className="grid grid-cols-1 gap-3 bg-violet-50 rounded-lg p-3">
              <div>
                <label className={label}>Precio instalación</label>
                <MontoInput value={item.precio_instalacion ? String(item.precio_instalacion) : ''}
                  onChange={v => up('precio_instalacion', parseFloat(v) || 0)}
                  placeholder="0,00" className={inp} />
              </div>
            </div>
          )}

          {/* Total del ítem */}
          {precioItem > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>Subtotal: <span className="font-semibold text-gray-700">{formatCurrency(precioItem)}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function NuevoPresupuesto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId;
  const editLoadedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editEstado, setEditEstado] = useState('');

  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas]         = useState<Sistema[]>([]);
  const [coloresDB, setColoresDB]       = useState<{ id: string; nombre: string }[]>([]);

  // Cabecera
  const [clienteId, setClienteId]         = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteList, setShowClienteList] = useState(false);
  const [tipoProyecto, setTipoProyecto]   = useState('');
  const [formaPago, setFormaPago]         = useState('Precio de lista');
  const [tiempoEntrega, setTiempoEntrega] = useState('');
  const [fechaValidez, setFechaValidez]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    // Usar fecha local (no UTC) para evitar desfase de zona horaria
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [validezDias, setValidezDias]     = useState<number | 'custom'>(7);
  const [notas, setNotas]                 = useState('');
  const [notasInternas, setNotasInternas] = useState('');

  // Envío
  const [formaEnvio, setFormaEnvio] = useState('retiro_local');
  const [costoEnvio, setCostoEnvio] = useState(0);

  // Galería
  const [showGaleria, setShowGaleria] = useState(false);

  // Ítems
  const [items, setItems] = useState<ItemForm[]>([]);

  // Buscador por código / scanner
  const [codigoSearch,    setCodigoSearch]    = useState('');
  const [codigoResults,   setCodigoResults]   = useState<CatalogProduct[]>([]);
  const [showCodigo,      setShowCodigo]      = useState(false);
  const [codigoLoading,   setCodigoLoading]   = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>('/clientes'),
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
      api.get<{ id: string; nombre: string }[]>('/catalogo/colores'),
    ]).then(([c, ta, s, col]) => {
      setClientes(c);
      setTiposAbertura(ta);
      setSistemas(s);
      setColoresDB(col);
    });
  }, []);

  // Cargar datos si estamos en modo edición
  useEffect(() => {
    if (!isEdit || !editId || editLoadedRef.current) return;
    editLoadedRef.current = true;
    api.get<FullOperacion>(`/operaciones/${editId}`).then(op => {
      if (op.estado === 'aprobado') {
        toast.error('Presupuesto aprobado: no puede editarse');
        navigate('/presupuestos');
        return;
      }
      setEditEstado(op.estado);
      setClienteId(op.cliente_id);
      setTipoProyecto(op.tipo_proyecto ?? '');
      setFormaPago(op.forma_pago ?? 'Precio de lista');
      setTiempoEntrega(op.tiempo_entrega ? String(op.tiempo_entrega) : '');
      setFechaValidez(op.fecha_validez ? op.fecha_validez.split('T')[0] : '');
      setValidezDias('custom');
      setNotas(op.notas ?? '');
      setNotasInternas(op.notas_internas ?? '');
      setFormaEnvio(op.forma_envio ?? 'retiro_local');
      setCostoEnvio(Number(op.costo_envio) || 0);
      setItems(op.items.map(it => ({
        _key: uuid(),
        producto_id:         it.producto_id ?? '',
        tipo_item:           (it.medida_ancho || it.medida_alto) ? 'a_medida' : 'estandar',
        tipo_abertura_id:    it.tipo_abertura_id ?? '',
        sistema_id:          it.sistema_id ?? '',
        descripcion:         it.descripcion,
        medida_ancho:        it.medida_ancho ? String(it.medida_ancho) : '',
        medida_alto:         it.medida_alto  ? String(it.medida_alto)  : '',
        cantidad:            it.cantidad,
        costo_unitario:      Number(it.costo_unitario),
        precio_unitario:     Number(it.precio_unitario),
        incluye_instalacion: it.incluye_instalacion,
        costo_instalacion:   Number(it.costo_instalacion),
        precio_instalacion:  Number(it.precio_instalacion),
        vidrio:              it.vidrio ?? '',
        premarco:            it.premarco ?? false,
        origen:              (it.origen as 'proveedor' | 'fabricacion') ?? 'proveedor',
        color:               it.color ?? '',
        accesorios:          it.accesorios ?? [],
        _prod_ancho: null, _prod_alto: null, _prod_atributos: {}, _prod_stock: 0,
        _prod_tipo_nombre:    it.tipo_abertura_nombre ?? '',
        _prod_sistema_nombre: it.sistema_nombre ?? '',
      })));
    }).catch(() => { toast.error('No se pudo cargar el presupuesto'); navigate('/presupuestos'); });
  }, [isEdit, editId, navigate]);

  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre ?? ''} ${c.apellido ?? ''} ${c.razon_social ?? ''} ${c.telefono ?? ''}`.toLowerCase()
      .includes(clienteSearch.toLowerCase())
  );
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  function updateItem(key: string, field: keyof ItemForm, value: unknown) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  const precioTotal    = items.reduce((s, it) => s + itemPrecioTotal(it), 0);
  const totalConEnvio  = precioTotal + (formaEnvio === 'envio_empresa' ? costoEnvio : 0);

  // Derivar tipo de operacion desde items
  function derivarTipo() {
    const tieneFab = items.some(i => i.origen === 'fabricacion');
    return tieneFab ? 'fabricacion_propia' : 'a_medida_proveedor';
  }

  // Agrega ítem desde catálogo — si ya existe incrementa cantidad
  function agregarProducto(p: CatalogProduct) {
    setItems(prev => {
      const existente = prev.find(it => it.producto_id === p.id);
      if (existente) {
        return prev.map(it =>
          it.producto_id === p.id ? { ...it, cantidad: it.cantidad + 1 } : it
        );
      }
      return [...prev, {
        _key:                uuid(),
        producto_id:         p.id,
        tipo_item:           'estandar',
        tipo_abertura_id:    p.tipo_abertura_id   ?? '',
        sistema_id:          p.sistema_id         ?? '',
        descripcion:         p.codigo ? `${p.codigo} — ${p.nombre}` : p.nombre,
        medida_ancho:        '',
        medida_alto:         '',
        cantidad:            1,
        costo_unitario:      Number(p.costo_base)  || 0,
        precio_unitario:     Number(p.precio_base) || 0,
        incluye_instalacion: false,
        costo_instalacion:   0,
        precio_instalacion:  0,
        vidrio:              p.vidrio             ?? '',
        premarco:            p.premarco           ?? false,
        origen:              'proveedor',
        color:               p.color              ?? '',
        accesorios:          p.accesorios         ?? [],
        _prod_ancho:         p.ancho              ?? null,
        _prod_alto:          p.alto               ?? null,
        _prod_atributos:     p.atributos          ?? {},
        _prod_stock:         p.stock_actual        ?? 0,
        _prod_tipo_nombre:   p.tipo_abertura?.nombre ?? '',
        _prod_sistema_nombre: p.sistema?.nombre    ?? '',
      }];
    });
    setCodigoSearch('');
    setCodigoResults([]);
    setShowCodigo(false);
    setTimeout(() => codigoRef.current?.focus(), 50);
  }

  const buscarCodigo = useCallback(async (q: string, exactOnEnter = false) => {
    if (!q.trim()) { setCodigoResults([]); setShowCodigo(false); return; }
    setCodigoLoading(true);
    try {
      const res = await api.get<CatalogProduct[]>(
        `/catalogo/productos?search=${encodeURIComponent(q.trim())}`
      );
      // Scanner: si hay match exacto por código → auto-agregar
      if (exactOnEnter) {
        const exact = res.find(r => r.codigo?.toLowerCase() === q.trim().toLowerCase());
        if (exact) { agregarProducto(exact); setCodigoLoading(false); return; }
      }
      setCodigoResults(res.slice(0, 8));
      setShowCodigo(res.length > 0);
    } catch {
      setCodigoResults([]);
    } finally {
      setCodigoLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce al escribir (no en Enter)
  useEffect(() => {
    if (!codigoSearch.trim()) { setCodigoResults([]); setShowCodigo(false); return; }
    const t = setTimeout(() => buscarCodigo(codigoSearch, false), 300);
    return () => clearTimeout(t);
  }, [codigoSearch, buscarCodigo]);

  async function handleSave() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return; }

    setSaving(true);
    try {
      const payload = {
        tipo:           derivarTipo(),
        estado:         'presupuesto',
        cliente_id:     clienteId,
        tipo_proyecto:  tipoProyecto || null,
        forma_pago:     formaPago || null,
        tiempo_entrega: tiempoEntrega ? parseInt(tiempoEntrega) : null,
        notas:          notas || null,
        notas_internas: notasInternas || null,
        fecha_validez:  fechaValidez || null,
        forma_envio:    formaEnvio,
        costo_envio:    costoEnvio,
        items: items.map((it, idx) => ({
          tipo_abertura_id:   it.tipo_abertura_id || null,
          sistema_id:         it.sistema_id || null,
          descripcion:        it.descripcion || '',
          medida_ancho:       it.medida_ancho ? parseFloat(it.medida_ancho) : null,
          medida_alto:        it.medida_alto  ? parseFloat(it.medida_alto)  : null,
          cantidad:           it.cantidad,
          costo_unitario:     it.costo_unitario,
          precio_unitario:    it.precio_unitario,
          incluye_instalacion: it.incluye_instalacion,
          costo_instalacion:  it.costo_instalacion,
          precio_instalacion: it.precio_instalacion,
          vidrio:             it.vidrio || null,
          premarco:           it.premarco,
          origen:             it.origen,
          color:              it.color || null,
          accesorios:         it.accesorios,
          orden:              idx,
          producto_id:        it.producto_id || null,
        })),
      };
      const op = isEdit
        ? await api.put<{ id: string; numero: string }>(`/operaciones/${editId}`, payload)
        : await api.post<{ id: string; numero: string }>('/operaciones', payload);
      toast.success(isEdit ? `Presupuesto ${op.numero} actualizado` : `Presupuesto ${op.numero} creado`);
      setSavedId(op.id);
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const labelCls = 'block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
          <ArrowLeft size={17} className="text-gray-500" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-violet-600" />
        </div>
        <h1 className="text-base font-bold text-gray-900">
          {isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        </h1>
      </div>

      {/* Sección: Cliente + Proyecto */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente y proyecto</h2>

        {/* Cliente */}
        <div>
          <label className={labelCls}>Cliente *</label>
          {clienteSeleccionado ? (
            <div className="flex items-center justify-between bg-violet-50 rounded-lg px-4 py-2.5 border border-violet-200">
              <div>
                <p className="text-sm font-semibold text-violet-800">
                  {clienteSeleccionado.tipo_persona === 'juridica'
                    ? clienteSeleccionado.razon_social
                    : `${clienteSeleccionado.nombre ?? ''} ${clienteSeleccionado.apellido ?? ''}`.trim()}
                </p>
                <p className="text-xs text-violet-600">{clienteSeleccionado.telefono ?? '—'}</p>
              </div>
              <button onClick={() => { setClienteId(''); setClienteSearch(''); }}
                className="text-xs text-violet-600 hover:underline">Cambiar</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" placeholder="Buscar cliente por nombre, teléfono..."
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                onFocus={() => setShowClienteList(true)}
                className={inputCls} />
              {showClienteList && clienteSearch && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No encontrado.{' '}
                      <button className="text-violet-600 hover:underline"
                        onClick={() => navigate('/clientes/nuevo?nombre=' + clienteSearch)}>
                        Crear cliente
                      </button>
                    </div>
                  ) : clientesFiltrados.slice(0, 8).map(c => (
                    <button key={c.id}
                      onClick={() => { setClienteId(c.id); setClienteSearch(''); setShowClienteList(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between">
                      <span className="text-sm text-gray-800">
                        {c.tipo_persona === 'juridica' ? c.razon_social : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}
                      </span>
                      <span className="text-xs text-gray-400">{c.telefono ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Tipo de proyecto</label>
            <select value={tipoProyecto} onChange={e => setTipoProyecto(e.target.value)} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Forma de pago</label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
              {FORMA_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tiempo de entrega (días)</label>
            <input type="number" min={0} value={tiempoEntrega}
              onChange={e => setTiempoEntrega(e.target.value)}
              placeholder="Ej: 15" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Período de validez</label>
            <div className="flex gap-1 mb-2">
              {([7, 15, 30] as const).map(d => (
                <button key={d} type="button"
                  onClick={() => {
                    setValidezDias(d);
                    const f = new Date(); f.setDate(f.getDate() + d);
                    setFechaValidez(`${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`);
                  }}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                    validezDias === d
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600')}>
                  {d} días
                </button>
              ))}
              <button type="button"
                onClick={() => setValidezDias('custom')}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                  validezDias === 'custom'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600')}>
                Personalizada
              </button>
            </div>
            {validezDias === 'custom' ? (
              <input type="date" value={fechaValidez}
                onChange={e => setFechaValidez(e.target.value)}
                className={inputCls} />
            ) : (
              <p className="text-xs text-gray-500 px-1">
                Vence: <span className="font-medium text-gray-700">
                  {new Date(fechaValidez + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sección: Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Ítems del presupuesto
              <span className="ml-2 text-gray-400 font-normal normal-case">{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowGaleria(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white hover:bg-violet-50 text-violet-600 border border-violet-200 hover:border-violet-400 rounded-lg font-medium transition-colors">
                <LayoutGrid size={13} /> Galería de productos
              </button>
              <button onClick={() => setItems(prev => [...prev, emptyItem()])}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium">
                <Plus size={13} /> Ítem manual
              </button>
            </div>
          </div>

          {/* Buscador por código / lector */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 border border-violet-200 bg-violet-50 rounded-xl focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-violet-400 transition-all">
              <ScanLine size={15} className="text-violet-400 shrink-0" />
              <input
                ref={codigoRef}
                value={codigoSearch}
                onChange={e => setCodigoSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    buscarCodigo(codigoSearch, true);
                  }
                  if (e.key === 'Escape') { setCodigoSearch(''); setShowCodigo(false); }
                }}
                onFocus={() => codigoSearch && setShowCodigo(true)}
                onBlur={() => setTimeout(() => setShowCodigo(false), 150)}
                placeholder="Escanear código de barras o buscar por código / nombre de producto..."
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-violet-300 focus:outline-none"
              />
              {codigoLoading
                ? <Search size={13} className="text-violet-300 animate-pulse shrink-0" />
                : codigoSearch && (
                  <button onMouseDown={() => { setCodigoSearch(''); setCodigoResults([]); setShowCodigo(false); }}
                    className="text-violet-300 hover:text-violet-500">
                    ×
                  </button>
                )
              }
            </div>
            <p className="text-[10px] text-violet-400 mt-0.5 ml-1">
              Enter o lector de código → agrega automáticamente si hay coincidencia exacta
            </p>

            {/* Dropdown resultados */}
            {showCodigo && codigoResults.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {codigoResults.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={() => agregarProducto(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {p.codigo && (
                          <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                            {p.codigo}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-800 truncate">{p.nombre}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-violet-700 shrink-0">
                      {formatCurrency(Number(p.precio_base))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ScanLine size={28} className="text-violet-200 mb-3" />
              <p className="text-sm text-gray-400 font-medium">Sin ítems</p>
              <p className="text-xs text-gray-300 mt-1">
                Escanear código de barras o buscar por nombre arriba
              </p>
            </div>
          ) : (
            items.map((item, idx) => (
              <ItemCard
                key={item._key}
                item={item}
                idx={idx}
                tiposAbertura={tiposAbertura}
                sistemas={sistemas}
                coloresDB={coloresDB}
                onChange={updateItem}
                onRemove={key => setItems(prev => prev.filter(it => it._key !== key))}
                canRemove={true}
              />
            ))
          )}
        </div>

        {/* Formas de envío */}
        <div className="border-t border-gray-100 px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Truck size={12} /> Forma de envío
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FORMAS_ENVIO.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormaEnvio(value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all',
                  formaEnvio === value
                    ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                )}
              >
                <Icon size={13} className={formaEnvio === value ? 'text-violet-500' : color} />
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>
          {formaEnvio === 'envio_empresa' && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 shrink-0">Importe del envío:</label>
              <div className="w-48">
                <MontoInput
                  value={costoEnvio ? String(costoEnvio) : ''}
                  onChange={v => setCostoEnvio(parseFloat(v) || 0)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Total */}
        {precioTotal > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-end gap-4 text-sm">
              {formaEnvio === 'envio_empresa' && costoEnvio > 0 && (
                <div className="text-right text-xs text-gray-400">
                  <div>Subtotal: {formatCurrency(precioTotal)}</div>
                  <div>Envío: +{formatCurrency(costoEnvio)}</div>
                </div>
              )}
              <span className="text-gray-500">Total presupuesto:</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(totalConEnvio)}</span>
            </div>
            {formaPago === 'Tarjeta de crédito 3 cuotas sin interés' && (
              <div className="flex justify-end mt-1.5">
                <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-3 py-1 rounded-lg border border-violet-100">
                  a pagar en 3 cuotas de {formatCurrency(totalConEnvio / 3)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Notas para el cliente</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
            placeholder="Condiciones, aclaraciones, forma de pago..."
            className={inputCls + ' resize-none'} />
        </div>
        <div>
          <label className={labelCls}>Notas internas</label>
          <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)} rows={3}
            placeholder="Solo para el equipo..."
            className={inputCls + ' resize-none'} />
        </div>
      </div>

      {/* Botones guardar — al final del formulario */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-4 border-t border-gray-200">
        <button onClick={() => navigate(-1)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 font-medium">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm">
          <Save size={15} />
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar presupuesto'}
        </button>
      </div>

      {savedId && (
        <PDFDialog
          title={isEdit ? 'Presupuesto actualizado' : 'Presupuesto creado'}
          subtitle="¿Querés generar el PDF ahora?"
          pdfUrl={`/imprimir/presupuesto/${savedId}`}
          onClose={() => { setSavedId(null); navigate(`/operaciones/${savedId}`); }}
          onNavigate={() => navigate(`/operaciones/${savedId}`)}
          navigateLabel="Ver presupuesto"
        />
      )}

      {showGaleria && (
        <GaleriaModal
          onSelect={p => agregarProducto(p)}
          onClose={() => setShowGaleria(false)}
        />
      )}
    </div>
  );
}
