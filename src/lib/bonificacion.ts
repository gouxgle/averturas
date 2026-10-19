// Espejo de server/src/lib/bonificacion.ts (el servidor recalcula siempre; esto es la vista previa).
export type TipoBonificacion = 'porcentaje' | 'monto';

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Base de la bonificación: solo productos (sin instalación ni envío). */
export function baseBonificable(items: { precio_unitario?: number | string | null; cantidad?: number | string | null }[]): number {
  return redondear(items.reduce((s, it) => s + Number(it.precio_unitario ?? 0) * Number(it.cantidad ?? 1), 0));
}

export function calcularBonificacion(base: number, tipo: TipoBonificacion | null | undefined, valor: number | null | undefined): number {
  if (!tipo || !valor || valor <= 0 || base <= 0) return 0;
  return tipo === 'porcentaje'
    ? redondear(base * Math.min(valor, 100) / 100)
    : redondear(Math.min(valor, base));
}

/** "10%" o "$ 50.000" para rótulos. */
export function rotuloBonificacion(tipo: TipoBonificacion | null | undefined, valor: number | string | null | undefined): string {
  const v = Number(valor ?? 0);
  if (!tipo || v <= 0) return '';
  return tipo === 'porcentaje' ? `${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%` : `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}
