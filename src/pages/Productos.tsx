import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Search, Layers, Package,
  X, AppWindow, DoorOpen, Tag, Percent, CalendarDays, RefreshCw, Play,
  Trash2, AlertTriangle, ChevronLeft, ChevronRight, Star, Sparkles,
  ThumbsUp, MessageCircle, Mail, Copy, Check, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Producto, TipoOperacion } from '@/types';

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

const L_TIPO_VENTANA: Record<string, string> = {
  corrediza: 'Corrediza', con_celosia: 'Con celosía', de_abrir: 'De abrir',
  banderola: 'Banderola', ventiluz: 'Ventiluz', aireador: 'Aireador',
};
const L_HOJAS_VNT: Record<string, string> = {
  '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
};
const L_CONFIG_HOJAS: Record<string, string> = {
  hoja_simple: 'Hoja simple', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', puerta_pano_fijo: 'Puerta + paño fijo',
};
const L_MARCO: Record<string, string> = {
  transitable: 'Transitable', no_transitable: 'No transitable',
};
const L_USO: Record<string, string> = {
  interior: 'Interior', exterior: 'Exterior', ingreso_frente: 'Ingreso/Frente',
};

function buildSubtitle(p: Producto): string {
  const a = p.atributos ?? {};
  const parts: string[] = [];
  if (a.tipo_ventana)  parts.push(L_TIPO_VENTANA[a.tipo_ventana as string] ?? String(a.tipo_ventana));
  if (a.config_hojas)  parts.push(L_CONFIG_HOJAS[a.config_hojas as string] ?? String(a.config_hojas));
  if (a.hojas)         parts.push(L_HOJAS_VNT[a.hojas as string] ?? String(a.hojas));
  if (a.marco_tipo)    parts.push(L_MARCO[a.marco_tipo as string] ?? String(a.marco_tipo));
  if (a.uso)           parts.push(L_USO[a.uso as string] ?? String(a.uso));
  if (p.ancho && p.alto) parts.push(`${p.ancho} × ${p.alto} cm`);
  return parts.join(' · ');
}

function lastDayOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
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

function buildShareText(p: Producto): string {
  const promoOk = isPromoActiva(p);
  const precio  = promoOk && p.promocion?.precio_oferta ? p.promocion.precio_oferta : p.precio_base;
  const sub     = buildSubtitle(p);
  const caracts = [p.caracteristica_1, p.caracteristica_2, p.caracteristica_3, p.caracteristica_4]
    .filter(Boolean) as string[];
  let txt = `*${p.nombre}*`;
  if (sub)          txt += `\n${sub}`;
  if (caracts.length) txt += `\n✓ ${caracts.join('\n✓ ')}`;
  txt += `\n\n💰 *${formatCurrency(precio)}*`;
  if (promoOk && p.promocion?.precio_oferta && p.precio_base !== p.promocion.precio_oferta) {
    const pct = Math.round((1 - p.promocion.precio_oferta / p.precio_base) * 100);
    txt += ` ~~${formatCurrency(p.precio_base)}~~ (-${pct}%)`;
  }
  txt += '\n\n📞 Consultanos por disponibilidad y medidas personalizadas.';
  return txt;
}

// ── Modal de detalle ──────────────────────────────────────────────────────────

