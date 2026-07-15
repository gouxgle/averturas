import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Search, Layers, Package,
  X, AppWindow, DoorOpen, Tag, Percent, CalendarDays, RefreshCw, Play,
  Trash2, AlertTriangle, Star, Sparkles, Store,
  ThumbsUp, Shield, Truck, Headphones, Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import type { Producto, TipoOperacion } from '@/types';

// ── Mapas de labels / colores ─────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoOperacion, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación',
};
const TIPO_COLOR: Record<TipoOperacion, string> = {
  estandar:           'bg-sky-50 text-sky-700 border-sky-200',
  a_medida_proveedor: 'bg-violet-50 text-violet-700 border-violet-200',
  fabricacion_propia: 'bg-orange-50 text-orange-700 border-orange-200',
};
const MARGEN_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const MARGEN_COLOR: Record<string, string> = {
  bajo:  'bg-sky-50 text-sky-700 border-sky-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  alto:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const ETIQUETA_CONFIG = {
  mas_vendido: { label: 'Más vendido', cls: 'bg-amber-500 text-white',   Icon: Star      },
  recomendado: { label: 'Recomendado', cls: 'bg-orange-500 text-white',  Icon: ThumbsUp  },
  nuevo:       { label: 'Nuevo',       cls: 'bg-emerald-500 text-white', Icon: Sparkles  },
} as const;

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
function isPromoActiva(p: Producto): boolean {
  if (!p.promocion?.activo) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  if (p.promocion.fecha_inicio && hoy < p.promocion.fecha_inicio) return false;
  if (p.promocion.auto_renovar) return true;
  if (p.promocion.fecha_fin && hoy > p.promocion.fecha_fin) return false;
  return true;
}
// ── Modal de detalle ──────────────────────────────────────────────────────────

