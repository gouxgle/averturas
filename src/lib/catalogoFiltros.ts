// Lógica pura de búsqueda, orden y facetas del catálogo de productos.
//
// Vivía inline en Productos.tsx, con la mitad duplicada en TarjetaProductoMosaico.tsx
// y una tercera copia degradada en el picker de NuevoPresupuesto.tsx. Al centralizarla
// acá, la sección Productos y el modal de catálogo del presupuesto comparten
// literalmente la misma búsqueda — no hay dos implementaciones que puedan divergir.

import type { Producto } from '@/types';
import { disponibilidadProducto } from '@/lib/disponibilidad';

// ── Etiquetas de atributos ────────────────────────────────────────────────────

export const L_TIPO_VENTANA: Record<string, string> = {
  corrediza:'Corrediza',con_celosia:'Con celosía',de_abrir:'De abrir',
  banderola:'Banderola',ventiluz:'Ventiluz',aireador:'Aireador',persiana:'Persiana',
};
export const L_HOJAS_VNT: Record<string, string> = {
  '2_hojas':'2 hojas','3_hojas':'3 hojas','4_hojas':'4 hojas',
};
export const L_CONFIG_HOJAS: Record<string, string> = {
  hoja_simple:'Hoja simple',hoja_y_media:'Hoja y media',
  dos_hojas:'2 hojas iguales',puerta_pano_fijo:'Puerta + paño fijo',
};
export const L_MARCO: Record<string, string> = { transitable:'Transitable',no_transitable:'No transitable' };
export const L_USO: Record<string, string> = { interior:'Interior',exterior:'Exterior',ingreso_frente:'Ingreso/Frente' };

export const NIVEL_COMERCIAL_LABEL: Record<string, string> = {
  economica: 'Económica', estandar: 'Estándar', premium: 'Premium', alta_seguridad: 'Alta seguridad',
};
export const NIVEL_COMERCIAL_COLOR: Record<string, string> = {
  economica: 'bg-slate-50 text-slate-600 border-slate-200',
  estandar: 'bg-sky-50 text-sky-700 border-sky-200',
  premium: 'bg-violet-50 text-violet-700 border-violet-200',
  alta_seguridad: 'bg-red-50 text-red-700 border-red-200',
};

