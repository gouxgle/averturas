import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ToggleLeft, ToggleRight, AlertTriangle, Tag, Store, Play,
  Percent, ShoppingCart, Star, ThumbsUp, Sparkles, Loader2,
} from 'lucide-react';
import { formatCurrency, cn, disponibilidadVigente } from '@/lib/utils';
import type { Producto, TipoOperacion } from '@/types';

// ── Mapas de labels / colores — compartidos entre Productos y Venta rápida ──

export const TIPO_LABEL: Record<TipoOperacion, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación',
};
export const TIPO_COLOR: Record<TipoOperacion, string> = {
  estandar:           'bg-sky-50 text-sky-700 border-sky-200',
  a_medida_proveedor: 'bg-violet-50 text-violet-700 border-violet-200',
  fabricacion_propia: 'bg-orange-50 text-orange-700 border-orange-200',
};
export const MARGEN_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
export const MARGEN_COLOR: Record<string, string> = {
  bajo:  'bg-sky-50 text-sky-700 border-sky-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  alto:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};
export const ETIQUETA_CONFIG = {
  mas_vendido: { label: 'Más vendido', cls: 'bg-amber-500 text-white',   Icon: Star      },
  recomendado: { label: 'Recomendado', cls: 'bg-orange-500 text-white',  Icon: ThumbsUp  },
  nuevo:       { label: 'Nuevo',       cls: 'bg-emerald-500 text-white', Icon: Sparkles  },
} as const;
const NIVEL_COMERCIAL_LABEL: Record<string, string> = {
  economica: 'Económica', estandar: 'Estándar', premium: 'Premium', alta_seguridad: 'Alta seguridad',
};
const NIVEL_COMERCIAL_COLOR: Record<string, string> = {
  economica: 'bg-slate-50 text-slate-600 border-slate-200',
  estandar: 'bg-sky-50 text-sky-700 border-sky-200',
  premium: 'bg-violet-50 text-violet-700 border-violet-200',
  alta_seguridad: 'bg-red-50 text-red-700 border-red-200',
};

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

export function isPromoActiva(p: Producto): boolean {
  if (!p.promocion?.activo) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  if (p.promocion.fecha_inicio && hoy < p.promocion.fecha_inicio) return false;
  if (p.promocion.auto_renovar) return true;
  if (p.promocion.fecha_fin && hoy > p.promocion.fecha_fin) return false;
  return true;
}

// Antigüedad del precio: verde <=7 días, amarillo 8-10, rojo >10 — para detectar
// a simple vista precios que no se están actualizando (manual o por lista de proveedor).
function colorPorAntiguedadPrecio(fechaIso: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
  if (dias <= 7) return 'text-emerald-600';
  if (dias <= 10) return 'text-amber-600';
  return 'text-red-600';
}

// ── Tarjeta mosaico — el mismo recuadro se usa en Catálogo (Productos.tsx) y en
// Venta rápida de mostrador, para que un producto se vea igual en los dos lugares.
export function TarjetaProductoMosaico({
  producto, priceColor, onSelect, onToggle, onToggleSalon, mostrarVenderAhora = true, cantidadEnCarrito = 0,
}: {
  producto: Producto;
  priceColor: string;
  onSelect: (p: Producto) => void;
  onToggle?: (p: Producto) => void;
  onToggleSalon?: (p: Producto) => void | Promise<void>;
  mostrarVenderAhora?: boolean;
  cantidadEnCarrito?: number;
}) {
  const imagenes = useMemo(
    () => producto.imagenes?.length ? producto.imagenes : producto.imagen_url ? [producto.imagen_url] : [],
    [producto],
  );
  const [togglingSalon, setTogglingSalon] = useState(false);
  const [confirmandoSalon, setConfirmandoSalon] = useState(false);
  const promoOk     = isPromoActiva(producto);
  const precioFinal = promoOk && producto.promocion?.precio_oferta ? producto.promocion.precio_oferta : producto.precio_base;
  const precioOrig  = promoOk && producto.promocion?.precio_oferta ? producto.precio_base : null;
  const descPct     = precioOrig ? Math.round((1 - precioFinal / precioOrig) * 100) : 0;
  const subtitle    = buildSubtitle(producto);
  const precioColorEdad = producto.precio_actualizado_at ? colorPorAntiguedadPrecio(producto.precio_actualizado_at) : priceColor;
  const etiquetaCfg = producto.etiqueta ? ETIQUETA_CONFIG[producto.etiqueta] : null;
  const navigate    = useNavigate();

  // Un solo click en la grilla es fácil de errar (tarjetas chicas, una al lado de la
  // otra) — se pide confirmar en un mini modal antes de aplicar el cambio.
  function handleAbrirConfirmacion(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onToggleSalon || togglingSalon) return;
    setConfirmandoSalon(true);
  }

  async function handleConfirmarSalon() {
    if (!onToggleSalon) return;
    setTogglingSalon(true);
    try {
      await onToggleSalon(producto);
    } finally {
      setTogglingSalon(false);
      setConfirmandoSalon(false);
    }
  }

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
          {(producto.stock_actual ?? 0) <= 0 && !disponibilidadVigente(producto.disponibilidad_confirmada_at) && (
            <span title="Sin stock — confirmá plazo con el proveedor antes de comprometer fecha de entrega"
              className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white leading-none shadow-md flex items-center gap-1">
              <AlertTriangle size={8}/>Sin confirmar
            </span>
          )}
          {promoOk && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pink-600 text-white leading-none shadow-md flex items-center gap-1">
              <Tag size={8}/>-{descPct}%
            </span>
          )}
          {onToggleSalon ? (
            <button type="button" onClick={handleAbrirConfirmacion} disabled={togglingSalon}
              title={producto.en_salon ? 'Quitar de exhibición en salón' : 'Marcar exhibido en salón'}
              className={cn(
                'text-[9px] font-bold px-2 py-0.5 rounded-full leading-none shadow-md flex items-center gap-1 transition-colors disabled:opacity-60',
                producto.en_salon ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white/90 text-gray-500 hover:bg-white'
              )}>
              <Store size={8}/>{producto.en_salon ? 'En salón' : 'Marcar en salón'}
            </button>
          ) : producto.en_salon && (
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

        {/* Stock actual — referencia visual */}
        <span className={cn(
          'absolute bottom-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md leading-none',
          (producto.stock_actual ?? 0) > 0 ? 'bg-white/90 text-gray-600' : 'bg-red-100 text-red-600'
        )}>
          stock {producto.stock_actual ?? 0}
        </span>

        {/* Ya está en el carrito (Venta rápida) */}
        {cantidadEnCarrito > 0 && (
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold shadow-md">
            {cantidadEnCarrito}
          </span>
        )}

        {/* Toggle activo — al hover (gestión de catálogo) */}
        {onToggle && (
          <button onClick={e => { e.stopPropagation(); onToggle(producto); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title={producto.activo ? 'Desactivar' : 'Activar'}>
            {producto.activo
              ? <ToggleRight size={16} className="text-emerald-500"/>
              : <ToggleLeft  size={16} className="text-gray-300"/>}
          </button>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 flex flex-col p-3">
        <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2">{producto.nombre}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-1">{subtitle}</p>}

        <div className="mt-auto pt-2">
          {precioOrig ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={cn('text-[15px] font-black leading-none', precioColorEdad)}>{formatCurrency(precioFinal)}</span>
              <span className="text-[10px] text-gray-400 line-through leading-none">{formatCurrency(precioOrig)}</span>
            </div>
          ) : (
            <span className={cn('text-[15px] font-black leading-none', precioColorEdad)}
              title={producto.precio_actualizado_at ? `Precio actualizado: ${new Date(producto.precio_actualizado_at).toLocaleDateString('es-AR')}` : undefined}>
              {formatCurrency(precioFinal)}
            </span>
          )}
          {producto.precio_por_m2 && <span className="text-[10px] text-gray-400 ml-0.5">/m²</span>}
          {producto.costo_base > 0 && (
            <p className="text-[10px] text-gray-400 leading-none mt-1">
              Costo: {formatCurrency(Number(producto.costo_base))}
            </p>
          )}

          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>
              {TIPO_LABEL[producto.tipo]}
            </span>
            {producto.nivel_comercial && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', NIVEL_COMERCIAL_COLOR[producto.nivel_comercial])}>
                {NIVEL_COMERCIAL_LABEL[producto.nivel_comercial]}
              </span>
            )}
            {producto.margen_tipo && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 font-medium', MARGEN_COLOR[producto.margen_tipo])}>
                <Percent size={7}/>{MARGEN_LABEL[producto.margen_tipo]}
              </span>
            )}
          </div>

          {mostrarVenderAhora && producto.activo && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/ventas/rapida?producto_id=${producto.id}`); }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
            >
              <ShoppingCart size={12}/> Vender ahora
            </button>
          )}
        </div>
      </div>

      {confirmandoSalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget && !togglingSalon) setConfirmandoSalon(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                producto.en_salon ? 'bg-gray-100' : 'bg-emerald-100'
              )}>
                <Store size={18} className={producto.en_salon ? 'text-gray-500' : 'text-emerald-600'}/>
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                {producto.en_salon ? '¿Quitar de exhibición en salón?' : '¿Marcar en salón?'}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 pl-[52px]">
              {producto.nombre}
              {!producto.en_salon && ' — se va a mostrar como exhibido físicamente en el local.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmandoSalon(false)} disabled={togglingSalon}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmarSalon} disabled={togglingSalon}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2',
                  producto.en_salon ? 'bg-gray-700 hover:bg-gray-800' : 'bg-emerald-600 hover:bg-emerald-700'
                )}>
                {togglingSalon ? <Loader2 size={14} className="animate-spin"/> : <Store size={14}/>}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
