import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GridMosaico } from '@/components/catalogo/GridMosaico';
import type { Producto } from '@/types';

// Sección apilada por familia de categoría, en la vista "Todos" del catálogo.
const COL_INIT = 6;

export function ColumnaCategoria({
  titulo, productos, icono: Icono, headerBg, headerText, badgeBg, badgeText, borderCol, priceColor,
  onSelect, onToggle, onToggleSalon, onAgregar, cantidadEnCarrito, mostrarVenderAhora, zModales,
}: {
  titulo: string; productos: Producto[]; icono: React.ElementType;
  headerBg: string; headerText: string; badgeBg: string; badgeText: string;
  borderCol: string; priceColor: string;
  onSelect: (p: Producto) => void;
  onToggle?: (p: Producto) => void;
  onToggleSalon?: (p: Producto) => void | Promise<void>;
  onAgregar?: (p: Producto) => void;
  cantidadEnCarrito?: (p: Producto) => number;
  mostrarVenderAhora?: boolean;
  zModales?: string;
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
        <div className="py-10 text-center text-xs text-gray-600">Sin productos en esta categoría</div>
      ) : (
        <>
          <div className="p-4">
            <GridMosaico productos={visibles} priceColor={priceColor} onSelect={onSelect}
              onToggle={onToggle} onToggleSalon={onToggleSalon} onAgregar={onAgregar}
              cantidadEnCarrito={cantidadEnCarrito} mostrarVenderAhora={mostrarVenderAhora} zModales={zModales}/>
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
