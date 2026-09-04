// Búsqueda en cascada del catálogo: Material → Familia → Tipología → Medida estándar.
//
// Los primeros 3 ejes NO tienen un schema unificado en la base: Material es la nueva
// columna `catalogo_productos.material` (ver migración catalogo_productos_material);
// Familia es `tipo_abertura` (siempre poblado); Tipología vive dentro de `atributos`,
// pero con una clave DISTINTA por familia (ventanas: tipo_ventana, puertas: apertura,
// mosquiteras: tipo_mosquitera — mismo criterio de detección por nombre que ya usa
// NuevoProducto.tsx para elegir qué bloque de atributos mostrar). Medida sí es un eje
// real (`ancho`/`alto`, columnas numéricas).
//
// Cada selector calcula sus propias opciones excluyéndose a sí mismo del filtro (cross-
// filter): elegir Tipología no debería depender de haber elegido antes Familia — ambos
// se aplican en simultáneo sobre el resto. Por eso "no es obligatorio completar todos
// los pasos" sale gratis: cualquier subconjunto de los 4 campos ya filtra y ya alcanza
// para ver resultados.

import type { Producto } from '@/types';
import type { FacetOption } from '@/lib/catalogoFiltros';

export interface CascadaFiltro {
  material: string | null;
  familiaId: string | null;
  tipologia: string | null;
  medida: string | null;
}

export const CASCADA_VACIA: CascadaFiltro = { material: null, familiaId: null, tipologia: null, medida: null };

export function cascadaActiva(f: CascadaFiltro): boolean {
  return !!(f.material || f.familiaId || f.tipologia || f.medida);
}

// Misma heurística que NuevoProducto.tsx (líneas ~1408-1413): compara el NOMBRE de la
// familia, no el id — los tipos de abertura son editables desde Configuración y no
// tienen un id estable entre ambientes.
export function tipologiaKeyDeFamilia(nombreFamilia?: string | null): string | null {
  const n = (nombreFamilia ?? '').toLowerCase();
  if (n.includes('balc')) return 'tipo_ventana';               // Puerta-Balcón reusa el schema de ventana
  if (n.includes('puerta')) return 'apertura';
  if (n.includes('ventana')) return 'tipo_ventana';
  if (n.includes('mosquer') || n.includes('mosquit')) return 'tipo_mosquitera';
  return null;
}

export function productoTipologiaValor(p: Producto): string | null {
  const key = tipologiaKeyDeFamilia(p.tipo_abertura?.nombre);
  if (!key) return null;
  const v = p.atributos?.[key];
  return v == null || v === '' ? null : String(v);
}

export function productoMedidaValor(p: Producto): string | null {
  return p.ancho && p.alto ? `${p.ancho}x${p.alto}` : null;
}

// Labels legibles para el valor unificado de Tipología — une las 3 listas fijas de
// NuevoProducto.tsx (TIPO_VENTANA, valores de "apertura" en puertas, TIPO_MOSQUITERA).
// Un mismo valor ("corrediza") significa lo mismo en cualquier familia, por eso una
// sola tabla de labels alcanza para las tres.
const TIPOLOGIA_LABEL: Record<string, string> = {
  corrediza: 'Corrediza', con_celosia: 'Con celosía', de_abrir: 'De abrir/Batiente',
  banderola: 'Banderola', ventiluz: 'Ventiluz', aireador: 'Aireador', persiana: 'Persiana',
  plegable: 'Plegable', embutir: 'Embutir', fija: 'Fija', enrollable: 'Enrollable', plisada: 'Plisada',
};
function tipologiaLabel(v: string): string {
  return TIPOLOGIA_LABEL[v] ?? v.replace(/_/g, ' ');
}

function pasaCascada(p: Producto, f: CascadaFiltro, exceptStep?: keyof CascadaFiltro): boolean {
  if (exceptStep !== 'material' && f.material && p.material !== f.material) return false;
  if (exceptStep !== 'familiaId' && f.familiaId && p.tipo_abertura_id !== f.familiaId) return false;
  if (exceptStep !== 'tipologia' && f.tipologia && productoTipologiaValor(p) !== f.tipologia) return false;
  if (exceptStep !== 'medida' && f.medida && productoMedidaValor(p) !== f.medida) return false;
  return true;
}

function contarPor(
  items: Producto[],
  extractor: (p: Producto) => string | null,
  labelFn: (v: string) => string,
): FacetOption[] {
  const m = new Map<string, { label: string; count: number }>();
  items.forEach(p => {
    const v = extractor(p);
    if (v == null || v === '') return;
    const prev = m.get(v);
    if (prev) prev.count++;
    else m.set(v, { label: labelFn(v), count: 1 });
  });
  return [...m.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([value, v]) => ({ value, label: v.label, count: v.count }));
}

export function opcionesMateriales(productos: Producto[], f: CascadaFiltro): FacetOption[] {
  return contarPor(productos.filter(p => pasaCascada(p, f, 'material')), p => p.material, v => v);
}

export function opcionesFamilias(productos: Producto[], f: CascadaFiltro): FacetOption[] {
  return contarPor(
    productos.filter(p => pasaCascada(p, f, 'familiaId')),
    p => p.tipo_abertura_id,
    () => '',  // se resuelve abajo con el nombre real, no alcanza con el id
  ).map(opt => {
    const p = productos.find(pp => pp.tipo_abertura_id === opt.value);
    return { ...opt, label: p?.tipo_abertura?.nombre ?? opt.value };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

export function opcionesTipologias(productos: Producto[], f: CascadaFiltro): FacetOption[] {
  return contarPor(productos.filter(p => pasaCascada(p, f, 'tipologia')), productoTipologiaValor, tipologiaLabel);
}

export function opcionesMedidas(productos: Producto[], f: CascadaFiltro): FacetOption[] {
  const opts = contarPor(productos.filter(p => pasaCascada(p, f, 'medida')), productoMedidaValor, v => v.replace('x', ' × '));
  return opts.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

export function productosFiltradosPorCascada(productos: Producto[], f: CascadaFiltro): Producto[] {
  if (!cascadaActiva(f)) return productos;
  return productos.filter(p => pasaCascada(p, f));
}
