import type { ProductoRevision } from './tipos';

// Filtros compartidos por las pestañas de la Revisión integral de precios.

export interface Filtro { q: string; familia: string; proveedor: string; linea: string }
export const FILTRO_VACIO: Filtro = { q: '', familia: '', proveedor: '', linea: '' };

export function aplicarFiltro(ps: ProductoRevision[], f: Filtro): ProductoRevision[] {
  const q = f.q.trim().toLowerCase();
  return ps.filter(p =>
    (!q || [p.nombre, p.codigo, p.color, p.proveedor, p.familia, p.linea].some(v => v?.toLowerCase().includes(q)))
    && (!f.familia || (f.familia === 'sin' ? !p.tipo_abertura_id : p.tipo_abertura_id === f.familia))
    && (!f.proveedor || (f.proveedor === 'sin' ? !p.proveedor_id : p.proveedor_id === f.proveedor))
    && (!f.linea || (p.linea_id ?? p.sistema_id) === f.linea));
}

