// Tipos y formato de la Revisión integral de precios (respuestas de /productos/revision-precios).

export type Estado = 'actualizar' | 'renovar' | 'al_dia' | 'sin_datos';

export interface Motivo { tipo: 'lista' | 'compra' | 'dolar' | 'recargo' | 'ipc' | 'aviso'; texto: string; pct?: number }

export interface Analisis {
  estado: Estado;
  costo_reposicion: number;
  recargo_actual: number | null;
  recargo_referencia: number | null;
  var_lista: number | null;
  var_compra: number | null;
  var_dolar: number | null;
  precio_por_costo: number | null;
  precio_por_dolar: number | null;
  precio_sugerido: number;
  pct_sugerido: number;
  motivos: Motivo[];
}

export interface ProductoRevision {
  id: string; nombre: string; codigo: string | null; color: string | null;
  costo: number; precio: number; precio_por_m2: boolean; precio_manual: boolean; en_salon: boolean;
  precio_actualizado_at: string;
  tipo_abertura_id: string | null; familia: string | null;
  sistema_id: string | null; sistema: string | null; linea_id: string | null; linea: string | null;
  proveedor_id: string | null; proveedor: string | null;
  recargo_objetivo: number | null;
  costo_lista: number | null; costo_lista_fecha: string | null;
  costo_compra: number | null; costo_compra_fecha: string | null;
  dolar_al_actualizar: number | null; dolar_hoy: number | null;
  dias: number; ipc_pct: number | null;
  ventas_90d: number; proformas_abiertas: number; stock: number;
  analisis: Analisis;
}

export interface Revision {
  config: { umbral_pct: number; dias_al_dia: number; dias_vencido: number };
  dolar: { hoy: number | null; fecha: string | null; var_30d: number | null };
  ipc: { ultimo: { mes: string; variacion: number } | null; ultimos_3: number | null };
  productos: ProductoRevision[];
}

export type AgruparPor = 'familia' | 'linea' | 'proveedor' | 'medida';

export const fmt$ = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
export const fmtPct = (n: number | null | undefined, signo = true) =>
  n === null || n === undefined ? '—' : `${signo && n > 0 ? '+' : ''}${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
export const fmtFecha = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

/** Clave y nombre del grupo de un producto (familia, línea/sistema, proveedor o por m²). */
export function grupoDe(p: ProductoRevision, por: AgruparPor): { clave: string; nombre: string } {
  if (por === 'familia') return { clave: p.tipo_abertura_id ?? 'sin', nombre: p.familia ?? 'Sin familia' };
  if (por === 'linea') return { clave: p.linea_id ?? p.sistema_id ?? 'sin', nombre: p.linea ?? p.sistema ?? 'Sin línea' };
  if (por === 'proveedor') return { clave: p.proveedor_id ?? 'sin', nombre: p.proveedor ?? 'Sin proveedor' };
  return p.precio_por_m2 ? { clave: 'm2', nombre: 'A medida (por m²)' } : { clave: 'unidad', nombre: 'Por unidad' };
}

/** Semáforo de la antigüedad del precio, con los días configurados. */
export function colorDias(dias: number, cfg: Revision['config']) {
  return dias <= cfg.dias_al_dia ? 'text-emerald-700' : dias <= cfg.dias_vencido ? 'text-amber-700' : 'text-red-700';
}

export const ESTADO_UI: Record<Estado, { label: string; cls: string }> = {
  actualizar: { label: 'Actualizar', cls: 'bg-orange-100 text-orange-800' },
  renovar:    { label: 'Renovar validez', cls: 'bg-sky-100 text-sky-800' },
  al_dia:     { label: 'Al día', cls: 'bg-emerald-100 text-emerald-800' },
  sin_datos:  { label: 'Sin datos', cls: 'bg-gray-100 text-gray-700' },
};

export const MOTIVO_CLS: Record<Motivo['tipo'], string> = {
  lista: 'bg-amber-50 text-amber-800 border-amber-200',
  compra: 'bg-amber-50 text-amber-800 border-amber-200',
  dolar: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  recargo: 'bg-red-50 text-red-800 border-red-200',
  ipc: 'bg-gray-50 text-gray-700 border-gray-200',
  aviso: 'bg-yellow-50 text-yellow-900 border-yellow-300',
};
