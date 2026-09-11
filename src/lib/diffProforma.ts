// Diff puro entre dos revisiones (snapshots) de una proforma. Sin dependencias
// de React — se usa tanto en la vista pública como en el panel admin.
//
// El snapshot es el que arma `proforma_snapshot()` en la migración
// 20260910000011: cada ítem trae su `id` (fila de operacion_items en ese
// momento), los ids de catálogo (`producto_id`, `servicio_id`,
// `tipo_abertura_id`, `sistema_id`) y los nombres ya resueltos.
//
// Matching en 4 pasadas, cada ítem se usa una sola vez:
//   1. Por `id` — pasa cuando no hubo un PUT entre dos envíos (ej. solo se
//      extendió la validez y se reenvió).
//   2. Por clave fuerte (tipo + producto/servicio + tipo de abertura/sistema +
//      medidas + color + vidrio), si es única en ambos lados.
//   3. Por score entre los candidatos que comparten tipo y algún id de
//      catálogo — cubre cambios de medida/color dentro del mismo ítem.
//   4. Lo que queda: quitado (solo en A) o agregado (solo en B).

export interface DiffSnapshotItem {
  id?: string | null;
  orden?: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista?: number | null;
  precio_instalacion: number;
  incluye_instalacion: boolean;
  precio_total?: number;
  medida_ancho: number | null;
  medida_alto: number | null;
  color: string | null;
  vidrio: string | null;
  premarco?: boolean | null;
  accesorios?: string[] | null;
  notas?: string | null;
  tipo_item?: string | null;
  tipo_abertura_id?: string | null;
  sistema_id?: string | null;
  producto_id?: string | null;
  servicio_id?: string | null;
  tipo_abertura_nombre?: string | null;
  sistema_nombre?: string | null;
  servicio_nombre?: string | null;
  producto_nombre?: string | null;
}

export interface DiffSnapshot {
  forma_pago: string | null;
  forma_envio: string | null;
  costo_envio: number | null;
  tiempo_entrega: number | null;
  fecha_validez: string | null;
  notas: string | null;
  precio_total: number;
  items: DiffSnapshotItem[];
  formas_pago_alternativas?: { nombre: string; descuento_pct: number }[];
}

export type EstadoItemDiff = 'igual' | 'modificado' | 'agregado' | 'quitado';

export interface CambioCampo {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface FilaDiffItem {
  estado: EstadoItemDiff;
  antes?: DiffSnapshotItem;
  despues?: DiffSnapshotItem;
  cambios: CambioCampo[];
}

export interface DiffProforma {
  items: FilaDiffItem[];
  header: CambioCampo[];
  formas_pago: FilaDiffItem[];
  total: { antes: number; despues: number; delta: number; delta_pct: number };
  resumen: { agregados: number; quitados: number; modificados: number; iguales: number };
}

// Campos comparados ítem a ítem para decidir si hubo cambio y armar los chips
// ("cantidad 2 → 3", "medidas 1.20 × 1.00 → 1.50 × 1.20"...).
const CAMPOS_ITEM: { campo: keyof DiffSnapshotItem; label: string }[] = [
  { campo: 'descripcion',          label: 'Descripción' },
  { campo: 'cantidad',             label: 'Cantidad' },
  { campo: 'precio_unitario',      label: 'Precio' },
  { campo: 'precio_lista',         label: 'Precio de lista' },
  { campo: 'precio_instalacion',   label: 'Instalación' },
  { campo: 'incluye_instalacion',  label: 'Incluye instalación' },
  { campo: 'medida_ancho',         label: 'Ancho' },
  { campo: 'medida_alto',          label: 'Alto' },
  { campo: 'color',                label: 'Color' },
  { campo: 'vidrio',               label: 'Vidrio' },
  { campo: 'premarco',             label: 'Premarco' },
  { campo: 'accesorios',           label: 'Accesorios' },
  { campo: 'notas',                label: 'Notas' },
  { campo: 'tipo_abertura_nombre', label: 'Tipo' },
  { campo: 'sistema_nombre',       label: 'Sistema' },
  { campo: 'producto_nombre',      label: 'Producto' },
];

function normVal(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(x => String(x).trim()).join(',');
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return String(Number(v));
  return String(v).trim();
}

function compararItems(a: DiffSnapshotItem, b: DiffSnapshotItem): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const { campo, label } of CAMPOS_ITEM) {
    const va = (a as unknown as Record<string, unknown>)[campo];
    const vb = (b as unknown as Record<string, unknown>)[campo];
    if (normVal(va) !== normVal(vb)) {
      cambios.push({ campo: label, antes: va, despues: vb });
    }
  }
  return cambios;
}