export function buildSubtitle(p: Producto): string {
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

// ── Promoción ─────────────────────────────────────────────────────────────────

export function isPromoActiva(p: Pick<Producto, 'promocion'>): boolean {
  if (!p.promocion?.activo) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  if (p.promocion.fecha_inicio && hoy < p.promocion.fecha_inicio) return false;
  if (p.promocion.auto_renovar) return true;
  if (p.promocion.fecha_fin && hoy > p.promocion.fecha_fin) return false;
  return true;
}

// ── Búsqueda por texto ────────────────────────────────────────────────────────

/**
 * Campos buscables: unión de los que usaban por separado la sección Productos
 * (nombre / código / tipo) y la galería del presupuesto (además sistema y las dos
 * características libres). Una sola búsqueda, la más completa de las dos.
 */
export function productoMatchTexto(p: Producto, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const campos = [
    p.nombre, p.codigo, p.tipo_abertura?.nombre, p.sistema?.nombre,
    p.modelo?.nombre, p.caracteristica_1, p.caracteristica_2,
  ];
  return campos.some(c => c?.toLowerCase().includes(q));
}

// ── Ordenamiento ──────────────────────────────────────────────────────────────

export type SortKey = 'relevancia' | 'entrega_rapida' | 'precio_asc' | 'precio_desc' | 'stock_desc' | 'nombre';

export const SORT_LABEL: Record<SortKey, string> = {
  relevancia:     'Más relevantes',
  entrega_rapida: 'Entrega más rápida',
  precio_asc:     'Precio: menor a mayor',
  precio_desc:    'Precio: mayor a menor',
  stock_desc:     'Más stock disponible',
  nombre:         'Nombre A-Z',
};
const ETIQ_RANK: Record<string, number> = { mas_vendido: 0, recomendado: 1, nuevo: 2 };

export function precioEfectivo(p: Producto): number {
  return isPromoActiva(p) && p.promocion?.precio_oferta ? p.promocion.precio_oferta : p.precio_base;
}

export function sortProductos(lista: Producto[], sortBy: SortKey): Producto[] {
  const arr = [...lista];
  switch (sortBy) {
    case 'precio_asc':  return arr.sort((a, b) => precioEfectivo(a) - precioEfectivo(b));
    case 'precio_desc': return arr.sort((a, b) => precioEfectivo(b) - precioEfectivo(a));
    case 'stock_desc':  return arr.sort((a, b) => (b.stock_actual ?? 0) - (a.stock_actual ?? 0));
    case 'nombre':      return arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
    case 'entrega_rapida':
      // Un producto sin plazo conocido nunca puede quedar arriba: su rank es
      // MAX_SAFE_INTEGER (ver disponibilidad.ts), así que cae al final.
      return arr.sort((a, b) => {
        const ra = disponibilidadProducto(a).rank, rb = disponibilidadProducto(b).rank;
        return ra !== rb ? ra - rb : a.nombre.localeCompare(b.nombre);
      });
    default:
      return arr.sort((a, b) => {
        const ra = a.etiqueta ? ETIQ_RANK[a.etiqueta] ?? 3 : 3;
        const rb = b.etiqueta ? ETIQ_RANK[b.etiqueta] ?? 3 : 3;
        if (ra !== rb) return ra - rb;
        if (a.en_salon !== b.en_salon) return a.en_salon ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      });
  }
}

// ── Filtros por atributo (facetas) ─────────────────────────────────────────────
// Se calculan dinámicamente desde los productos visibles — no hardcodean el schema
// por tipo_abertura (ver 20260424000002_catalogo_atributos_schema.sql), así se
// adaptan solos si se agregan nuevos atributos desde NuevoProducto.tsx.

export interface FacetOption { value: string; label: string; count: number }
export interface FacetDef { key: string; label: string; options: FacetOption[] }

export const FACET_PROVEEDOR = '__proveedor';

const ATTR_FACET_LABEL: Record<string, string> = {
  tipo_puerta: 'Tipo', uso: 'Uso', config_hojas: 'Config. de hojas', apertura: 'Apertura',
  cerradura: 'Cerradura', vidrio_incluye: 'Vidrio', instalacion: 'Instalación',
  estructura: 'Estructura', hoja_principal: 'Hoja principal', tipo_ventana: 'Tipo',
  hojas: 'Cantidad de hojas', marco_tipo: 'Marco', tipo_provision: 'Provisión',
};
const ATTR_VALUE_MAPS: Record<string, Record<string, string>> = {
  tipo_ventana: L_TIPO_VENTANA, hojas: L_HOJAS_VNT, config_hojas: L_CONFIG_HOJAS,
  marco_tipo: L_MARCO, uso: L_USO,
};
export function attrValueLabel(key: string, v: string): string {
  if (v === '__true__') return 'Sí';
  if (v === '__false__') return 'No';
  return ATTR_VALUE_MAPS[key]?.[v] ?? v.replace(/_/g, ' ');
}

/**
 * @param soloTransversales — omite las facetas derivadas de `atributos`, que dependen
 * del schema del tipo de abertura y por eso no tienen sentido cuando el set mezcla
 * materiales (búsqueda libre, "Todos"). Proveedor, color, nivel y medida sí son
 * transversales: valen en cualquier set.
 */
export function buildFacets(items: Producto[], opts?: { soloTransversales?: boolean }): FacetDef[] {
  const facets: FacetDef[] = [];

  // Proveedor — el eje que permite comparar de quién viene cada opción del resultado
  // (y con qué demora). Va primero: es la pregunta que se hace al armar un presupuesto.
  const provCounts = new Map<string, { nombre: string; plazo: number | null; count: number }>();
  items.forEach(p => {
    if (!p.proveedor?.id) return;
    const prev = provCounts.get(p.proveedor.id);
    if (prev) prev.count++;
    else provCounts.set(p.proveedor.id, {
      nombre: p.proveedor.nombre, plazo: p.proveedor.plazo_entrega_dias ?? null, count: 1,
    });
  });
  if (provCounts.size >= 2) {
    facets.push({
      key: FACET_PROVEEDOR, label: 'Proveedor',
      options: [...provCounts.entries()]
        .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
        .map(([value, v]) => ({
          value, count: v.count,
          label: v.plazo != null ? `${v.nombre} · ≈${v.plazo}d` : v.nombre,
        })),
    });
  }

  const nivelCounts = new Map<string, number>();
  items.forEach(p => { if (p.nivel_comercial) nivelCounts.set(p.nivel_comercial, (nivelCounts.get(p.nivel_comercial) ?? 0) + 1); });
  if (nivelCounts.size >= 2) {
    facets.push({
      key: 'nivel_comercial', label: 'Nivel',
      options: [...nivelCounts.entries()].map(([value, count]) => ({ value, label: NIVEL_COMERCIAL_LABEL[value] ?? value, count })),
    });
  }

  const colorCounts = new Map<string, number>();
  items.forEach(p => { if (p.color) colorCounts.set(p.color, (colorCounts.get(p.color) ?? 0) + 1); });
  if (colorCounts.size >= 2) {
    facets.push({
      key: 'color', label: 'Color',
      options: [...colorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: value, count })),
    });
  }

  const medidaCounts = new Map<string, number>();
  items.forEach(p => {
    if (p.ancho && p.alto) {
      const k = `${p.ancho}x${p.alto}`;
      medidaCounts.set(k, (medidaCounts.get(k) ?? 0) + 1);
    }
  });
  if (medidaCounts.size >= 2) {
    facets.push({
      key: '__medida', label: 'Medida (cm)',
      options: [...medidaCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([value, count]) => ({ value, label: value.replace('x', ' × '), count })),
    });
  }

  if (opts?.soloTransversales) return facets;

  const attrCounts = new Map<string, Map<string, number>>();
  items.forEach(p => {
    Object.entries(p.atributos ?? {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || Array.isArray(v) || typeof v === 'object') return;
      const sv = typeof v === 'boolean' ? (v ? '__true__' : '__false__') : String(v);
      if (!attrCounts.has(k)) attrCounts.set(k, new Map());
      const m = attrCounts.get(k)!;
      m.set(sv, (m.get(sv) ?? 0) + 1);
    });
  });
  attrCounts.forEach((m, key) => {
    if (m.size < 2 || m.size > 8) return;
    facets.push({
      key: `attr:${key}`,
      label: ATTR_FACET_LABEL[key] ?? key.replace(/_/g, ' '),
      options: [...m.entries()].map(([value, count]) => ({ value, label: attrValueLabel(key, value), count })),
    });
  });

  return facets;
}

export function productoPasaFacets(p: Producto, activos: Record<string, string[]>): boolean {
  for (const [key, values] of Object.entries(activos)) {
    if (!values.length) continue;
    if (key === FACET_PROVEEDOR) {
      if (!p.proveedor?.id || !values.includes(p.proveedor.id)) return false;
    } else if (key === 'color') {
      if (!p.color || !values.includes(p.color)) return false;
    } else if (key === 'nivel_comercial') {
      if (!p.nivel_comercial || !values.includes(p.nivel_comercial)) return false;
    } else if (key === '__medida') {
      const k = p.ancho && p.alto ? `${p.ancho}x${p.alto}` : '';
      if (!values.includes(k)) return false;
    } else if (key.startsWith('attr:')) {
      const raw = p.atributos?.[key.slice(5)];
      const sv = typeof raw === 'boolean' ? (raw ? '__true__' : '__false__') : raw == null ? '' : String(raw);
      if (!values.includes(sv)) return false;
    }
  }
  return true;
}
