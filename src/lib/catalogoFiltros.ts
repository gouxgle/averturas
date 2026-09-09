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

// Línea comercial: un solo estilo, porque los valores ya no son un enum fijo — se
// administran desde Configuración → Líneas y cada negocio arma los suyos.
export const LINEA_COLOR = 'bg-amber-50 text-amber-700 border-amber-200';

// Sistema técnico (perfiles de aluminio) — vive en atributos.sistema.
export const L_SISTEMA: Record<string, string> = {
  herrero: 'Herrero', modena: 'Módena', a30: 'A30',
};

export function buildSubtitle(p: Producto): string {
  const a = p.atributos ?? {};
  const parts: string[] = [];
  if (p.material) parts.push(p.material);
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

/** Minúsculas y sin acentos, para que "celosia" encuentre "Celosía". */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Un par de números de una misma expresión de medida, llevado a centímetros.
 *
 * El catálogo real mezcla las tres unidades — el nombre suele venir en metros
 * ("Ventana 1,50x1,00"), el código en milímetros ("VEH-1500X600") y las columnas
 * ancho/alto en centímetros. Se normaliza el PAR junto (no cada número suelto)
 * porque ambos vienen de la misma expresión: "1500X600" es mm en los dos lados,
 * no 150cm y 600cm. */
function parEnCm(a: number, b: number): [number, number] {
  if (a >= 1000 || b >= 1000) return [a / 10, b / 10];       // milímetros
  if (a < 10 && b < 10)       return [a * 100, b * 100];     // metros
  return [a < 10 ? a * 100 : a, b < 10 ? b * 100 : b];       // mezcla ("1,20x205")
}

const RE_PAR = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/g;
const numero = (s: string) => parseFloat(s.replace(',', '.'));

/** Todas las medidas del producto en cm, de las dos fuentes que existen:
 *  las columnas ancho/alto y las que vienen escritas en el nombre o el código.
 *  Se toman las dos porque no siempre coinciden: hay productos cargados como
 *  "Ventiluz 1,20x0,40" con alto=400 en la columna. Buscando cualquiera de las
 *  dos formas se lo tiene que encontrar igual. */
function medidasDe(p: Producto): { pares: [number, number][]; valores: number[] } {
  const pares: [number, number][] = [];
  if (p.ancho != null && p.alto != null) pares.push(parEnCm(Number(p.ancho), Number(p.alto)));

  const texto = `${p.nombre ?? ''} ${p.codigo ?? ''}`;
  for (const m of texto.matchAll(RE_PAR)) pares.push(parEnCm(numero(m[1]), numero(m[2])));

  const valores = pares.flat();
  if (p.ancho != null) valores.push(Number(p.ancho));
  if (p.alto  != null) valores.push(Number(p.alto));
  return { pares, valores };
}

const CERCA = 1; // cm de tolerancia: "1,50x1,00" cargado como alto=99 igual matchea

/**
 * Búsqueda multi-criterio. Cada palabra de la consulta tiene que matchear en
 * ALGÚN campo (AND entre palabras, OR entre campos), así se combinan criterios
 * distintos en una sola caja: "ventana blanca 150x100", "herrero 0,80x2,00",
 * "corrediza alumar".
 *
 * Las palabras que son una medida ("150x100", "1,50x1,00", "1500x1000") se
 * comparan contra las medidas reales del producto en cm y en las dos
 * orientaciones — no como texto, que era lo que hacía que el placeholder
 * prometiera búsqueda por medida sin que funcionara.
 */
export function productoMatchTexto(p: Producto, query: string): boolean {
  // "120 x 100" y "120x100" son lo mismo: se pegan los separadores entre números.
  const q = norm(query).trim().replace(/(\d)\s*[x×*]\s*(\d)/g, '$1x$2');
  if (!q) return true;

  const atributos = Object.values(p.atributos ?? {})
    .filter(v => typeof v === 'string' || typeof v === 'number')
    .map(v => String(v).replace(/_/g, ' '));

  const texto = norm([
    p.nombre, p.codigo, p.tipo_abertura?.nombre, p.sistema?.nombre, p.material,
    p.modelo?.nombre, p.linea?.nombre, p.proveedor?.nombre, p.color, p.vidrio,
    p.caracteristica_1, p.caracteristica_2, p.caracteristica_3, p.caracteristica_4,
    ...atributos,
  ].filter(Boolean).join(' '));

  let medidas: ReturnType<typeof medidasDe> | null = null;
  const deMedidas = () => (medidas ??= medidasDe(p));

  return q.split(/\s+/).every(token => {
    if (texto.includes(token)) return true;
    // Tolerancia de género/número: quien busca "puerta blanca" tiene que encontrar
    // el producto cuyo color está cargado como "Blanco". Se recorta el plural y la
    // vocal final, exigiendo una raíz de 4+ letras para no volverlo impreciso.
    const raiz = token.replace(/s$/, '').replace(/[ao]$/, '');
    if (raiz.length >= 4 && raiz !== token && texto.includes(raiz)) return true;

    const par = token.match(/^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/);
    if (par) {
      const [a, b] = parEnCm(numero(par[1]), numero(par[2]));
      return deMedidas().pares.some(([pa, pb]) =>
        (Math.abs(pa - a) <= CERCA && Math.abs(pb - b) <= CERCA) ||
        (Math.abs(pa - b) <= CERCA && Math.abs(pb - a) <= CERCA));
    }

    if (/^\d+(?:[.,]\d+)?$/.test(token)) {
      const n = numero(token);
      // Un número suelto puede venir en cualquiera de las tres unidades.
      const candidatos = [n, n < 10 ? n * 100 : n, n >= 1000 ? n / 10 : n];
      return deMedidas().valores.some(v => candidatos.some(c => Math.abs(v - c) <= CERCA));
    }

    return false;
  });
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
  sistema: 'Sistema',
};
const ATTR_VALUE_MAPS: Record<string, Record<string, string>> = {
  tipo_ventana: L_TIPO_VENTANA, hojas: L_HOJAS_VNT, config_hojas: L_CONFIG_HOJAS,
  marco_tipo: L_MARCO, uso: L_USO, sistema: L_SISTEMA,
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
export function buildFacets(items: Producto[], opts?: { soloTransversales?: boolean; excludeAttrKeys?: string[] }): FacetDef[] {
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

  // Línea comercial — la faceta guarda el id (la FK) y muestra el nombre, así renombrar
  // una línea en Configuración no rompe el filtro.
  const lineaCounts = new Map<string, { nombre: string; count: number }>();
  items.forEach(p => {
    if (!p.linea?.id) return;
    const prev = lineaCounts.get(p.linea.id);
    if (prev) prev.count++;
    else lineaCounts.set(p.linea.id, { nombre: p.linea.nombre, count: 1 });
  });
  if (lineaCounts.size >= 2) {
    facets.push({
      key: 'linea', label: 'Línea',
      options: [...lineaCounts.entries()]
        .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
        .map(([value, v]) => ({ value, label: v.nombre, count: v.count })),
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

  // Nota: la "Medida (cm)" transversal se sacó de acá — es el 4° paso de la búsqueda en
  // cascada (Material → Familia → Tipología → Medida, ver catalogoCascada.ts) en los
  // dos consumidores de este archivo, así que una faceta aparte sería un control
  // duplicado para el mismo dato.

  if (opts?.soloTransversales) return facets;

  const excluir = new Set(opts?.excludeAttrKeys ?? []);
  const attrCounts = new Map<string, Map<string, number>>();
  items.forEach(p => {
    Object.entries(p.atributos ?? {}).forEach(([k, v]) => {
      if (excluir.has(k)) return;
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
    } else if (key === 'linea') {
      if (!p.linea?.id || !values.includes(p.linea.id)) return false;
    } else if (key.startsWith('attr:')) {
      const raw = p.atributos?.[key.slice(5)];
      const sv = typeof raw === 'boolean' ? (raw ? '__true__' : '__false__') : raw == null ? '' : String(raw);
      if (!values.includes(sv)) return false;
    }
  }
  return true;
}
