import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Search, Layers, Package,
  X, AppWindow, DoorOpen, Tag, CalendarDays, RefreshCw, Play,
  Trash2, AlertTriangle, Store, DollarSign,
  Shield, Truck, Headphones, Award, SlidersHorizontal, ArrowUpDown, ChevronRight, Boxes,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, cn, disponibilidadVigente } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import {
  TarjetaProductoMosaico, isPromoActiva,
  TIPO_LABEL, TIPO_COLOR, MARGEN_LABEL, MARGEN_COLOR, ETIQUETA_CONFIG,
} from '@/components/TarjetaProductoMosaico';
import { ModalAjusteStock } from '@/components/ModalAjusteStock';
import type { Producto, TipoOperacion } from '@/types';

// Paleta de categorías — cada tipo de abertura (real, de la DB) toma un color en orden,
// ciclando si hay más tipos que colores. "Sin tipo" siempre queda gris al final.
const PALETA_CATEGORIAS = [
  { color: 'sky',     headerBg: 'bg-sky-50',     headerText: 'text-sky-700',     badgeText: 'text-sky-600 border-sky-200',     borderCol: 'border-sky-100',     priceColor: 'text-sky-700' },
  { color: 'violet',  headerBg: 'bg-violet-50',  headerText: 'text-violet-700',  badgeText: 'text-violet-600 border-violet-200',  borderCol: 'border-violet-100',  priceColor: 'text-violet-700' },
  { color: 'teal',    headerBg: 'bg-teal-50',    headerText: 'text-teal-700',    badgeText: 'text-teal-600 border-teal-200',    borderCol: 'border-teal-100',    priceColor: 'text-teal-700' },
  { color: 'orange',  headerBg: 'bg-orange-50',  headerText: 'text-orange-700',  badgeText: 'text-orange-600 border-orange-200',  borderCol: 'border-orange-100',  priceColor: 'text-orange-700' },
  { color: 'rose',    headerBg: 'bg-rose-50',    headerText: 'text-rose-700',    badgeText: 'text-rose-600 border-rose-200',    borderCol: 'border-rose-100',    priceColor: 'text-rose-700' },
  { color: 'indigo',  headerBg: 'bg-indigo-50',  headerText: 'text-indigo-700',  badgeText: 'text-indigo-600 border-indigo-200',  borderCol: 'border-indigo-100',  priceColor: 'text-indigo-700' },
  { color: 'amber',   headerBg: 'bg-amber-50',   headerText: 'text-amber-700',   badgeText: 'text-amber-600 border-amber-200',   borderCol: 'border-amber-100',   priceColor: 'text-amber-700' },
  { color: 'fuchsia', headerBg: 'bg-fuchsia-50', headerText: 'text-fuchsia-700', badgeText: 'text-fuchsia-600 border-fuchsia-200', borderCol: 'border-fuchsia-100', priceColor: 'text-fuchsia-700' },
];
const CATEGORIA_SIN_TIPO = {
  color: 'gray', headerBg: 'bg-gray-50', headerText: 'text-gray-600', badgeText: 'text-gray-500 border-gray-200',
  borderCol: 'border-gray-200', priceColor: 'text-gray-700',
};

