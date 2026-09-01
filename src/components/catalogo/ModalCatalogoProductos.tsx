import { X, ShoppingCart } from 'lucide-react';
import { ExploradorCatalogo } from '@/components/catalogo/ExploradorCatalogo';
import type { Categoria } from '@/lib/catalogoCategorias';
import type { Producto } from '@/types';

// Modal de catálogo para armar un presupuesto o pedido: es el MISMO
// ExploradorCatalogo de la sección Productos, con callbacks de selección en vez de
// los de gestión. No tiene lógica propia de búsqueda, orden ni facetas — si acá
// apareciera un filtro, sería una segunda implementación que va a divergir.
//
// Convención de z-index (los modales de la app viven en z-50 y quedarían por debajo):
//   contenedor z-[60] · drawer de filtros z-[70] · modales anidados z-[80]
export function ModalCatalogoProductos({
  productos, categorias, loading, onSelect, onAgregar, cantidadEnCarrito, itemsEnCarrito, onClose,
}: {
  productos: Producto[];
  categorias: Categoria[];
  loading?: boolean;
  onSelect: (p: Producto) => void;
  onAgregar: (p: Producto) => void;
  cantidadEnCarrito: (p: Producto) => number;
  itemsEnCarrito: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#eef4fa] w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-[1200px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">Catálogo de productos</p>
            <p className="text-xs text-gray-600">Buscá, filtrá por categoría o proveedor y agregá al presupuesto</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0 h-11 w-11 flex items-center justify-center">
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <ExploradorCatalogo
            productos={productos}
            categorias={categorias}
            loading={loading}
            onSelect={onSelect}
            onAgregar={onAgregar}
            cantidadEnCarrito={cantidadEnCarrito}
            onSelectVariante={onAgregar}
            mostrarVenderAhora={false}
            facetasTransversalesEnBusqueda
            zDrawer="z-[70]"
            zModales="z-[80]"
          />
        </div>

        <div className="shrink-0 bg-white border-t border-gray-200 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          {/* pl-14 en mobile: el buzón de comentarios es `fixed bottom-4 left-4` y
              flota por encima de todos los modales de la app — acá el modal ocupa
              la pantalla entera, así que hay que dejarle el hueco. */}
          <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 min-w-0 pl-14 sm:pl-0">
            <ShoppingCart size={14} className="shrink-0"/>
            <span className="truncate">{itemsEnCarrito} ítem{itemsEnCarrito !== 1 ? 's' : ''} en el presupuesto</span>
          </p>
          <button onClick={onClose}
            className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shrink-0">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