function claveFuerte(it: DiffSnapshotItem): string {
  return [
    it.tipo_item ?? '', it.producto_id ?? it.servicio_id ?? '',
    it.tipo_abertura_id ?? '', it.sistema_id ?? '',
    it.medida_ancho ?? '', it.medida_alto ?? '', it.color ?? '', it.vidrio ?? '',
  ].join('|');
}

// Score de similitud entre dos ítems que ya comparten tipo + algún id de
// catálogo. Usado en la pasada 3 para resolver "cambió de medidas/color".
function scoreCandidato(a: DiffSnapshotItem, b: DiffSnapshotItem): number {
  let s = 0;
  if (normVal(a.descripcion) === normVal(b.descripcion)) s += 3;
  if (normVal(a.medida_ancho) === normVal(b.medida_ancho) && normVal(a.medida_alto) === normVal(b.medida_alto)) s += 2;
  if (normVal(a.color) === normVal(b.color)) s += 1;
  if (normVal(a.vidrio) === normVal(b.vidrio)) s += 1;
  if ((a.orden ?? 0) === (b.orden ?? 0)) s += 1;
  if (normVal(a.cantidad) === normVal(b.cantidad)) s += 1;
  return s;
}

function compartenCatalogo(a: DiffSnapshotItem, b: DiffSnapshotItem): boolean {
  if ((a.tipo_item ?? '') !== (b.tipo_item ?? '')) return false;
  if (a.producto_id && a.producto_id === b.producto_id) return true;
  if (a.servicio_id && a.servicio_id === b.servicio_id) return true;
  if (a.tipo_abertura_id && a.tipo_abertura_id === b.tipo_abertura_id
      && a.sistema_id === b.sistema_id) return true;
  return false;
}

function diffItems(itemsA: DiffSnapshotItem[], itemsB: DiffSnapshotItem[]): FilaDiffItem[] {
  const restA = new Set(itemsA.map((_, i) => i));
  const restB = new Set(itemsB.map((_, i) => i));
  const matchB: Map<number, number> = new Map(); // índice B → índice A

  // Pasada 1: por id (mismo operacion_item.id en ambos snapshots)
  for (const ib of [...restB]) {
    const b = itemsB[ib];
    if (!b.id) continue;
    const ia = [...restA].find(i => itemsA[i].id && itemsA[i].id === b.id);
    if (ia !== undefined) { matchB.set(ib, ia); restA.delete(ia); restB.delete(ib); }
  }

  // Pasada 2: clave fuerte única en ambos lados
  const clavesA = new Map<string, number[]>();
  for (const ia of restA) {
    const k = claveFuerte(itemsA[ia]);
    clavesA.set(k, [...(clavesA.get(k) ?? []), ia]);
  }
  for (const ib of [...restB]) {
    const k = claveFuerte(itemsB[ib]);
    const candidatos = clavesA.get(k);
    if (candidatos && candidatos.length === 1 && restA.has(candidatos[0])) {
      const ia = candidatos[0];
      matchB.set(ib, ia); restA.delete(ia); restB.delete(ib);
    }
  }

  // Pasada 3: score entre candidatos que comparten catálogo, mayor score primero
  type Par = { ia: number; ib: number; score: number };
  const pares: Par[] = [];
  for (const ia of restA) {
    for (const ib of restB) {
      if (!compartenCatalogo(itemsA[ia], itemsB[ib])) continue;
      const score = scoreCandidato(itemsA[ia], itemsB[ib]);
      if (score >= 2) pares.push({ ia, ib, score });
    }
  }
  pares.sort((x, y) => y.score - x.score);
  for (const { ia, ib } of pares) {
    if (!restA.has(ia) || !restB.has(ib)) continue;
    matchB.set(ib, ia); restA.delete(ia); restB.delete(ib);
  }

  // Armar filas en el orden de B; los quitados (solo en A) al final
  const filas: FilaDiffItem[] = itemsB.map((b, ib) => {
    const ia = matchB.get(ib);
    if (ia === undefined) return { estado: 'agregado' as const, despues: b, cambios: [] };
    const a = itemsA[ia];
    const cambios = compararItems(a, b);
    return { estado: (cambios.length ? 'modificado' : 'igual') as EstadoItemDiff, antes: a, despues: b, cambios };
  });
  for (const ia of restA) {
    filas.push({ estado: 'quitado', antes: itemsA[ia], cambios: [] });
  }
  return filas;
}