// Botones de filtro — clases completas por color (Tailwind necesita las clases literales)
const FILTRO_BTN: Record<string, { active: string; inactive: string }> = {
  sky:     { active: 'bg-sky-600 text-white shadow-md shadow-sky-200',         inactive: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100' },
  violet:  { active: 'bg-violet-600 text-white shadow-md shadow-violet-200',   inactive: 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100' },
  teal:    { active: 'bg-teal-600 text-white shadow-md shadow-teal-200',       inactive: 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100' },
  orange:  { active: 'bg-orange-600 text-white shadow-md shadow-orange-200',   inactive: 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100' },
  rose:    { active: 'bg-rose-600 text-white shadow-md shadow-rose-200',       inactive: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' },
  indigo:  { active: 'bg-indigo-600 text-white shadow-md shadow-indigo-200',   inactive: 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100' },
  amber:   { active: 'bg-amber-600 text-white shadow-md shadow-amber-200',     inactive: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' },
  fuchsia: { active: 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-200', inactive: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-100' },
  emerald: { active: 'bg-emerald-600 text-white shadow-md shadow-emerald-200', inactive: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' },
  gray:    { active: 'bg-gray-700 text-white shadow-md shadow-gray-200',       inactive: 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100' },
};

const SIN_TIPO_KEY = '__sin_tipo__';
const EN_SALON_KEY = '__en_salon__';

interface Categoria { id: string; nombre: string; parent_id: string | null; orden: number; activo: boolean; }

const NIVEL_COMERCIAL_LABEL: Record<string, string> = {
  economica: 'Económica', estandar: 'Estándar', premium: 'Premium', alta_seguridad: 'Alta seguridad',
};
const NIVEL_COMERCIAL_COLOR: Record<string, string> = {
  economica: 'bg-slate-50 text-slate-600 border-slate-200',
  estandar: 'bg-sky-50 text-sky-700 border-sky-200',
  premium: 'bg-violet-50 text-violet-700 border-violet-200',
  alta_seguridad: 'bg-red-50 text-red-700 border-red-200',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const L_TIPO_VENTANA: Record<string, string> = {
  corrediza:'Corrediza',con_celosia:'Con celosía',de_abrir:'De abrir',
  banderola:'Banderola',ventiluz:'Ventiluz',aireador:'Aireador',persiana:'Persiana',
};
const L_HOJAS_VNT: Record<string, string> = {
  '2_hojas':'2 hojas','3_hojas':'3 hojas','4_hojas':'4 hojas',
};
const L_CONFIG_HOJAS: Record<string, string> = {
  hoja_simple:'Hoja simple',hoja_y_media:'Hoja y media',
  dos_hojas:'2 hojas iguales',puerta_pano_fijo:'Puerta + paño fijo',
};
const L_MARCO: Record<string, string> = { transitable:'Transitable',no_transitable:'No transitable' };
const L_USO: Record<string, string> = { interior:'Interior',exterior:'Exterior',ingreso_frente:'Ingreso/Frente' };

function buildSubtitle(p: Producto): string {
  const a = p.atributos ?? {};
  const parts: string[] = [];
  if (a.tipo_ventana) parts.push(L_TIPO_VENTANA[a.tipo_ventana as string] ?? String(a.tipo_ventana));
  if (a.config_hojas) parts.push(L_CONFIG_HOJAS[a.config_hojas as string] ?? String(a.config_hojas));
  if (a.hojas)        parts.push(L_HOJAS_VNT[a.hojas as string] ?? String(a.hojas));
  if (a.marco_tipo)   parts.push(L_MARCO[a.marco_tipo as string] ?? String(a.marco_tipo));
  if (a.uso)          parts.push(L_USO[a.uso as string] ?? String(a.uso));
  if (p.ancho && p.alto) parts.push(`${p.ancho} × ${p.alto} cm`);
  return parts.join(' · ');
}
function lastDayOfMonth(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}
// ── Ordenamiento ──────────────────────────────────────────────────────────────

type SortKey = 'relevancia' | 'precio_asc' | 'precio_desc' | 'stock_desc' | 'nombre';

const SORT_LABEL: Record<SortKey, string> = {
  relevancia:  'Más relevantes',
  precio_asc:  'Precio: menor a mayor',
  precio_desc: 'Precio: mayor a menor',
  stock_desc:  'Más stock disponible',
  nombre:      'Nombre A-Z',
};
const ETIQ_RANK: Record<string, number> = { mas_vendido: 0, recomendado: 1, nuevo: 2 };

function precioEfectivo(p: Producto): number {
  return isPromoActiva(p) && p.promocion?.precio_oferta ? p.promocion.precio_oferta : p.precio_base;
}
function sortProductos(lista: Producto[], sortBy: SortKey): Producto[] {
  const arr = [...lista];
  switch (sortBy) {
    case 'precio_asc':  return arr.sort((a, b) => precioEfectivo(a) - precioEfectivo(b));
    case 'precio_desc': return arr.sort((a, b) => precioEfectivo(b) - precioEfectivo(a));
    case 'stock_desc':  return arr.sort((a, b) => (b.stock_actual ?? 0) - (a.stock_actual ?? 0));
    case 'nombre':      return arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
    default:
      return arr.sort((a, b) => {
        const ra = a.etiqueta ? ETIQ_RANK[a.etiqueta] ?? 3 : 3;
        const rb = b.etiqueta ? ETIQ_RANK[b.etiqueta] ?? 3 : 3;
        if (ra !== rb) return ra - rb;
        if (a.en_salon !== b.en_salon) return a.en_salon ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      });
  }
}

// ── Filtros por atributo (facetas) ─────────────────────────────────────────────
// Se calculan dinámicamente desde los productos de la categoría activa — no hardcodean
// el schema por tipo_abertura (ver 20260424000002_catalogo_atributos_schema.sql), así
// se adaptan solos si se agregan nuevos atributos desde NuevoProducto.tsx.

interface FacetOption { value: string; label: string; count: number }
interface FacetDef { key: string; label: string; options: FacetOption[] }

const ATTR_FACET_LABEL: Record<string, string> = {
  tipo_puerta: 'Tipo', uso: 'Uso', config_hojas: 'Config. de hojas', apertura: 'Apertura',
  cerradura: 'Cerradura', vidrio_incluye: 'Vidrio', instalacion: 'Instalación',
  estructura: 'Estructura', hoja_principal: 'Hoja principal', tipo_ventana: 'Tipo',
  hojas: 'Cantidad de hojas', marco_tipo: 'Marco', tipo_provision: 'Provisión',
};
const ATTR_VALUE_MAPS: Record<string, Record<string, string>> = {
  tipo_ventana: L_TIPO_VENTANA, hojas: L_HOJAS_VNT, config_hojas: L_CONFIG_HOJAS,
  marco_tipo: L_MARCO, uso: L_USO,
};
function attrValueLabel(key: string, v: string): string {
  if (v === '__true__') return 'Sí';
  if (v === '__false__') return 'No';
  return ATTR_VALUE_MAPS[key]?.[v] ?? v.replace(/_/g, ' ');
}
function buildFacets(items: Producto[]): FacetDef[] {
  const facets: FacetDef[] = [];

  const nivelCounts = new Map<string, number>();
  items.forEach(p => { if (p.nivel_comercial) nivelCounts.set(p.nivel_comercial, (nivelCounts.get(p.nivel_comercial) ?? 0) + 1); });
  if (nivelCounts.size >= 2) {
    facets.push({
      key: 'nivel_comercial', label: 'Nivel',
      options: [...nivelCounts.entries()].map(([value, count]) => ({ value, label: NIVEL_COMERCIAL_LABEL[value] ?? value, count })),
    });
  }

  const colorCounts = new Map<string, number>();
  items.forEach(p => { if (p.color) colorCounts.set(p.color, (colorCounts.get(p.color) ?? 0) + 1); });
  if (colorCounts.size >= 2) {
    facets.push({
      key: 'color', label: 'Color',
      options: [...colorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: value, count })),
    });
  }

  const medidaCounts = new Map<string, number>();
  items.forEach(p => {
    if (p.ancho && p.alto) {
      const k = `${p.ancho}x${p.alto}`;
      medidaCounts.set(k, (medidaCounts.get(k) ?? 0) + 1);
    }
  });
  if (medidaCounts.size >= 2) {
    facets.push({
      key: '__medida', label: 'Medida (cm)',
      options: [...medidaCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([value, count]) => ({ value, label: value.replace('x', ' × '), count })),
    });
  }

  const attrCounts = new Map<string, Map<string, number>>();
  items.forEach(p => {
    Object.entries(p.atributos ?? {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || Array.isArray(v) || typeof v === 'object') return;
      const sv = typeof v === 'boolean' ? (v ? '__true__' : '__false__') : String(v);
      if (!attrCounts.has(k)) attrCounts.set(k, new Map());
      const m = attrCounts.get(k)!;
      m.set(sv, (m.get(sv) ?? 0) + 1);
    });
  });
  attrCounts.forEach((m, key) => {
    if (m.size < 2 || m.size > 8) return;
    facets.push({
      key: `attr:${key}`,
      label: ATTR_FACET_LABEL[key] ?? key.replace(/_/g, ' '),
      options: [...m.entries()].map(([value, count]) => ({ value, label: attrValueLabel(key, value), count })),
    });
  });

  return facets;
}
function productoPasaFacets(p: Producto, activos: Record<string, string[]>): boolean {
  for (const [key, values] of Object.entries(activos)) {
    if (!values.length) continue;
    if (key === 'color') {
      if (!p.color || !values.includes(p.color)) return false;
    } else if (key === 'nivel_comercial') {
      if (!p.nivel_comercial || !values.includes(p.nivel_comercial)) return false;
    } else if (key === '__medida') {
      const k = p.ancho && p.alto ? `${p.ancho}x${p.alto}` : '';
      if (!values.includes(k)) return false;
    } else if (key.startsWith('attr:')) {
      const raw = p.atributos?.[key.slice(5)];
      const sv = typeof raw === 'boolean' ? (raw ? '__true__' : '__false__') : raw == null ? '' : String(raw);
      if (!values.includes(sv)) return false;
    }
  }
  return true;
}
// ── Modal de detalle ──────────────────────────────────────────────────────────

export function ProductoModal({ producto, onClose, onToggle, onToggleSalon, onDelete, onAgregar }: {
  producto: Producto; onClose: () => void; onToggle?: () => void; onToggleSalon?: () => Promise<void>;
  onDelete?: (id: string) => void; onAgregar?: () => void;
}) {
  const [activeImg, setActiveImg]     = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando]   = useState(false);
  const [dolarCompra, setDolarCompra] = useState<number | null>(null);
  const [togglingSalon, setTogglingSalon] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleToggleSalon() {
    if (!onToggleSalon || togglingSalon) return;
    setTogglingSalon(true);
    try {
      await onToggleSalon();
    } finally {
      setTogglingSalon(false);
    }
  }

  useEffect(() => {
    api.get<{ compra: number }>('/catalogo/cotizacion-dolar').then(d => setDolarCompra(d.compra)).catch(() => {});
  }, []);
  const costo  = producto.costo_base;
  const precio = producto.precio_base;
  const margen = precio > 0 ? Math.round((precio - costo) / precio * 100) : 0;
  const subtitle = buildSubtitle(producto);
  const imagenes = producto.imagenes?.length ? producto.imagenes : producto.imagen_url ? [producto.imagen_url] : [];
  const attrs: [string, string][] = Object.entries(producto.atributos ?? {})
    .filter(([, v]) => v !== null && v !== '' && !Array.isArray(v))
    .map(([k, v]) => [k.replace(/_/g, ' '), String(v)]);

  async function handleDelete() {
    setEliminando(true);
    try {
      await api.delete(`/productos/${producto.id}`);
      toast.success(`"${producto.nombre}" eliminado del catálogo`);
      onDelete?.(producto.id); onClose();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo eliminar');
      setConfirmando(false);
    } finally { setEliminando(false); }
  }

  if (confirmando) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-600 px-6 py-5 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3"><AlertTriangle size={28} className="text-white" /></div>
          <p className="text-white font-bold text-lg">Eliminar producto</p>
          <p className="text-red-200 text-xs mt-1">Esta acción no se puede deshacer</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-red-500 font-medium mb-1">Producto a eliminar</p>
            <p className="text-sm font-bold text-red-800">"{producto.nombre}"</p>
          </div>
          <p className="text-xs text-gray-500 text-center">Se eliminará permanentemente. Los presupuestos existentes no se verán afectados.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setConfirmando(false)} className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50">Cancelar</button>
            <button onClick={handleDelete} disabled={eliminando}
              className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2">
              {eliminando ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Eliminando...</> : <><Trash2 size={14}/>Sí, eliminar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-5 py-4 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>{TIPO_LABEL[producto.tipo]}</span>
              {producto.etiqueta && ETIQUETA_CONFIG[producto.etiqueta] && (() => {
                const cfg = ETIQUETA_CONFIG[producto.etiqueta!];
                return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', cfg.cls)}><cfg.Icon size={9}/>{cfg.label}</span>;
              })()}
              {producto.codigo && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{producto.codigo}</span>}
              {onToggleSalon ? (
                <button type="button" onClick={handleToggleSalon} disabled={togglingSalon}
                  title={producto.en_salon ? 'Quitar de exhibición en salón' : 'Marcar exhibido en salón'}
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors disabled:opacity-60',
                    producto.en_salon
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}>
                  <Store size={9}/>{togglingSalon ? 'Guardando...' : producto.en_salon ? 'En salón' : 'Marcar en salón'}
                </button>
              ) : producto.en_salon && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-100 text-emerald-700">
                  <Store size={9}/>En salón
                </span>
              )}
              {!producto.activo && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">Inactivo</span>}
            </div>
            <h2 className="text-base font-bold text-gray-900">{producto.nombre}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4">
          {imagenes.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center">
                <img src={imagenes[activeImg]} alt={producto.nombre} className="max-w-full max-h-full object-contain"/>
              </div>
              {imagenes.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {imagenes.map((url, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={cn('w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all', i === activeImg ? 'border-sky-500' : 'border-transparent hover:border-gray-300')}>
                      <img src={url} alt="" className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {producto.video_url && (
            <a href={producto.video_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100">
              <Play size={13} className="fill-red-500 text-red-500"/> Ver video del producto
            </a>
          )}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Precio de venta</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(precio)}{producto.precio_por_m2 && <span className="text-xs font-normal text-gray-400">/m²</span>}</span>
            </div>
            {dolarCompra && precio > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Valor U$S</span>
                <span className="text-sm font-semibold text-sky-700">
                  U$S {(precio / dolarCompra).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Costo</span>
              <span className="text-sm text-gray-600">{formatCurrency(costo)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Margen</span>
              <span className={cn('text-sm font-semibold', margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>{margen}%</span>
            </div>
            {producto.margen_tipo && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Segmento</span>
                <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', MARGEN_COLOR[producto.margen_tipo])}>{MARGEN_LABEL[producto.margen_tipo]}</span>
              </div>
            )}
          </div>
          {producto.promocion && (
            <div className={cn('rounded-xl p-3 border', isPromoActiva(producto) ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-200 opacity-60')}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <Tag size={13} className={isPromoActiva(producto) ? 'text-pink-500' : 'text-gray-400'}/>
                <span className="text-xs font-semibold text-gray-700">Promoción {isPromoActiva(producto) ? '· activa' : '· inactiva'}</span>
                {producto.promocion.auto_renovar && <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-700 font-medium"><RefreshCw size={9}/>Auto-renovar mensual</span>}
              </div>
              {producto.promocion.precio_oferta && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-pink-700">{formatCurrency(producto.promocion.precio_oferta)}</span>
                  <span className="text-xs text-gray-400 line-through">{formatCurrency(precio)}</span>
                  <span className="text-xs text-pink-600 font-medium">-{Math.round((1 - producto.promocion.precio_oferta / precio) * 100)}%</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1 flex-wrap">
                <CalendarDays size={10}/>
                {producto.promocion.fecha_inicio && <span>desde {producto.promocion.fecha_inicio}</span>}
                {producto.promocion.auto_renovar ? <span>hasta el {lastDayOfMonth()} (renovación mensual)</span> : producto.promocion.fecha_fin && <span>hasta {producto.promocion.fecha_fin}</span>}
              </div>
            </div>
          )}
          {((producto.tipo_abertura as any)?.nombre || (producto.sistema as any)?.nombre || producto.color || attrs.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Especificaciones</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(producto.tipo_abertura as any)?.nombre && <Row k="Tipo" v={(producto.tipo_abertura as any).nombre}/>}
                {(producto.sistema as any)?.nombre && <Row k="Sistema" v={(producto.sistema as any).nombre}/>}
                {producto.color && <Row k="Color" v={producto.color}/>}
                {attrs.slice(0, 8).map(([k, v]) => <Row key={k} k={k} v={v}/>)}
              </div>
            </div>
          )}
          {([producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4].filter(Boolean) as string[]).length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Características</p>
              <ul className="space-y-1">
                {[producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4].filter(Boolean).map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600"><span className="mt-0.5 text-sky-400">·</span>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {(producto.vidrio || producto.premarco || producto.accesorios?.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Incluye</p>
              <div className="flex flex-wrap gap-1.5">
                {producto.vidrio && <Tag2 label={`Vidrio: ${producto.vidrio}`}/>}
                {producto.premarco && <Tag2 label="Premarco"/>}
                {(producto.accesorios ?? []).map(a => <Tag2 key={a} label={a.replace(/_/g,' ')}/>)}
              </div>
            </div>
          )}
          {producto.descripcion && <p className="text-xs text-gray-500 border-t border-gray-200 pt-3">{producto.descripcion}</p>}
        </div>

        {onAgregar ? (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-2xl px-5 py-3 flex items-center justify-end gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Cerrar</button>
            <button onClick={() => { onAgregar(); onClose(); }}
              className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Plus size={13}/>Agregar a la proforma
            </button>
          </div>
        ) : (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-2xl px-5 py-3 flex items-center justify-between gap-2">
            <button onClick={onToggle}
              className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                producto.activo ? 'border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-500' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
              {producto.activo ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
              {producto.activo ? 'Desactivar' : 'Activar'}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmando(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"><Trash2 size={12}/>Eliminar</button>
              <Link to={`/productos/${producto.id}`} onClick={onClose}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium"><Pencil size={12}/>Editar</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><span className="text-[10px] text-gray-400 capitalize">{k}</span><p className="text-xs font-medium text-gray-700 capitalize">{v}</p></div>;
}
function Tag2({ label }: { label: string }) {
  return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{label}</span>;
}


// ── Grid mosaico (reutilizado por Columna y por las vistas planas) ─────────────

// Agrupa por modelo_id preservando el orden de la lista (que ya viene ordenada por
// sortBy) — un modelo con 2+ variantes visibles se muestra como UNA ficha; con 0 o 1
// variante en el listado actual (ej. filtrado por facetas) se muestra suelto, como antes.
type ItemGrilla =
  | { tipo: 'modelo'; modeloId: string; nombre: string; variantes: Producto[] }
  | { tipo: 'suelto'; producto: Producto };

function agruparPorModelo(productos: Producto[]): ItemGrilla[] {
  const countByModelo = new Map<string, number>();
  productos.forEach(p => { if (p.modelo_id) countByModelo.set(p.modelo_id, (countByModelo.get(p.modelo_id) ?? 0) + 1); });
  const vistos = new Set<string>();
  const items: ItemGrilla[] = [];
  productos.forEach(p => {
    if (p.modelo_id && (countByModelo.get(p.modelo_id) ?? 0) > 1) {
      if (vistos.has(p.modelo_id)) return;
      vistos.add(p.modelo_id);
      items.push({ tipo: 'modelo', modeloId: p.modelo_id, nombre: p.modelo?.nombre ?? 'Modelo', variantes: productos.filter(x => x.modelo_id === p.modelo_id) });
    } else {
      items.push({ tipo: 'suelto', producto: p });
    }
  });
  return items;
}

function variantResumen(p: Producto): string {
  const partes: string[] = [];
  if (p.ancho && p.alto) partes.push(`${p.ancho} × ${p.alto} cm`);
  if (p.color) partes.push(p.color);
  return partes.join(' · ') || '—';
}

function ModeloVariantesModal({ nombre, variantes, priceColor, onClose, onSelect }: {
  nombre: string; variantes: Producto[]; priceColor: string; onClose: () => void; onSelect: (p: Producto) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-base font-bold text-gray-900">{nombre}</p>
            <p className="text-xs text-gray-400">{variantes.length} variantes — elegí una</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X size={16}/></button>
        </div>
        <div className="divide-y divide-gray-100">
          {variantes.map(v => {
            const img = v.imagenes?.[0] || v.imagen_url;
            return (
              <button key={v.id} onClick={() => onSelect(v)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left">
                <div className="w-11 h-11 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                  {img ? <img src={img} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-200"/></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{variantResumen(v)}</p>
                  {v.codigo && <p className="font-mono text-[10px] text-gray-400">{v.codigo}</p>}
                </div>
                <span className={cn('text-sm font-bold shrink-0', priceColor)}>{formatCurrency(Number(v.precio_base))}</span>
                {(v.stock_actual ?? 0) <= 0 && <span className="text-[9px] font-bold text-red-500 shrink-0">Sin stock</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TarjetaModeloMosaico({ nombre, variantes, priceColor, onSelectVariante }: {
  nombre: string; variantes: Producto[]; priceColor: string; onSelectVariante: (p: Producto) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const conImagen = variantes.find(v => (v.imagenes?.length ?? 0) > 0 || v.imagen_url);
  const img = conImagen?.imagenes?.[0] || conImagen?.imagen_url;
  const precios = variantes.map(v => Number(v.precio_base)).filter(n => !Number.isNaN(n));
  const min = Math.min(...precios), max = Math.max(...precios);
  const colores = [...new Set(variantes.map(v => v.color).filter(Boolean))] as string[];
  const anyEnSalon = variantes.some(v => v.en_salon);

  return (
    <>
      <div className="group relative flex flex-col bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
        onClick={() => setAbierto(true)}>
        <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
          {img ? <img src={img} alt={nombre} loading="lazy" className="w-full h-full object-contain p-3"/>
            : <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-gray-200"/></div>}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white leading-none shadow-md flex items-center gap-1">
              <Boxes size={8}/>{variantes.length} variantes
            </span>
            {anyEnSalon && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white leading-none shadow-md flex items-center gap-1">
                <Store size={8}/>En salón
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col p-3">
          <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2">{nombre}</p>
          {colores.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-1">
              {colores.slice(0, 3).join(', ')}{colores.length > 3 ? ` +${colores.length - 3}` : ''}
            </p>
          )}
          <div className="mt-auto pt-2">
            <span className={cn('text-[15px] font-black leading-none', priceColor)}>
              {min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setAbierto(true); }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition-colors"
            >
              <Boxes size={12}/> Ver variantes
            </button>
          </div>
        </div>
      </div>
      {abierto && (
        <ModeloVariantesModal nombre={nombre} variantes={variantes} priceColor={priceColor}
          onClose={() => setAbierto(false)}
          onSelect={v => { setAbierto(false); onSelectVariante(v); }}/>
      )}
    </>
  );
}

function GridMosaico({ productos, priceColor, onSelect, onToggle, onToggleSalon }: {
  productos: Producto[]; priceColor: string;
  onSelect: (p: Producto) => void; onToggle: (p: Producto) => void;
  onToggleSalon?: (p: Producto) => void | Promise<void>;
}) {
  const items = agruparPorModelo(productos);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map(it => it.tipo === 'modelo'
        ? <TarjetaModeloMosaico key={`modelo-${it.modeloId}`} nombre={it.nombre} variantes={it.variantes} priceColor={priceColor} onSelectVariante={onSelect}/>
        : <TarjetaProductoMosaico key={it.producto.id} producto={it.producto} priceColor={priceColor} onSelect={onSelect} onToggle={onToggle} onToggleSalon={onToggleSalon}/>
      )}
    </div>
  );
}

// ── Columna por categoría ─────────────────────────────────────────────────────

const COL_INIT = 6;

function Columna({ titulo, productos, icono: Icono, headerBg, headerText, badgeBg, badgeText, borderCol, priceColor, onSelect, onToggle, onToggleSalon }: {
  titulo: string; productos: Producto[]; icono: React.ElementType;
  headerBg: string; headerText: string; badgeBg: string; badgeText: string;
  borderCol: string; priceColor: string;
  onSelect: (p: Producto) => void; onToggle: (p: Producto) => void;
  onToggleSalon?: (p: Producto) => void | Promise<void>;
}) {
  const [expandida, setExpandida] = useState(false);
  const visibles = expandida ? productos : productos.slice(0, COL_INIT);

  return (
    <div className={cn('flex flex-col rounded-2xl border overflow-hidden bg-white shadow-md', borderCol)}>
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center gap-2.5', headerBg)}>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', headerText)}>
          <Icono size={17}/>
        </div>
        <span className={cn('font-bold text-base', headerText)}>{titulo}</span>
        <span className={cn('ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border', badgeBg, badgeText)}>
          {productos.length} productos
        </span>
      </div>

      {productos.length === 0 ? (
        <div className="py-10 text-center text-xs text-gray-400">Sin productos en esta categoría</div>
      ) : (
        <>
          <div className="p-4">
            <GridMosaico productos={visibles} priceColor={priceColor} onSelect={onSelect} onToggle={onToggle} onToggleSalon={onToggleSalon}/>
          </div>

          {/* Ver todos / menos */}
          {productos.length > COL_INIT && (
          <div className={cn('border-t', borderCol)}>
            <button
              onClick={() => setExpandida(v => !v)}
              className={cn('w-full py-3 text-[12px] font-semibold flex items-center justify-center gap-1 transition-colors', headerBg, headerText, 'hover:brightness-95')}
            >
              {expandida
                ? 'Ver menos ↑'
                : `Ver todos los productos de ${titulo.toLowerCase()} →`}
            </button>
          </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tiles de marketing ────────────────────────────────────────────────────────

const MARKETING = [
  { Icon: Shield,     title: 'Calidad garantizada', desc: 'Entrega con garantía oficial',               bg: 'bg-sky-50',    icon: 'text-sky-500'    },
  { Icon: Truck,      title: 'Entrega rápida',       desc: 'Envíos a todo el país en tiempo y forma',   bg: 'bg-violet-50', icon: 'text-violet-500' },
  { Icon: Headphones, title: 'Asesoramiento experto',desc: 'Estamos para ayudarte',                     bg: 'bg-teal-50',   icon: 'text-teal-500'   },
  { Icon: Award,      title: 'Mejores materiales',   desc: 'Fabricamos con aluminio de primera calidad',bg: 'bg-amber-50',  icon: 'text-amber-500'  },
];

// ── Panel de facetas (filtros por atributo) ────────────────────────────────────

function FacetsPanel({ facets, activos, onToggle, onLimpiar, activeCount }: {
  facets: FacetDef[]; activos: Record<string, string[]>;
  onToggle: (key: string, value: string) => void; onLimpiar: () => void; activeCount: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <SlidersHorizontal size={13}/> Filtrar productos
        </p>
        {activeCount > 0 && (
          <button onClick={onLimpiar} className="text-[11px] text-sky-600 hover:underline font-medium">Limpiar</button>
        )}
      </div>
      {facets.map(f => (
        <div key={f.key} className="space-y-1.5 pt-3 border-t border-gray-100 first:border-0 first:pt-0">
          <p className="text-[11px] font-semibold text-gray-500">{f.label}</p>
          <div className="space-y-1">
            {f.options.map(opt => {
              const checked = (activos[f.key] ?? []).includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                  <input
                    type="checkbox" checked={checked}
                    onChange={() => onToggle(f.key, opt.value)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="capitalize flex-1">{opt.label}</span>
                  <span className="text-[10px] text-gray-400">({opt.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Producto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaPath, setCategoriaPath] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('relevancia');
  const [facetFilters, setFacetFilters] = useState<Record<string, string[]>>({});
  const [mobileFiltrosOpen, setMobileFiltrosOpen] = useState(false);
  const [showAjusteStock, setShowAjusteStock] = useState(false);
  const [ajusteProductoId, setAjusteProductoId] = useState<string | null>(null);
  // Si se abrió el ajuste porque se intentó marcar "en salón" sin stock, al guardar
  // el ajuste activamos "en salón" directo — no hace falta un segundo click.
  const [salonPendientePostAjuste, setSalonPendientePostAjuste] = useState<string | null>(null);

  const nodoActivoId = categoriaPath.length ? categoriaPath[categoriaPath.length - 1] : null;
  useEffect(() => { setFacetFilters({}); }, [nodoActivoId]);

  function toggleFacetValue(key: string, value: string) {
    setFacetFilters(prev => {
      const cur = prev[key] ?? [];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      const copy = { ...prev };
      if (next.length) copy[key] = next; else delete copy[key];
      return copy;
    });
  }
  const activeFacetCount = Object.values(facetFilters).reduce((s, v) => s + v.length, 0);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Producto[]>('/productos');
    setProductos(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Árbol de navegación (Familia → Uso → Material → Línea) — se arranca en la raíz ("Todos")
  useEffect(() => {
    api.get<Categoria[]>('/catalogo/categorias')
      .then(setCategorias)
      .catch(() => {});
  }, []);

  async function toggleActivo(producto: Producto) {
    const { activo } = await api.patch<{ id: string; activo: boolean }>(`/productos/${producto.id}/toggle`);
    setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, activo } : p));
    if (selected?.id === producto.id) setSelected(prev => prev ? { ...prev, activo } : null);
  }
  function eliminarProducto(id: string) { setProductos(prev => prev.filter(p => p.id !== id)); }

  function actualizarEnSalonLocal(id: string, en_salon: boolean) {
    setProductos(prev => prev.map(p => p.id === id ? { ...p, en_salon } : p));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, en_salon } : null);
  }
  function actualizarStockLocal(id: string, stock_actual: number) {
    setProductos(prev => prev.map(p => p.id === id ? { ...p, stock_actual } : p));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, stock_actual } : null);
  }

  async function aplicarToggleSalon(id: string) {
    try {
      const { en_salon } = await api.patch<{ id: string; en_salon: boolean }>(`/productos/${id}/toggle-salon`);
      actualizarEnSalonLocal(id, en_salon);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo actualizar');
    }
  }

  // Botón rápido "En salón" desde el detalle del producto — sin tener que entrar a
  // editar. Si no hay stock, sugiere cargarlo ahí mismo (mínimo 1) en vez de dejar
  // que el backend lo rechace.
  async function toggleSalonRapido(producto: Producto) {
    if (!producto.en_salon && (producto.stock_actual ?? 0) <= 0) {
      toast.info('Sin stock — cargá al menos 1 unidad para exhibirlo en salón');
      setAjusteProductoId(producto.id);
      setSalonPendientePostAjuste(producto.id);
      setShowAjusteStock(true);
      return;
    }
    await aplicarToggleSalon(producto.id);
  }

  async function handleAjusteGuardado(nuevoStock: number) {
    setShowAjusteStock(false);
    if (ajusteProductoId) actualizarStockLocal(ajusteProductoId, nuevoStock);
    if (salonPendientePostAjuste) {
      const id = salonPendientePostAjuste;
      setSalonPendientePostAjuste(null);
      if (nuevoStock > 0) await aplicarToggleSalon(id);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      (p.tipo_abertura as any)?.nombre?.toLowerCase().includes(q)
    );
  }, [productos, search]);

  // ── Árbol de categorías: hijos por padre, raíces, y set de descendientes por nodo
  // (navegar por categoría = filtrar por el nodo elegido O cualquiera de sus descendientes,
  // así un producto asignado a una Familia sin sub-niveles cargados todavía sigue visible).
  const hijosDe = useMemo(() => {
    const m: Record<string, Categoria[]> = {};
    categorias.forEach(c => { const k = c.parent_id ?? '__root__'; (m[k] ??= []).push(c); });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)));
    return m;
  }, [categorias]);
  const raices = hijosDe['__root__'] ?? [];
  const nodeById = useMemo(() => Object.fromEntries(categorias.map(c => [c.id, c])), [categorias]);
  const descendientesDe = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    function collect(id: string): Set<string> {
      if (map[id]) return map[id];
      const s = new Set<string>([id]);
      (hijosDe[id] ?? []).forEach(h => { collect(h.id).forEach(x => s.add(x)); });
      map[id] = s;
      return s;
    }
    categorias.forEach(c => collect(c.id));
    return map;
  }, [categorias, hijosDe]);
  function rootIdDe(id: string | null): string | null {
    if (!id) return null;
    let cur = nodeById[id];
    if (!cur) return null;
    while (cur.parent_id && nodeById[cur.parent_id]) cur = nodeById[cur.parent_id];
    return cur.id;
  }
  function paletaDeNodo(id: string): { color: string; priceColor: string } {
    if (id === EN_SALON_KEY) return { color: 'emerald', priceColor: 'text-emerald-700' };
    const rid = rootIdDe(id) ?? id;
    const idx = raices.findIndex(r => r.id === rid);
    return idx >= 0 ? PALETA_CATEGORIAS[idx % PALETA_CATEGORIAS.length] : CATEGORIA_SIN_TIPO;
  }

  // Agrupa por Familia (raíz del árbol) — vista "Todos" apilada. Cualquier categoría
  // nueva cargada en Configuración aparece sola al agregarle productos.
  function categorizarPorRaiz(lista: Producto[]) {
    const grupos: Record<string, Producto[]> = { [SIN_TIPO_KEY]: [] };
    raices.forEach(r => { grupos[r.id] = []; });
    lista.forEach(p => {
      const rid = rootIdDe(p.categoria_id);
      const key = rid && grupos[rid] ? rid : SIN_TIPO_KEY;
      grupos[key].push(p);
    });
    Object.keys(grupos).forEach(k => { grupos[k] = sortProductos(grupos[k], sortBy); });
    return grupos;
  }

  const gruposFiltrados = useMemo(() => categorizarPorRaiz(filtered), [filtered, raices, sortBy]);
  // Existencia por categoría en TODO el catálogo (para que los botones no aparezcan/desaparezcan al buscar)
  const existeCategoria = useMemo(() => {
    const c = categorizarPorRaiz(productos);
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.length > 0]));
  }, [productos, raices]);

  const columnas = [
    ...raices.map((t, i) => {
      const pal = PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
      const n = t.nombre.toLowerCase();
      const icono = n.includes('puerta') && !n.includes('balc') ? DoorOpen
        : (n.includes('ventana') || n.includes('balc')) ? AppWindow : Package;
      return {
        key: t.id, titulo: t.nombre, items: gruposFiltrados[t.id] ?? [], icono, color: pal.color,
        headerBg: pal.headerBg, headerText: pal.headerText, badgeBg: 'bg-white', badgeText: pal.badgeText,
        borderCol: pal.borderCol, priceColor: pal.priceColor,
      };
    }),
    ...(existeCategoria[SIN_TIPO_KEY] ? [{
      key: SIN_TIPO_KEY, titulo: 'Sin categoría', items: gruposFiltrados[SIN_TIPO_KEY] ?? [], icono: Package, color: CATEGORIA_SIN_TIPO.color,
      headerBg: CATEGORIA_SIN_TIPO.headerBg, headerText: CATEGORIA_SIN_TIPO.headerText, badgeBg: 'bg-white', badgeText: CATEGORIA_SIN_TIPO.badgeText,
      borderCol: CATEGORIA_SIN_TIPO.borderCol, priceColor: CATEGORIA_SIN_TIPO.priceColor,
    }] : []),
  ];

  // "En salón" es un subgrupo transversal (cruza categorías) — vive como pill aparte,
  // solo visible en la raíz del árbol (no dentro de una Familia ya elegida).
  const existeEnSalon = productos.some(p => p.en_salon);

  // Nodo activo (última migaja del breadcrumb) → productos = él mismo + todos sus
  // descendientes (así una Familia sin sub-niveles cargados sigue mostrando productos).
  const categoriaActiva = nodoActivoId ? {
    key: nodoActivoId,
    titulo: nodoActivoId === EN_SALON_KEY ? 'En salón' : (nodeById[nodoActivoId]?.nombre ?? ''),
    items: nodoActivoId === EN_SALON_KEY
      ? filtered.filter(p => p.en_salon)
      : filtered.filter(p => p.categoria_id && descendientesDe[nodoActivoId]?.has(p.categoria_id)),
    priceColor: paletaDeNodo(nodoActivoId).priceColor,
  } : null;

  // Facetas dinámicas — solo dentro de una categoría real (no en "Todos", búsqueda o "En salón",
  // que mezclan material y por lo tanto schemas de atributos distintos)
  const facetsCategoria = categoriaActiva && categoriaActiva.key !== EN_SALON_KEY
    ? buildFacets(categoriaActiva.items) : [];
  const itemsCategoriaFacetados = categoriaActiva
    ? categoriaActiva.items.filter(p => productoPasaFacets(p, facetFilters))
    : [];
  const filteredSorted = useMemo(() => sortProductos(filtered, sortBy), [filtered, sortBy]);

  // Productos visibles según el filtro/búsqueda activos — la barra de valor de stock se recalcula sobre esto
  const productosVisibles = categoriaActiva ? itemsCategoriaFacetados : filteredSorted;
  const valorCostoStock = productosVisibles.reduce((s, p) => s + (p.stock_actual ?? 0) * Number(p.costo_base ?? 0), 0);
  const valorVentaStock = productosVisibles.reduce((s, p) => s + (p.stock_actual ?? 0) * Number(p.precio_base ?? 0), 0);
  const unidadesStock   = productosVisibles.reduce((s, p) => s + (p.stock_actual ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5" data-section="productos">
      <SectionHero
        section="productos"
        icon={Layers}
        title="Productos"
        sub={`Catálogo de aberturas y precios base · ${productos.length} productos`}
        actions={
          <Link to="/productos/nuevo"
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all">
            <Plus size={16}/> Nuevo producto
          </Link>
        }
      />

      {/* Buscador + orden */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input
            type="text" placeholder="Buscar por nombre, código o tipo..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white shadow-md"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14}/>
            </button>
          )}
        </div>
        <div className="relative shrink-0">
          <ArrowUpDown size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="appearance-none pl-8 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map(k => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </div>
        {categoriaActiva && facetsCategoria.length > 0 && (
          <button
            onClick={() => setMobileFiltrosOpen(true)}
            className="lg:hidden flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white shadow-md text-gray-600 shrink-0"
          >
            <SlidersHorizontal size={14}/> Filtros
            {activeFacetCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-600 text-white">{activeFacetCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Navegación por árbol de categorías — breadcrumb + nivel actual */}
      {!loading && productos.length > 0 && (
        <div className="space-y-2">
          {categoriaPath.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap text-xs font-semibold text-gray-500">
              <button onClick={() => setCategoriaPath([])} className="hover:text-sky-600 hover:underline">Todos</button>
              {categoriaPath.map((id, i) => (
                <span key={id} className="flex items-center gap-1">
                  <ChevronRight size={12} className="text-gray-300"/>
                  {i === categoriaPath.length - 1 ? (
                    <span className="text-gray-800">{id === EN_SALON_KEY ? 'En salón' : nodeById[id]?.nombre}</span>
                  ) : (
                    <button onClick={() => setCategoriaPath(categoriaPath.slice(0, i + 1))} className="hover:text-sky-600 hover:underline">
                      {nodeById[id]?.nombre}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setCategoriaPath([])}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all',
                categoriaPath.length === 0
                  ? 'bg-gray-800 text-white shadow-md shadow-gray-300'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              <Layers size={16}/> Todos
              <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full', categoriaPath.length === 0 ? 'bg-white/20' : 'bg-gray-100')}>
                {filtered.length}
              </span>
            </button>

            {categoriaPath.length === 0 && columnas.map(col => (
              <button
                key={col.key}
                onClick={() => setCategoriaPath([col.key])}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all', FILTRO_BTN[col.color].inactive)}
              >
                <col.icono size={16}/> {col.titulo}
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white">{col.items.length}</span>
              </button>
            ))}
            {categoriaPath.length === 0 && existeEnSalon && (
              <button
                onClick={() => setCategoriaPath([EN_SALON_KEY])}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ml-1.5 border-l-2 border-gray-200 pl-3.5', FILTRO_BTN.emerald.inactive)}
              >
                <Store size={16}/> En salón
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white">{filtered.filter(p => p.en_salon).length}</span>
              </button>
            )}

            {nodoActivoId && nodoActivoId !== EN_SALON_KEY && (hijosDe[nodoActivoId] ?? []).map(hijo => {
              const count = filtered.filter(p => p.categoria_id && descendientesDe[hijo.id]?.has(p.categoria_id)).length;
              return (
                <button
                  key={hijo.id}
                  onClick={() => setCategoriaPath([...categoriaPath, hijo.id])}
                  className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all', FILTRO_BTN[paletaDeNodo(nodoActivoId).color ?? 'sky'].inactive)}
                >
                  {hijo.nombre}
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Valor de stock — se recalcula según el filtro/búsqueda activos */}
      {!loading && productos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-500">
              <Package size={13}/>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Unidades en stock</p>
              <p className="text-sm font-black text-gray-800 tabular-nums">{unidadesStock}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 text-amber-600">
              <Tag size={13}/>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Valor de costo</p>
              <p className="text-sm font-black text-amber-700 tabular-nums">{formatCurrency(valorCostoStock)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
              <DollarSign size={13}/>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Valor de venta</p>
              <p className="text-sm font-black text-emerald-700 tabular-nums">{formatCurrency(valorVentaStock)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="flex gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-12 bg-gray-100"/>
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex gap-3 p-3 border-t border-gray-50">
                  <div className="w-[108px] h-[108px] bg-gray-100 rounded"/>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-100 rounded w-3/4"/>
                    <div className="h-2 bg-gray-100 rounded w-1/2"/>
                    <div className="h-4 bg-gray-100 rounded w-1/3"/>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Package size={36} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-sm text-gray-400 mb-1">No hay productos en el catálogo</p>
          <Link to="/productos/nuevo" className="text-sm text-sky-600 hover:underline font-medium">Agregar el primero →</Link>
        </div>
      ) : categoriaActiva ? (
        /* Filtro por tipo activo: sidebar de facetas + mosaico de esa categoría */
        <div className="flex gap-4 items-start">
          {facetsCategoria.length > 0 && (
            <aside className="hidden lg:block w-52 shrink-0 sticky top-4 space-y-4">
              <FacetsPanel facets={facetsCategoria} activos={facetFilters} onToggle={toggleFacetValue}
                onLimpiar={() => setFacetFilters({})} activeCount={activeFacetCount}/>
            </aside>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm text-gray-500">
              {itemsCategoriaFacetados.length} producto{itemsCategoriaFacetados.length !== 1 ? 's' : ''} en {categoriaActiva.titulo}
            </p>
            {itemsCategoriaFacetados.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={36} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-400">
                  {categoriaActiva.items.length === 0
                    ? `Sin productos en esta categoría${search ? ' para tu búsqueda' : ''}`
                    : 'Ningún producto coincide con los filtros elegidos'}
                </p>
                {activeFacetCount > 0 && (
                  <button onClick={() => setFacetFilters({})} className="text-sm text-sky-600 hover:underline font-medium mt-2">Limpiar filtros</button>
                )}
              </div>
            ) : (
              <GridMosaico productos={itemsCategoriaFacetados} priceColor={categoriaActiva.priceColor} onSelect={setSelected} onToggle={toggleActivo} onToggleSalon={toggleSalonRapido}/>
            )}
          </div>
        </div>
      ) : search ? (
        /* Búsqueda: mosaico plano */
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{filteredSorted.length} resultado{filteredSorted.length !== 1 ? 's' : ''} para "{search}"</p>
          <GridMosaico productos={filteredSorted} priceColor="text-sky-700" onSelect={setSelected} onToggle={toggleActivo} onToggleSalon={toggleSalonRapido}/>
        </div>
      ) : (
        /* Vista normal: secciones apiladas por categoría, cada una en mosaico */
        <div className="space-y-5">
          {columnas.map(col => (
            <Columna
              key={col.titulo}
              titulo={col.titulo}
              productos={col.items}
              icono={col.icono}
              headerBg={col.headerBg}
              headerText={col.headerText}
              badgeBg={col.badgeBg}
              badgeText={col.badgeText}
              borderCol={col.borderCol}
              priceColor={col.priceColor}
              onSelect={setSelected}
              onToggle={toggleActivo}
              onToggleSalon={toggleSalonRapido}
            />
          ))}
        </div>
      )}

      {/* Footer de marketing */}
      {!loading && !search && !categoriaActiva && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {MARKETING.map(({ Icon, title, desc, bg, icon }) => (
            <div key={title} className={cn('rounded-2xl p-4 flex items-start gap-3', bg)}>
              <div className={cn('mt-0.5 shrink-0', icon)}><Icon size={20}/></div>
              <div>
                <p className="text-xs font-bold text-gray-800">{title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {mobileFiltrosOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltrosOpen(false)}/>
          <div className="relative ml-auto w-[85%] max-w-xs h-full bg-gray-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">Filtros</p>
              <button onClick={() => setMobileFiltrosOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"><X size={16}/></button>
            </div>
            <FacetsPanel facets={facetsCategoria} activos={facetFilters} onToggle={toggleFacetValue}
              onLimpiar={() => setFacetFilters({})} activeCount={activeFacetCount}/>
            <button
              onClick={() => setMobileFiltrosOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold"
            >
              Ver {itemsCategoriaFacetados.length} producto{itemsCategoriaFacetados.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {selected && (
        <ProductoModal
          producto={selected}
          onClose={() => setSelected(null)}
          onToggle={() => toggleActivo(selected)}
          onToggleSalon={() => toggleSalonRapido(selected)}
          onDelete={eliminarProducto}
        />
      )}
      {showAjusteStock && ajusteProductoId && (
        <ModalAjusteStock
          productos={[(() => {
            const p = productos.find(x => x.id === ajusteProductoId) ?? selected;
            return { id: ajusteProductoId, nombre: p?.nombre ?? 'Producto', codigo: p?.codigo ?? null, stock_actual: p?.stock_actual ?? 0 };
          })()]}
          productoPreseleccionado={ajusteProductoId}
          bloquearProducto
          valorInicial={salonPendientePostAjuste ? '1' : undefined}
          onClose={() => { setShowAjusteStock(false); setSalonPendientePostAjuste(null); }}
          onSaved={handleAjusteGuardado}
        />
      )}
    </div>
  );
}
