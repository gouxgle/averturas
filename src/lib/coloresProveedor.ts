// Color identificatorio por proveedor: permite reconocer de un vistazo de qué
// proveedor es cada producto en el catálogo, la galería de venta rápida, stock y
// los buscadores de producto.
//
// Por qué se guarda la CLAVE ('violeta') y no el hex: Tailwind purga en build
// cualquier clase armada dinámicamente (`bg-${x}-100` no sobrevive), así que las
// clases del badge tienen que existir como strings literales en el código. El hex
// del mismo registro se usa donde sí hace falta un color suelto (la franja de la
// tarjeta), aplicado por `style`.

export interface ColorProveedor {
  key: string;
  label: string;
  /** Para franjas/puntos aplicados por `style` (Tailwind no puede purgar esto). */
  hex: string;
  /** Clases del badge — literales, para que sobrevivan al purge de Tailwind. */
  badge: string;
  /**
   * Banda sólida (fondo fuerte + texto blanco) para la franja con el nombre del
   * proveedor arriba de la tarjeta y del modal de detalle. Se usa el tono `-700`
   * en toda la paleta a propósito: con blanco encima es el tono más claro que
   * mantiene contraste legible en los 12 colores (amarillos y limas incluidos),
   * sin perder distinción entre matices.
   */
  solid: string;
}

export const COLORES_PROVEEDOR: readonly ColorProveedor[] = [
  { key: 'violeta',   label: 'Violeta',  hex: '#8b5cf6', badge: 'bg-violet-100 text-violet-700 border-violet-200',    solid: 'bg-violet-700 text-white' },
  { key: 'celeste',   label: 'Celeste',  hex: '#0ea5e9', badge: 'bg-sky-100 text-sky-700 border-sky-200',             solid: 'bg-sky-700 text-white' },
  { key: 'esmeralda', label: 'Esmeralda',hex: '#10b981', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', solid: 'bg-emerald-700 text-white' },
  { key: 'ambar',     label: 'Ámbar',    hex: '#f59e0b', badge: 'bg-amber-100 text-amber-700 border-amber-200',       solid: 'bg-amber-700 text-white' },
  { key: 'rosa',      label: 'Rosa',     hex: '#f43f5e', badge: 'bg-rose-100 text-rose-700 border-rose-200',          solid: 'bg-rose-700 text-white' },
  { key: 'indigo',    label: 'Índigo',   hex: '#6366f1', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',    solid: 'bg-indigo-700 text-white' },
  { key: 'teal',      label: 'Verde azulado', hex: '#14b8a6', badge: 'bg-teal-100 text-teal-700 border-teal-200',     solid: 'bg-teal-700 text-white' },
  { key: 'naranja',   label: 'Naranja',  hex: '#f97316', badge: 'bg-orange-100 text-orange-700 border-orange-200',    solid: 'bg-orange-700 text-white' },
  { key: 'lima',      label: 'Lima',     hex: '#84cc16', badge: 'bg-lime-100 text-lime-700 border-lime-200',          solid: 'bg-lime-700 text-white' },
  { key: 'fucsia',    label: 'Fucsia',   hex: '#d946ef', badge: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', solid: 'bg-fuchsia-700 text-white' },
  { key: 'cian',      label: 'Cian',     hex: '#06b6d4', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',          solid: 'bg-cyan-700 text-white' },
  { key: 'pizarra',   label: 'Pizarra',  hex: '#64748b', badge: 'bg-slate-100 text-slate-700 border-slate-200',       solid: 'bg-slate-700 text-white' },
];

/** Claves válidas — el backend valida contra esta misma lista (ver schemas.ts). */
export const CLAVES_COLOR_PROVEEDOR = COLORES_PROVEEDOR.map(c => c.key);

export interface ProveedorConColor {
  id: string;
  nombre?: string | null;
  color?: string | null;
}

// Mismo mecanismo de hash que `avatarColor()` (suma de charCodes % largo), pero
// sobre el id y no sobre el nombre: así renombrar un proveedor no le cambia el
// color que el usuario ya tiene asociado visualmente.
function colorDerivado(id: string): ColorProveedor {
  const code = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return COLORES_PROVEEDOR[code % COLORES_PROVEEDOR.length];
}

/**
 * Color a mostrar para un proveedor.
 * - Si tiene `color` elegido a mano y es una clave válida, gana ese.
 * - Si no, se deriva del id (estable, siempre el mismo para el mismo proveedor).
 * - Sin proveedor, `null` (el producto no muestra badge).
 */
export function colorProveedor(prov?: ProveedorConColor | null): ColorProveedor | null {
  if (!prov?.id) return null;
  if (prov.color) {
    const elegido = COLORES_PROVEEDOR.find(c => c.key === prov.color);
    if (elegido) return elegido;
  }
  return colorDerivado(prov.id);
}