export function ProductoModal({ producto, onClose, onToggle, onDelete, onAgregar }: {
  producto: Producto; onClose: () => void; onToggle?: () => void; onDelete?: (id: string) => void; onAgregar?: () => void;
}) {
  const [activeImg, setActiveImg]     = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando]   = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
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
              {producto.en_salon && (
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

// ── Tarjeta mosaico ───────────────────────────────────────────────────────────

function TarjetaProductoMosaico({ producto, priceColor, onSelect, onToggle }: {
  producto: Producto;
  priceColor: string;
  onSelect: (p: Producto) => void;
  onToggle: (p: Producto) => void;
}) {
  const imagenes = useMemo(
    () => producto.imagenes?.length ? producto.imagenes : producto.imagen_url ? [producto.imagen_url] : [],
    [producto],
  );
  const promoOk     = isPromoActiva(producto);
  const precioFinal = promoOk && producto.promocion?.precio_oferta ? producto.promocion.precio_oferta : producto.precio_base;
  const precioOrig  = promoOk && producto.promocion?.precio_oferta ? producto.precio_base : null;
  const descPct     = precioOrig ? Math.round((1 - precioFinal / precioOrig) * 100) : 0;
  const subtitle    = buildSubtitle(producto);
  const etiquetaCfg = producto.etiqueta ? ETIQUETA_CONFIG[producto.etiqueta] : null;

  return (
    <div className={cn(
      'group relative flex flex-col bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer',
      !producto.activo && 'opacity-50'
    )} onClick={() => onSelect(producto)}>

      {/* Imagen */}
      <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
        {imagenes.length > 0 ? (
          <img src={imagenes[0]} alt={producto.nombre} loading="lazy" decoding="async" className="w-full h-full object-contain p-3"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-gray-200"/></div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {etiquetaCfg && (
            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md leading-none', etiquetaCfg.cls)}>
              <etiquetaCfg.Icon size={8}/>{etiquetaCfg.label}
            </span>
          )}
          {promoOk && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pink-600 text-white leading-none shadow-md flex items-center gap-1">
              <Tag size={8}/>-{descPct}%
            </span>
          )}
          {producto.en_salon && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white leading-none shadow-md flex items-center gap-1">
              <Store size={8}/>En salón
            </span>
          )}
        </div>

        {producto.video_url && (
          <a href={producto.video_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700">
            <Play size={9} className="fill-white ml-px"/>
          </a>
        )}

        {/* Toggle activo — al hover */}
        <button onClick={e => { e.stopPropagation(); onToggle(producto); }}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title={producto.activo ? 'Desactivar' : 'Activar'}>
          {producto.activo
            ? <ToggleRight size={16} className="text-emerald-500"/>
            : <ToggleLeft  size={16} className="text-gray-300"/>}
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex flex-col p-3">
        <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2">{producto.nombre}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-1">{subtitle}</p>}

        <div className="mt-auto pt-2">
          {precioOrig ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={cn('text-[15px] font-black leading-none', priceColor)}>{formatCurrency(precioFinal)}</span>
              <span className="text-[10px] text-gray-400 line-through leading-none">{formatCurrency(precioOrig)}</span>
            </div>
          ) : (
            <span className={cn('text-[15px] font-black leading-none', priceColor)}>{formatCurrency(precioFinal)}</span>
          )}
          {producto.precio_por_m2 && <span className="text-[10px] text-gray-400 ml-0.5">/m²</span>}

          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>
              {TIPO_LABEL[producto.tipo]}
            </span>
            {producto.margen_tipo && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 font-medium', MARGEN_COLOR[producto.margen_tipo])}>
                <Percent size={7}/>{MARGEN_LABEL[producto.margen_tipo]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grid mosaico (reutilizado por Columna y por las vistas planas) ─────────────

function GridMosaico({ productos, priceColor, onSelect, onToggle }: {
  productos: Producto[]; priceColor: string;
  onSelect: (p: Producto) => void; onToggle: (p: Producto) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {productos.map(p => (
        <TarjetaProductoMosaico key={p.id} producto={p} priceColor={priceColor} onSelect={onSelect} onToggle={onToggle}/>
      ))}
    </div>
  );
}

// ── Columna por categoría ─────────────────────────────────────────────────────

const COL_INIT = 6;

function Columna({ titulo, productos, icono: Icono, headerBg, headerText, badgeBg, badgeText, borderCol, priceColor, onSelect, onToggle }: {
  titulo: string; productos: Producto[]; icono: React.ElementType;
  headerBg: string; headerText: string; badgeBg: string; badgeText: string;
  borderCol: string; priceColor: string;
  onSelect: (p: Producto) => void; onToggle: (p: Producto) => void;
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
            <GridMosaico productos={visibles} priceColor={priceColor} onSelect={onSelect} onToggle={onToggle}/>
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

// ── Página principal ──────────────────────────────────────────────────────────

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Producto | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);
  const [tiposAbertura, setTiposAbertura] = useState<{ id: string; nombre: string; orden: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Producto[]>('/productos');
    setProductos(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Catálogo real de tipos de abertura — define las categorías del filtro (ya viene ordenado por `orden`)
  useEffect(() => {
    api.get<{ id: string; nombre: string; orden: number }[]>('/catalogo/tipos-abertura')
      .then(rows => {
        setTiposAbertura(rows);
        if (rows[0]?.id) setTipoFiltro(rows[0].id);
      })
      .catch(() => {});
  }, []);

  async function toggleActivo(producto: Producto) {
    const { activo } = await api.patch<{ id: string; activo: boolean }>(`/productos/${producto.id}/toggle`);
    setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, activo } : p));
    if (selected?.id === producto.id) setSelected(prev => prev ? { ...prev, activo } : null);
  }
  function eliminarProducto(id: string) { setProductos(prev => prev.filter(p => p.id !== id)); }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      (p.tipo_abertura as any)?.nombre?.toLowerCase().includes(q)
    );
  }, [productos, search]);

  // Agrupa por tipo_abertura_id real (no por matching de texto) — cualquier tipo nuevo
  // cargado en Configuración aparece con su propia categoría automáticamente.
  function categorizar(lista: Producto[]) {
    const grupos: Record<string, Producto[]> = { [SIN_TIPO_KEY]: [] };
    tiposAbertura.forEach(t => { grupos[t.id] = []; });
    lista.forEach(p => {
      const key = p.tipo_abertura_id && grupos[p.tipo_abertura_id] ? p.tipo_abertura_id : SIN_TIPO_KEY;
      grupos[key].push(p);
    });
    const byName = (a: Producto, b: Producto) => a.nombre.localeCompare(b.nombre);
    Object.values(grupos).forEach(g => g.sort(byName));
    return grupos;
  }

  const gruposFiltrados = useMemo(() => categorizar(filtered), [filtered, tiposAbertura]);
  // Existencia por categoría en TODO el catálogo (para que los botones no aparezcan/desaparezcan al buscar)
  const existeCategoria = useMemo(() => {
    const c = categorizar(productos);
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.length > 0]));
  }, [productos, tiposAbertura]);

  const columnas = [
    ...tiposAbertura.map((t, i) => {
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
      key: SIN_TIPO_KEY, titulo: 'Sin tipo', items: gruposFiltrados[SIN_TIPO_KEY] ?? [], icono: Package, color: CATEGORIA_SIN_TIPO.color,
      headerBg: CATEGORIA_SIN_TIPO.headerBg, headerText: CATEGORIA_SIN_TIPO.headerText, badgeBg: 'bg-white', badgeText: CATEGORIA_SIN_TIPO.badgeText,
      borderCol: CATEGORIA_SIN_TIPO.borderCol, priceColor: CATEGORIA_SIN_TIPO.priceColor,
    }] : []),
  ];

  // "En salón" es un subgrupo transversal (cruza tipos) — es un filtro más, pero no se
  // duplica dentro de la vista "Todos" apilada por tipo (columnas), solo vive como botón.
  const existeEnSalon = productos.some(p => p.en_salon);
  const columnaEnSalon = {
    key: EN_SALON_KEY, titulo: 'En salón', items: filtered.filter(p => p.en_salon), icono: Store, color: 'emerald',
    headerBg: 'bg-emerald-50', headerText: 'text-emerald-700', badgeBg: 'bg-white', badgeText: 'text-emerald-600 border-emerald-200',
    borderCol: 'border-emerald-100', priceColor: 'text-emerald-700',
  };
  const columnasFiltro = [...columnas, ...(existeEnSalon ? [columnaEnSalon] : [])];

  const categoriaActiva = columnasFiltro.find(c => c.key === tipoFiltro) ?? null;

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

      {/* Buscador */}
      <div className="relative">
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

      {/* Filtro por tipo de abertura */}
      {!loading && productos.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setTipoFiltro(null)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all',
              tipoFiltro === null
                ? 'bg-gray-800 text-white shadow-md shadow-gray-300'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            <Layers size={16}/> Todos
            <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full', tipoFiltro === null ? 'bg-white/20' : 'bg-gray-100')}>
              {filtered.length}
            </span>
          </button>
          {columnasFiltro.map(col => (
            <button
              key={col.key}
              onClick={() => setTipoFiltro(prev => prev === col.key ? null : col.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all',
                col.key === EN_SALON_KEY && 'ml-1.5 border-l-2 border-gray-200 pl-3.5',
                FILTRO_BTN[col.color][tipoFiltro === col.key ? 'active' : 'inactive']
              )}
            >
              <col.icono size={16}/> {col.titulo}
              <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full', tipoFiltro === col.key ? 'bg-white/20' : 'bg-white')}>
                {col.items.length}
              </span>
            </button>
          ))}
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
        /* Filtro por tipo activo: lista plana de esa categoría */
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            {categoriaActiva.items.length} producto{categoriaActiva.items.length !== 1 ? 's' : ''} en {categoriaActiva.titulo}
          </p>
          {categoriaActiva.items.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={36} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm text-gray-400">Sin productos en esta categoría{search ? ' para tu búsqueda' : ''}</p>
            </div>
          ) : (
            <GridMosaico productos={categoriaActiva.items} priceColor={categoriaActiva.priceColor} onSelect={setSelected} onToggle={toggleActivo}/>
          )}
        </div>
      ) : search ? (
        /* Búsqueda: mosaico plano */
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"</p>
          <GridMosaico productos={filtered} priceColor="text-sky-700" onSelect={setSelected} onToggle={toggleActivo}/>
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

      {selected && (
        <ProductoModal
          producto={selected}
          onClose={() => setSelected(null)}
          onToggle={() => toggleActivo(selected)}
          onDelete={eliminarProducto}
        />
      )}
    </div>
  );
}
