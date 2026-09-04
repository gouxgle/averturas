// Paleta de colores por familia (tipo_abertura), usada al agrupar el catálogo en la
// vista "Todos" de ExploradorCatalogo.tsx.
//
// Hasta el rediseño de búsqueda en cascada (Material → Familia → Tipología → Medida,
// ver catalogoCascada.ts), este archivo también traía el árbol de categorías
// (`categorias`, jerárquico vía parent_id) que navegaba ExploradorCatalogo por
// breadcrumb. Se sacó de acá porque nunca tuvo sub-niveles cargados (quedaba como un
// espejo plano de `tipos_abertura`, ver 20260725000001_categorias_jerarquicas.sql) y
// la cascada ya cubre esa navegación con datos que sí existen hoy en cada producto.
// La tabla `categorias` y `categoria_id` siguen vivos para el picker jerárquico propio
// del formulario de producto (`NuevoProducto.tsx`, tipo `Categoria` en `@/types`) —
// es un uso distinto, no se tocó.

export interface PaletaCategoria {
  color: string; headerBg: string; headerText: string;
  badgeText: string; borderCol: string; priceColor: string;
}

// Cada familia (raíz del árbol) toma un color en orden, ciclando si hay más
// familias que colores. "Sin categoría" siempre queda gris al final.
export const PALETA_CATEGORIAS: PaletaCategoria[] = [
  { color: 'sky',     headerBg: 'bg-sky-50',     headerText: 'text-sky-700',     badgeText: 'text-sky-600 border-sky-200',     borderCol: 'border-sky-100',     priceColor: 'text-sky-700' },
  { color: 'violet',  headerBg: 'bg-violet-50',  headerText: 'text-violet-700',  badgeText: 'text-violet-600 border-violet-200',  borderCol: 'border-violet-100',  priceColor: 'text-violet-700' },
  { color: 'teal',    headerBg: 'bg-teal-50',    headerText: 'text-teal-700',    badgeText: 'text-teal-600 border-teal-200',    borderCol: 'border-teal-100',    priceColor: 'text-teal-700' },
  { color: 'orange',  headerBg: 'bg-orange-50',  headerText: 'text-orange-700',  badgeText: 'text-orange-600 border-orange-200',  borderCol: 'border-orange-100',  priceColor: 'text-orange-700' },
  { color: 'rose',    headerBg: 'bg-rose-50',    headerText: 'text-rose-700',    badgeText: 'text-rose-600 border-rose-200',    borderCol: 'border-rose-100',    priceColor: 'text-rose-700' },
  { color: 'indigo',  headerBg: 'bg-indigo-50',  headerText: 'text-indigo-700',  badgeText: 'text-indigo-600 border-indigo-200',  borderCol: 'border-indigo-100',  priceColor: 'text-indigo-700' },
  { color: 'amber',   headerBg: 'bg-amber-50',   headerText: 'text-amber-700',   badgeText: 'text-amber-600 border-amber-200',   borderCol: 'border-amber-100',   priceColor: 'text-amber-700' },
  { color: 'fuchsia', headerBg: 'bg-fuchsia-50', headerText: 'text-fuchsia-700', badgeText: 'text-fuchsia-600 border-fuchsia-200', borderCol: 'border-fuchsia-100', priceColor: 'text-fuchsia-700' },
];
export const CATEGORIA_SIN_TIPO: PaletaCategoria = {
  color: 'gray', headerBg: 'bg-gray-50', headerText: 'text-gray-600', badgeText: 'text-gray-600 border-gray-200',
  borderCol: 'border-gray-200', priceColor: 'text-gray-700',
};

export const SIN_TIPO_KEY = '__sin_tipo__';