const CAMPOS_HEADER: { campo: keyof DiffSnapshot; label: string }[] = [
  { campo: 'forma_pago',     label: 'Forma de pago' },
  { campo: 'forma_envio',    label: 'Envío' },
  { campo: 'costo_envio',    label: 'Costo de envío' },
  { campo: 'tiempo_entrega', label: 'Tiempo de entrega' },
  { campo: 'fecha_validez',  label: 'Válido hasta' },
  { campo: 'notas',          label: 'Observaciones' },
];

function diffHeader(a: DiffSnapshot, b: DiffSnapshot): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const { campo, label } of CAMPOS_HEADER) {
    const va = a[campo], vb = b[campo];
    if (normVal(va) !== normVal(vb)) cambios.push({ campo: label, antes: va, despues: vb });
  }
  return cambios;
}

function diffFormasPago(a: DiffSnapshot, b: DiffSnapshot): FilaDiffItem[] {
  const listaA = a.formas_pago_alternativas ?? [];
  const listaB = b.formas_pago_alternativas ?? [];
  const porNombreA = new Map(listaA.map(f => [f.nombre, f]));
  const usadosA = new Set<string>();
  const filas: FilaDiffItem[] = listaB.map(fb => {
    const fa = porNombreA.get(fb.nombre);
    if (!fa) return { estado: 'agregado' as const, despues: fb as unknown as DiffSnapshotItem, cambios: [] };
    usadosA.add(fb.nombre);
    const cambios: CambioCampo[] = normVal(fa.descuento_pct) !== normVal(fb.descuento_pct)
      ? [{ campo: 'Descuento', antes: fa.descuento_pct, despues: fb.descuento_pct }] : [];
    return {
      estado: (cambios.length ? 'modificado' : 'igual') as EstadoItemDiff,
      antes: fa as unknown as DiffSnapshotItem, despues: fb as unknown as DiffSnapshotItem, cambios,
    };
  });
  for (const fa of listaA) {
    if (!usadosA.has(fa.nombre)) filas.push({ estado: 'quitado', antes: fa as unknown as DiffSnapshotItem, cambios: [] });
  }
  return filas;
}

export function diffProforma(a: DiffSnapshot, b: DiffSnapshot): DiffProforma {
  const items = diffItems(a.items, b.items);
  const totalA = Number(a.precio_total);
  const totalB = Number(b.precio_total);
  const delta = totalB - totalA;
  const resumen = items.reduce((r, f) => {
    if (f.estado === 'agregado') r.agregados++;
    else if (f.estado === 'quitado') r.quitados++;
    else if (f.estado === 'modificado') r.modificados++;
    else r.iguales++;
    return r;
  }, { agregados: 0, quitados: 0, modificados: 0, iguales: 0 });

  return {
    items,
    header: diffHeader(a, b),
    formas_pago: diffFormasPago(a, b),
    total: { antes: totalA, despues: totalB, delta, delta_pct: totalA > 0 ? (delta / totalA) * 100 : 0 },
    resumen,
  };
}