function ProductoModal({ producto, onClose, onToggle, onDelete }: {
  producto: Producto;
  onClose: () => void;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const [activeImg, setActiveImg]       = useState(0);
  const [confirmando, setConfirmando]   = useState(false);
  const [eliminando, setEliminando]     = useState(false);
  const costo  = producto.costo_base;
  const precio = producto.precio_base;
  const margen = precio > 0 ? Math.round((precio - costo) / precio * 100) : 0;
  const promoOk = isPromoActiva(producto);
  const subtitle = buildSubtitle(producto);
  const imagenes = producto.imagenes?.length ? producto.imagenes
                   : producto.imagen_url ? [producto.imagen_url] : [];

  const attrs: [string, string][] = Object.entries(producto.atributos ?? {})
    .filter(([, v]) => v !== null && v !== '' && !Array.isArray(v))
    .map(([k, v]) => [k.replace(/_/g, ' '), String(v)]);

  async function handleDelete() {
    setEliminando(true);
    try {
      await api.delete(`/productos/${producto.id}`);
      toast.success(`"${producto.nombre}" eliminado del catálogo`);
      onDelete(producto.id);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo eliminar el producto');
      setConfirmando(false);
    } finally {
      setEliminando(false);
    }
  }

  if (confirmando) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-red-600 px-6 py-5 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <AlertTriangle size={28} className="text-white" />
            </div>
            <p className="text-white font-bold text-lg leading-tight">Eliminar producto</p>
            <p className="text-red-200 text-xs mt-1">Esta acción no se puede deshacer</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-red-500 font-medium mb-1">Producto a eliminar</p>
              <p className="text-sm font-bold text-red-800 break-words">"{producto.nombre}"</p>
              {(producto.tipo_abertura as any)?.nombre && (
                <p className="text-xs text-red-500 mt-0.5">{(producto.tipo_abertura as any).nombre}</p>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center">
              Se eliminará permanentemente del catálogo. Los presupuestos y operaciones existentes no se verán afectados.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmando(false)}
                className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={eliminando}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                {eliminando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Eliminando...</>
                  : <><Trash2 size={14} /> Sí, eliminar</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>
                {TIPO_LABEL[producto.tipo]}
              </span>
              {producto.etiqueta && ETIQUETA_CONFIG[producto.etiqueta] && (() => {
                const cfg = ETIQUETA_CONFIG[producto.etiqueta!];
                return (
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', cfg.cls)}>
                    <cfg.Icon size={9} /> {cfg.label}
                  </span>
                );
              })()}
              {producto.codigo && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{producto.codigo}</span>
              )}
              {!producto.activo && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">Inactivo</span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900">{producto.nombre}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {imagenes.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-video flex items-center justify-center">
                <img src={imagenes[activeImg]} alt={producto.nombre} className="max-w-full max-h-full object-contain" />
              </div>
              {imagenes.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {imagenes.map((url, i) => (
                    <button key={i} type="button" onClick={() => setActiveImg(i)}
                      className={cn('w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                        i === activeImg ? 'border-sky-500' : 'border-transparent hover:border-gray-300')}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {producto.video_url && (
            <a href={producto.video_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors">
              <Play size={13} className="fill-red-500 text-red-500" />
              Ver video del producto
            </a>
          )}

          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Precio de venta</span>
              <span className="text-base font-bold text-gray-900">
                {formatCurrency(precio)}{producto.precio_por_m2 && <span className="text-xs font-normal text-gray-400">/m²</span>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Costo</span>
              <span className="text-sm text-gray-600">{formatCurrency(costo)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Margen</span>
              <span className={cn('text-sm font-semibold', margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>
                {margen}%
              </span>
            </div>
            {producto.margen_tipo && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Segmento</span>
                <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', MARGEN_COLOR[producto.margen_tipo])}>
                  {MARGEN_LABEL[producto.margen_tipo]}
                </span>
              </div>
            )}
          </div>

          {producto.promocion && (
            <div className={cn('rounded-xl p-3 border', promoOk ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-200 opacity-60')}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <Tag size={13} className={promoOk ? 'text-pink-500' : 'text-gray-400'} />
                <span className="text-xs font-semibold text-gray-700">
                  Promoción {promoOk ? '· activa' : '· inactiva'}
                </span>
                {producto.promocion.auto_renovar && (
                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-700 font-medium">
                    <RefreshCw size={9} /> Auto-renovar mensual
                  </span>
                )}
              </div>
              {producto.promocion.precio_oferta && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-pink-700">{formatCurrency(producto.promocion.precio_oferta)}</span>
                  <span className="text-xs text-gray-400 line-through">{formatCurrency(precio)}</span>
                  <span className="text-xs text-pink-600 font-medium">
                    -{Math.round((1 - producto.promocion.precio_oferta / precio) * 100)}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1 flex-wrap">
                <CalendarDays size={10} />
                {producto.promocion.fecha_inicio && <span>desde {producto.promocion.fecha_inicio}</span>}
                {producto.promocion.auto_renovar
                  ? <span>hasta el {lastDayOfMonth()} (renovación mensual)</span>
                  : producto.promocion.fecha_fin && <span>hasta {producto.promocion.fecha_fin}</span>}
              </div>
            </div>
          )}

          {((producto.tipo_abertura as any)?.nombre || (producto.sistema as any)?.nombre || producto.color || attrs.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Especificaciones</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(producto.tipo_abertura as any)?.nombre && <Row k="Tipo" v={(producto.tipo_abertura as any).nombre} />}
                {(producto.sistema as any)?.nombre && <Row k="Sistema" v={(producto.sistema as any).nombre} />}
                {producto.color && <Row k="Color" v={producto.color} />}
                {attrs.slice(0, 8).map(([k, v]) => <Row key={k} k={k} v={v} />)}
              </div>
            </div>
          )}

          {([producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4].filter(Boolean) as string[]).length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Características</p>
              <ul className="space-y-1">
                {[producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4]
                  .filter(Boolean)
                  .map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="mt-0.5 text-sky-400 shrink-0">·</span> {c}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {(producto.vidrio || producto.premarco || producto.accesorios?.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Incluye</p>
              <div className="flex flex-wrap gap-1.5">
                {producto.vidrio && <Tag2 label={`Vidrio: ${producto.vidrio}`} />}
                {producto.premarco && <Tag2 label="Premarco" />}
                {(producto.accesorios ?? []).map(a => <Tag2 key={a} label={a.replace(/_/g, ' ')} />)}
              </div>
            </div>
          )}

          {producto.descripcion && (
            <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">{producto.descripcion}</p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 rounded-b-2xl px-5 py-3 flex items-center justify-between gap-2">
          <button onClick={onToggle}
            className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
              producto.activo
                ? 'border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-500'
                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
            )}>
            {producto.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {producto.activo ? 'Desactivar' : 'Activar'}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfirmando(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12} /> Eliminar
            </button>
            <Link to={`/productos/${producto.id}`} onClick={onClose}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors">
              <Pencil size={12} /> Editar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-[10px] text-gray-400 capitalize">{k}</span>
      <p className="text-xs font-medium text-gray-700 capitalize">{v}</p>
    </div>
  );
}
function Tag2({ label }: { label: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{label}</span>
  );
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────

function ProductCard({ producto, onSelect, onToggle }: {
  producto: Producto;
  onSelect: (p: Producto) => void;
  onToggle: (p: Producto) => void;
}) {
  const [imgIdx, setImgIdx]   = useState(0);
  const [copied, setCopied]   = useState(false);

  const imagenes = useMemo(
    () => producto.imagenes?.length ? producto.imagenes : producto.imagen_url ? [producto.imagen_url] : [],
    [producto],
  );

  const promoOk      = isPromoActiva(producto);
  const precioFinal  = promoOk && producto.promocion?.precio_oferta ? producto.promocion.precio_oferta : producto.precio_base;
  const precioTachado = promoOk && producto.promocion?.precio_oferta ? producto.precio_base : null;
  const descPct      = precioTachado ? Math.round((1 - precioFinal / precioTachado) * 100) : 0;
  const subtitle     = buildSubtitle(producto);
  const caracts      = [producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4]
                        .filter(Boolean) as string[];
  const etiquetaCfg  = producto.etiqueta ? ETIQUETA_CONFIG[producto.etiqueta] : null;

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    setImgIdx(i => (i - 1 + imagenes.length) % imagenes.length);
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setImgIdx(i => (i + 1) % imagenes.length);
  }

  function shareWA(e: React.MouseEvent) {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText(producto))}`, '_blank');
  }
  function shareEmail(e: React.MouseEvent) {
    e.stopPropagation();
    const subj = encodeURIComponent(producto.nombre);
    const body = encodeURIComponent(buildShareText(producto));
    window.open(`mailto:?subject=${subj}&body=${body}`);
  }
  function shareCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(buildShareText(producto)).then(() => {
      setCopied(true);
      toast.success('Texto copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={cn(
      'bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5',
      !producto.activo && 'opacity-55',
    )}>
      {/* Imagen / carrusel */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden cursor-pointer group"
           onClick={() => onSelect(producto)}>
        {imagenes.length > 0 ? (
          <img
            src={imagenes[imgIdx]}
            alt={producto.nombre}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={52} className="text-gray-200" />
          </div>
        )}

        {/* Flechas carrusel */}
        {imagenes.length > 1 && (
          <>
            <button onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
              <ChevronLeft size={14} className="text-gray-600" />
            </button>
            <button onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
              <ChevronRight size={14} className="text-gray-600" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {imagenes.map((_, i) => (
                <button key={i}
                  onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                  className={cn('w-1.5 h-1.5 rounded-full transition-all',
                    i === imgIdx ? 'bg-white w-3' : 'bg-white/60')} />
              ))}
            </div>
          </>
        )}

        {/* Badges overlay (top-left) */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {etiquetaCfg && (
            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm', etiquetaCfg.cls)}>
              <etiquetaCfg.Icon size={9} /> {etiquetaCfg.label}
            </span>
          )}
          {promoOk && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-pink-600 text-white flex items-center gap-1 shadow-sm">
              <Tag size={9} /> OFERTA
            </span>
          )}
        </div>

        {/* Video button (top-right) */}
        {producto.video_url && (
          <a href={producto.video_url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700 transition-colors">
            <Play size={11} className="fill-white ml-0.5" />
          </a>
        )}

        {/* Toggle activo (hover, bottom-right) */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(producto); }}
          className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
          title={producto.activo ? 'Desactivar' : 'Activar'}>
          {producto.activo
            ? <ToggleRight size={14} className="text-emerald-500" />
            : <ToggleLeft  size={14} className="text-gray-400" />}
        </button>
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col flex-1 cursor-pointer" onClick={() => onSelect(producto)}>
        {/* Badges de tipo */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>
            {TIPO_LABEL[producto.tipo]}
          </span>
          {producto.margen_tipo && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-0.5', MARGEN_COLOR[producto.margen_tipo])}>
              <Percent size={8} /> {MARGEN_LABEL[producto.margen_tipo]}
            </span>
          )}
          {!producto.activo && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded border border-gray-200">Inactivo</span>
          )}
        </div>

        {/* Nombre */}
        <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-0.5">{producto.nombre}</h3>
        {subtitle && <p className="text-xs text-gray-500 mb-2">{subtitle}</p>}

        {/* Características */}
        {caracts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {caracts.slice(0, 3).map((c, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full border border-sky-100 flex items-center gap-1">
                <Check size={8} className="text-sky-500 shrink-0" /> {c}
              </span>
            ))}
          </div>
        )}

        {/* Precio — prominente */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          {precioTachado ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-pink-700 leading-none">{formatCurrency(precioFinal)}</span>
              <span className="text-sm text-gray-400 line-through leading-none">{formatCurrency(precioTachado)}</span>
              <span className="text-[10px] font-bold text-white bg-pink-600 px-1.5 py-0.5 rounded">-{descPct}%</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-sky-700 leading-none">{formatCurrency(precioFinal)}</span>
              {producto.precio_por_m2 && <span className="text-xs text-gray-400">/m²</span>}
            </div>
          )}
        </div>
      </div>

      {/* Acciones: compartir */}
      <div className="px-4 pb-4 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={shareWA}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors font-medium">
          <MessageCircle size={11} /> WA
        </button>
        <button onClick={shareEmail}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors font-medium">
          <Mail size={11} /> Email
        </button>
        <button onClick={shareCopy}
          className={cn('flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors font-medium',
            copied ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100')}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button onClick={e => { e.stopPropagation(); onSelect(producto); }}
          className="ml-auto text-[10px] px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 transition-colors">
          Ver detalle →
        </button>
      </div>
    </div>
  );
}

// ── Sección por categoría ─────────────────────────────────────────────────────

const CAT_LIMIT = 6;

function Seccion({ titulo, productos, icono: Icono, colorHeader, colorBg, borderColor, onSelect, onToggle }: {
  titulo: string;
  productos: Producto[];
  icono: React.ElementType;
  colorHeader: string;
  colorBg: string;
  borderColor: string;
  onSelect: (p: Producto) => void;
  onToggle: (p: Producto) => void;
}) {
  const [expandida, setExpandida] = useState(true);
  const visibles = expandida ? productos : productos.slice(0, CAT_LIMIT);

  return (
    <section className="space-y-4">
      {/* Header de categoría */}
      <div className={cn('flex items-center gap-3 px-5 py-3.5 rounded-2xl border', colorBg, borderColor)}>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', colorHeader)}>
          <Icono size={18} className="text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-base">{titulo}</h2>
          <p className="text-xs text-gray-500">{productos.length} producto{productos.length !== 1 ? 's' : ''}</p>
        </div>
        {productos.length > CAT_LIMIT && (
          <button
            onClick={() => setExpandida(v => !v)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 font-medium">
            <Filter size={12} />
            {expandida ? 'Mostrar menos' : `Ver todos (${productos.length})`}
          </button>
        )}
      </div>

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {visibles.map(p => (
          <ProductCard key={p.id} producto={p} onSelect={onSelect} onToggle={onToggle} />
        ))}
      </div>

      {!expandida && productos.length > CAT_LIMIT && (
        <button onClick={() => setExpandida(true)}
          className="text-sm text-sky-600 hover:text-sky-700 font-medium hover:underline">
          Ver todos los {productos.length} productos de {titulo.toLowerCase()} →
        </button>
      )}
    </section>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Producto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Producto[]>('/productos');
    setProductos(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActivo(producto: Producto) {
    const { activo } = await api.patch<{ id: string; activo: boolean }>(`/productos/${producto.id}/toggle`);
    setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, activo } : p));
    if (selected?.id === producto.id) setSelected(prev => prev ? { ...prev, activo } : null);
  }

  function eliminarProducto(id: string) {
    setProductos(prev => prev.filter(p => p.id !== id));
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

  const { ventanas, puertas, balcon, otros } = useMemo(() => {
    const ventanas: Producto[] = [];
    const puertas:  Producto[] = [];
    const balcon:   Producto[] = [];
    const otros:    Producto[] = [];
    filtered.forEach(p => {
      const n = ((p.tipo_abertura as any)?.nombre ?? '').toLowerCase();
      if (n.includes('balc'))         balcon.push(p);
      else if (n.includes('ventana')) ventanas.push(p);
      else if (n.includes('puerta'))  puertas.push(p);
      else                            otros.push(p);
    });
    const byName = (a: Producto, b: Producto) => a.nombre.localeCompare(b.nombre);
    return {
      ventanas: ventanas.sort(byName),
      puertas:  puertas.sort(byName),
      balcon:   balcon.sort(byName),
      otros:    otros.sort(byName),
    };
  }, [filtered]);

  const secciones = [
    {
      titulo: 'Ventanas', items: ventanas, icono: AppWindow,
      colorHeader: 'bg-sky-500', colorBg: 'bg-sky-50', borderColor: 'border-sky-200',
    },
    {
      titulo: 'Puertas', items: puertas, icono: DoorOpen,
      colorHeader: 'bg-violet-500', colorBg: 'bg-violet-50', borderColor: 'border-violet-200',
    },
    {
      titulo: 'Puerta-Balcón', items: balcon, icono: AppWindow,
      colorHeader: 'bg-teal-500', colorBg: 'bg-teal-50', borderColor: 'border-teal-200',
    },
    ...(otros.length ? [{
      titulo: 'Otros', items: otros, icono: Package,
      colorHeader: 'bg-gray-400', colorBg: 'bg-gray-50', borderColor: 'border-gray-200',
    }] : []),
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <Layers size={20} className="text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Productos</h1>
            <p className="text-sm text-gray-500">Catálogo de aberturas y precios base</p>
          </div>
        </div>
        <Link
          to="/productos/nuevo"
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nuevo producto
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, código o tipo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-gray-100" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-6 bg-gray-100 rounded w-1/3 mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Package size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No hay productos en el catálogo</p>
          <Link to="/productos/nuevo" className="text-sm text-sky-600 hover:underline font-medium">
            Agregar el primero →
          </Link>
        </div>
      ) : search ? (
        /* Resultados de búsqueda — grid plano */
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(p => (
              <ProductCard key={p.id} producto={p} onSelect={setSelected} onToggle={toggleActivo} />
            ))}
          </div>
        </div>
      ) : (
        /* Vista por categoría */
        <div className="space-y-10">
          {secciones.filter(s => s.items.length > 0).map(s => (
            <Seccion
              key={s.titulo}
              titulo={s.titulo}
              productos={s.items}
              icono={s.icono}
              colorHeader={s.colorHeader}
              colorBg={s.colorBg}
              borderColor={s.borderColor}
              onSelect={setSelected}
              onToggle={toggleActivo}
            />
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
