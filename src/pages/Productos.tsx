import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Layers, Package,
  X, Tag, CalendarDays, RefreshCw, Play,
  Trash2, AlertTriangle, Store, DollarSign,
  Shield, Truck, Headphones, Award, Factory,
} from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import {
  TIPO_LABEL, TIPO_COLOR, MARGEN_LABEL, MARGEN_COLOR, ETIQUETA_CONFIG,
} from '@/components/TarjetaProductoMosaico';
import { BandaProveedor } from '@/components/BadgeProveedor';
import { LineaDisponibilidad } from '@/components/BadgeDisponibilidad';
import { colorProveedor } from '@/lib/coloresProveedor';
import { buildSubtitle, isPromoActiva } from '@/lib/catalogoFiltros';
import type { Categoria } from '@/lib/catalogoCategorias';
import { ExploradorCatalogo } from '@/components/catalogo/ExploradorCatalogo';
import { ModalAjusteStock } from '@/components/ModalAjusteStock';
import { ModalRenovarValidezPrecios } from '@/components/productos/ModalRenovarValidezPrecios';
import type { Producto, TipoOperacion } from '@/types';

function lastDayOfMonth(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}
// ── Modal de detalle ──────────────────────────────────────────────────────────

export function ProductoModal({ producto, onClose, onToggle, onToggleSalon, onDelete, onAgregar, zClass = 'z-50' }: {
  producto: Producto; onClose: () => void; onToggle?: () => void; onToggleSalon?: () => Promise<void>;
  onDelete?: (id: string) => void; onAgregar?: () => void;
  /** Sube por encima de un modal contenedor (ver ModalCatalogoProductos). */
  zClass?: string;
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
  const colorProv = colorProveedor(producto.proveedor);
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
      toastApiError(e, { fallback: 'No se pudo eliminar' });
      setConfirmando(false);
    } finally { setEliminando(false); }
  }

  if (confirmando) return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm', zClass)}>
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
          <p className="text-xs text-gray-600 text-center">Se eliminará permanentemente. Los presupuestos existentes no se verán afectados.</p>
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
    <div className={cn('fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm', zClass)}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
        {/* Franja del proveedor pegada arriba, igual que en la tarjeta del catálogo:
            el dato se ve apenas se abre el modal, sin buscarlo. */}
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl overflow-hidden">
          <BandaProveedor proveedor={producto.proveedor} plazoDias={producto.proveedor?.plazo_entrega_dias ?? null} className="px-5 py-1.5" />
          <div className="border-b border-gray-200 px-5 py-4 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>{TIPO_LABEL[producto.tipo]}</span>
              {producto.etiqueta && ETIQUETA_CONFIG[producto.etiqueta] && (() => {
                const cfg = ETIQUETA_CONFIG[producto.etiqueta!];
                return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', cfg.cls)}><cfg.Icon size={9}/>{cfg.label}</span>;
              })()}
              {producto.codigo && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">{producto.codigo}</span>}
              {onToggleSalon ? (
                <button type="button" onClick={handleToggleSalon} disabled={togglingSalon}
                  title={producto.en_salon ? 'Quitar de exhibición en salón' : 'Marcar exhibido en salón'}
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors disabled:opacity-60',
                    producto.en_salon
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}>
                  <Store size={9}/>{togglingSalon ? 'Guardando...' : producto.en_salon ? 'En salón' : 'Marcar en salón'}
                </button>
              ) : producto.en_salon && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-100 text-emerald-700">
                  <Store size={9}/>En salón
                </span>
              )}
              {!producto.activo && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">Inactivo</span>}
            </div>
            <h2 className="text-base font-bold text-gray-900">{producto.nombre}</h2>
            {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"><X size={16}/></button>
          </div>
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
                      className={cn('w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all', i === activeImg ? 'border-sky-500' : 'border-transparent hover:border-gray-400')}>
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
          {producto.proveedor?.nombre && colorProv && (
            <div className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5', colorProv.badge)}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                style={{ backgroundColor: colorProv.hex }}>
                <Factory size={16}/>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none">Proveedor</p>
                <p className="text-sm font-bold truncate leading-tight mt-0.5">{producto.proveedor.nombre}</p>
              </div>
            </div>
          )}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <LineaDisponibilidad producto={producto} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Precio de venta</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(precio)}{producto.precio_por_m2 && <span className="text-xs font-normal text-gray-600">/m²</span>}</span>
            </div>
            {dolarCompra && precio > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Valor U$S</span>
                <span className="text-sm font-semibold text-sky-700">
                  U$S {(precio / dolarCompra).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Costo</span>
              <span className="text-sm text-gray-600">{formatCurrency(costo)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Margen</span>
              <span className={cn('text-sm font-semibold', margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>{margen}%</span>
            </div>
            {producto.margen_tipo && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Segmento</span>
                <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', MARGEN_COLOR[producto.margen_tipo])}>{MARGEN_LABEL[producto.margen_tipo]}</span>
              </div>
            )}
          </div>
          {producto.promocion && (
            <div className={cn('rounded-xl p-3 border', isPromoActiva(producto) ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-200 opacity-60')}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <Tag size={13} className={isPromoActiva(producto) ? 'text-pink-500' : 'text-gray-600'}/>
                <span className="text-xs font-semibold text-gray-700">Promoción {isPromoActiva(producto) ? '· activa' : '· inactiva'}</span>
                {producto.promocion.auto_renovar && <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-700 font-medium"><RefreshCw size={9}/>Auto-renovar mensual</span>}
              </div>
              {producto.promocion.precio_oferta && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-pink-700">{formatCurrency(producto.promocion.precio_oferta)}</span>
                  <span className="text-xs text-gray-600 line-through">{formatCurrency(precio)}</span>
                  <span className="text-xs text-pink-600 font-medium">-{Math.round((1 - producto.promocion.precio_oferta / precio) * 100)}%</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-gray-600 mt-1 flex-wrap">
                <CalendarDays size={10}/>
                {producto.promocion.fecha_inicio && <span>desde {producto.promocion.fecha_inicio}</span>}
                {producto.promocion.auto_renovar ? <span>hasta el {lastDayOfMonth()} (renovación mensual)</span> : producto.promocion.fecha_fin && <span>hasta {producto.promocion.fecha_fin}</span>}
              </div>
            </div>
          )}
          {((producto.tipo_abertura as any)?.nombre || (producto.sistema as any)?.nombre || producto.color || attrs.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Especificaciones</p>
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
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Características</p>
              <ul className="space-y-1">
                {[producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4].filter(Boolean).map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600"><span className="mt-0.5 text-sky-400">·</span>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {(producto.vidrio || producto.premarco || producto.accesorios?.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Incluye</p>
              <div className="flex flex-wrap gap-1.5">
                {producto.vidrio && <Tag2 label={`Vidrio: ${producto.vidrio}`}/>}
                {producto.premarco && <Tag2 label="Premarco"/>}
                {(producto.accesorios ?? []).map(a => <Tag2 key={a} label={a.replace(/_/g,' ')}/>)}
              </div>
            </div>
          )}
          {producto.descripcion && <p className="text-xs text-gray-600 border-t border-gray-200 pt-3">{producto.descripcion}</p>}
        </div>

        {onAgregar ? (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-2xl px-5 py-3 flex items-center justify-end gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cerrar</button>
            <button onClick={() => { onAgregar(); onClose(); }}
              className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Plus size={13}/>Agregar a la proforma
            </button>
          </div>
        ) : (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-2xl px-5 py-3 flex items-center justify-between gap-2">
            <button onClick={onToggle}
              className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                producto.activo ? 'border-gray-200 text-gray-600 hover:border-orange-200 hover:text-orange-500' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
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
  return <div><span className="text-[10px] text-gray-600 capitalize">{k}</span><p className="text-xs font-medium text-gray-700 capitalize">{v}</p></div>;
}
function Tag2({ label }: { label: string }) {
  return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{label}</span>;
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
  const [selected, setSelected]   = useState<Producto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showAjusteStock, setShowAjusteStock] = useState(false);
  const [ajusteProductoId, setAjusteProductoId] = useState<string | null>(null);
  const [showRenovarValidez, setShowRenovarValidez] = useState(false);
  // Si se abrió el ajuste porque se intentó marcar "en salón" sin stock, al guardar
  // el ajuste activamos "en salón" directo — no hace falta un segundo click.
  const [salonPendientePostAjuste, setSalonPendientePostAjuste] = useState<string | null>(null);

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
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo actualizar' });
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

  // Barra de valor de stock — se recalcula sobre los productos que el explorador
  // está mostrando (filtro/búsqueda/facetas activos), no sobre el catálogo entero.
  function BarraValorStock(visibles: Producto[]) {
    if (loading || productos.length === 0) return null;
    const unidades   = visibles.reduce((s, p) => s + (p.stock_actual ?? 0), 0);
    const valorCosto = visibles.reduce((s, p) => s + (p.stock_actual ?? 0) * Number(p.costo_base ?? 0), 0);
    const valorVenta = visibles.reduce((s, p) => s + (p.stock_actual ?? 0) * Number(p.precio_base ?? 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
            <Package size={13}/>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Unidades en stock</p>
            <p className="text-sm font-black text-gray-800 tabular-nums">{unidades}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 text-amber-600">
            <Tag size={13}/>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Valor de costo</p>
            <p className="text-sm font-black text-amber-700 tabular-nums">{formatCurrency(valorCosto)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
            <DollarSign size={13}/>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Valor de venta</p>
            <p className="text-sm font-black text-emerald-700 tabular-nums">{formatCurrency(valorVenta)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1440px] mx-auto space-y-5" data-section="productos">
      <SectionHero
        section="productos"
        icon={Layers}
        title="Productos"
        sub={`Catálogo de aberturas y precios base · ${productos.length} productos`}
        actions={
          <>
            <button onClick={() => setShowRenovarValidez(true)}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-400 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all">
              <RefreshCw size={16}/> Renovar validez de precios
            </button>
            <Link to="/productos/nuevo"
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all">
              <Plus size={16}/> Nuevo producto
            </Link>
          </>
        }
      />

      {showRenovarValidez && (
        <ModalRenovarValidezPrecios
          productos={productos}
          onClose={() => setShowRenovarValidez(false)}
          onRenovado={load}
        />
      )}

      <ExploradorCatalogo
        productos={productos}
        categorias={categorias}
        loading={loading}
        onSelect={setSelected}
        onToggleActivo={toggleActivo}
        onToggleSalon={toggleSalonRapido}
        renderHeader={BarraValorStock}
        renderFooter={() => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {MARKETING.map(({ Icon, title, desc, bg, icon }) => (
              <div key={title} className={cn('rounded-2xl p-4 flex items-start gap-3', bg)}>
                <div className={cn('mt-0.5 shrink-0', icon)}><Icon size={20}/></div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{title}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        vacio={
          <div className="py-16 text-center">
            <Package size={36} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-sm text-gray-600 mb-1">No hay productos en el catálogo</p>
            <Link to="/productos/nuevo" className="text-sm text-sky-600 hover:underline font-medium">Agregar el primero →</Link>
          </div>
        }
      />

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
