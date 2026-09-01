import { useMemo, useState } from 'react';
import { Package, X, Boxes, Store } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { TarjetaProductoMosaico } from '@/components/TarjetaProductoMosaico';
import type { Producto } from '@/types';

// Grilla mosaico del catálogo, con agrupado por modelo. Compartida entre la sección
// Productos y el modal de catálogo del presupuesto.

type ItemGrilla =
  | { tipo: 'modelo'; modeloId: string; nombre: string; variantes: Producto[] }
  | { tipo: 'suelto'; producto: Producto };

export function agruparPorModelo(productos: Producto[]): ItemGrilla[] {
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

export function variantResumen(p: Producto): string {
  const partes: string[] = [];
  if (p.ancho && p.alto) partes.push(`${p.ancho} × ${p.alto} cm`);
  if (p.color) partes.push(p.color);
  return partes.join(' · ') || '—';
}

export function ModeloVariantesModal({ nombre, variantes, priceColor, onClose, onSelect, zClass = 'z-50' }: {
  nombre: string; variantes: Producto[]; priceColor: string;
  onClose: () => void; onSelect: (p: Producto) => void;
  /** Sube por encima del modal que lo contiene (ver convención de z-index en ModalCatalogoProductos). */
  zClass?: string;
}) {
  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm', zClass)}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80dvh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-base font-bold text-gray-900">{nombre}</p>
            <p className="text-xs text-gray-600">{variantes.length} variantes — elegí una</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"><X size={16}/></button>
        </div>
        <div className="divide-y divide-gray-100">
          {variantes.map(v => {
            const img = v.imagenes?.[0] || v.imagen_url;
            return (
              <button key={v.id} onClick={() => onSelect(v)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left">
                <div className="w-11 h-11 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-200">
                  {img ? <img src={img} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-200"/></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{variantResumen(v)}</p>
                  {v.codigo && <p className="font-mono text-[10px] text-gray-600">{v.codigo}</p>}
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

function TarjetaModeloMosaico({ nombre, variantes, priceColor, onSelectVariante, zModales }: {
  nombre: string; variantes: Producto[]; priceColor: string;
  onSelectVariante: (p: Producto) => void; zModales?: string;
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
            <p className="text-[11px] text-gray-600 mt-0.5 leading-snug line-clamp-1">
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
        <ModeloVariantesModal nombre={nombre} variantes={variantes} priceColor={priceColor} zClass={zModales}
          onClose={() => setAbierto(false)}
          onSelect={v => { setAbierto(false); onSelectVariante(v); }}/>
      )}
    </>
  );
}

export function GridMosaico({
  productos, priceColor, onSelect, onToggle, onToggleSalon,
  onAgregar, cantidadEnCarrito, mostrarVenderAhora, onSelectVariante, zModales,
}: {
  productos: Producto[]; priceColor: string;
  onSelect: (p: Producto) => void;
  onToggle?: (p: Producto) => void;
  onToggleSalon?: (p: Producto) => void | Promise<void>;
  /** Modo selección: botón "+" en la tarjeta (agrega al presupuesto/carrito). */
  onAgregar?: (p: Producto) => void;
  cantidadEnCarrito?: (p: Producto) => number;
  mostrarVenderAhora?: boolean;
  /** Qué hacer al elegir una variante de un modelo. Por defecto, lo mismo que onSelect. */
  onSelectVariante?: (p: Producto) => void;
  zModales?: string;
}) {
  const items = useMemo(() => agruparPorModelo(productos), [productos]);
  const elegirVariante = onSelectVariante ?? onSelect;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map(it => it.tipo === 'modelo'
        ? <TarjetaModeloMosaico key={`modelo-${it.modeloId}`} nombre={it.nombre} variantes={it.variantes}
            priceColor={priceColor} onSelectVariante={elegirVariante} zModales={zModales}/>
        : <TarjetaProductoMosaico key={it.producto.id} producto={it.producto} priceColor={priceColor}
            onSelect={onSelect} onToggle={onToggle} onToggleSalon={onToggleSalon}
            onAgregar={onAgregar} mostrarVenderAhora={mostrarVenderAhora}
            cantidadEnCarrito={cantidadEnCarrito?.(it.producto) ?? 0}/>
      )}
    </div>
  );
}
