// Árbol de categorías del catálogo (`catalogo_categorias`) + su paleta de colores.
// Extraído de Productos.tsx para que el modal de catálogo del presupuesto navegue
// exactamente el mismo árbol, con los mismos colores por familia.

export interface Categoria { id: string; nombre: string; parent_id: string | null; orden: number; activo: boolean; }

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

// Botones de filtro — clases completas por color (Tailwind necesita las clases literales)
export const FILTRO_BTN: Record<string, { active: string; inactive: string }> = {
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

export const SIN_TIPO_KEY = '__sin_tipo__';
export const EN_SALON_KEY = '__en_salon__';

export type HijosDe = Record<string, Categoria[]>;
export type NodeById = Record<string, Categoria>;

export function buildHijosDe(categorias: Categoria[]): HijosDe {
  const m: HijosDe = {};
  categorias.forEach(c => { const k = c.parent_id ?? '__root__'; (m[k] ??= []).push(c); });
  Object.values(m).forEach(arr => arr.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)));
  return m;
}

export function buildNodeById(categorias: Categoria[]): NodeById {
  return Object.fromEntries(categorias.map(c => [c.id, c]));
}

/**
 * Set de descendientes por nodo (incluyéndose). Navegar por categoría = filtrar por
 * el nodo elegido O cualquiera de sus descendientes, así un producto asignado a una
 * Familia sin sub-niveles cargados todavía sigue visible.
 */
export function buildDescendientes(categorias: Categoria[], hijosDe: HijosDe): Record<string, Set<string>> {
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
}

export function rootIdDe(nodeById: NodeById, id: string | null): string | null {
  if (!id) return null;
  let cur = nodeById[id];
  if (!cur) return null;
  while (cur.parent_id && nodeById[cur.parent_id]) cur = nodeById[cur.parent_id];
  return cur.id;
}

export function paletaDeNodo(nodeById: NodeById, raices: Categoria[], id: string): PaletaCategoria {
  if (id === EN_SALON_KEY) return { ...CATEGORIA_SIN_TIPO, color: 'emerald', priceColor: 'text-emerald-700' };
  const rid = rootIdDe(nodeById, id) ?? id;
  const idx = raices.findIndex(r => r.id === rid);
  return idx >= 0 ? PALETA_CATEGORIAS[idx % PALETA_CATEGORIAS.length] : CATEGORIA_SIN_TIPO;
}
