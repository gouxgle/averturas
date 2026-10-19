import type { PoolClient } from 'pg';

type Queryable = Pick<PoolClient, 'query'>;

export type TipoBonificacion = 'porcentaje' | 'monto';

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Base de la bonificación: solo productos (sin instalación ni envío), igual que en el recibo. */
export function baseBonificable(items: { precio_unitario?: number | string | null; cantidad?: number | string | null }[]): number {
  return redondear(items.reduce((s, it) => s + Number(it.precio_unitario ?? 0) * Number(it.cantidad ?? 1), 0));
}

/** Monto bonificado: % redondeado a centavos, o monto fijo sin pasar de la base. Copia en src/lib/bonificacion.ts. */
export function calcularBonificacion(base: number, tipo: TipoBonificacion | null | undefined, valor: number | null | undefined): number {
  if (!tipo || !valor || valor <= 0 || base <= 0) return 0;
  return tipo === 'porcentaje'
    ? redondear(base * Math.min(valor, 100) / 100)
    : redondear(Math.min(valor, base));
}

/** Guarda la bonificación de la operación y recalcula su monto con los ítems ya insertados. */
export async function guardarBonificacion(
  client: Queryable, operacionId: string,
  b: { bonificacion_tipo?: TipoBonificacion | null; bonificacion_valor?: number | null; bonificacion_motivo?: string | null },
): Promise<number> {
  const tipo = b.bonificacion_tipo ?? null;
  const valor = tipo ? (b.bonificacion_valor ?? null) : null;
  const { rows } = await client.query(
    `SELECT precio_unitario, cantidad FROM operacion_items WHERE operacion_id = $1`, [operacionId]);
  const monto = calcularBonificacion(baseBonificable(rows), tipo, valor);
  await client.query(
    `UPDATE operaciones SET bonificacion_tipo = $2, bonificacion_valor = $3, bonificacion_motivo = $4, bonificacion_monto = $5
      WHERE id = $1`,
    [operacionId, monto > 0 ? tipo : null, monto > 0 ? valor : null, monto > 0 ? (b.bonificacion_motivo?.trim() || null) : null, monto]);
  return monto;
}

export class BonificacionError extends Error {
  constructor(message: string) { super(message); }
}

export interface BonificacionRecibo {
  tipo: TipoBonificacion | null;
  valor: number | null;
  motivo?: string | null;
}

/**
 * El recibo toma (total o en parte) la bonificación del presupuesto. Dentro de la transacción del recibo:
 *  - si el operador la cambió, se actualiza la operación (queda la última palabra de quien cobra);
 *  - se valida que lo aplicado no pase de lo que falta bonificar (total − lo ya tomado por recibos anteriores);
 *  - devuelve cuánto del descuento del recibo es bonificación del presupuesto y, si cambió, antes/después.
 */
export async function tomarBonificacionEnRecibo(
  client: Queryable,
  e: { operacion_id: string | null | undefined; monto_descuento: number; aplicado: number; cambio?: BonificacionRecibo | null },
): Promise<{ aplicado: number; cambio: { antes: string; despues: string } | null }> {
  const aplicado = Math.round((e.aplicado ?? 0) * 100) / 100;
  if (!e.operacion_id || (aplicado <= 0 && !e.cambio)) {
    if (aplicado > 0) throw new BonificacionError('La bonificación del presupuesto requiere una operación');
    return { aplicado: 0, cambio: null };
  }
  const { rows: [op] } = await client.query(
    `SELECT bonificacion_tipo, bonificacion_valor, bonificacion_motivo, bonificacion_monto FROM operaciones WHERE id = $1 FOR UPDATE`,
    [e.operacion_id]);
  if (!op) throw new BonificacionError('Operación no encontrada');
  const { rows: items } = await client.query(
    `SELECT precio_unitario, cantidad FROM operacion_items WHERE operacion_id = $1`, [e.operacion_id]);
  const base = baseBonificable(items);

  let tipo: TipoBonificacion | null = op.bonificacion_tipo, valor: number | null = op.bonificacion_valor == null ? null : Number(op.bonificacion_valor);
  let motivo: string | null = op.bonificacion_motivo;
  let monto = Number(op.bonificacion_monto);
  let cambio: { antes: string; despues: string } | null = null;
  if (e.cambio) {
    tipo = e.cambio.tipo; valor = e.cambio.tipo ? e.cambio.valor : null; motivo = e.cambio.motivo?.trim() || null;
    monto = calcularBonificacion(base, tipo, valor);
    const rot = (t: string | null, v: number | null, m: number) => (t && m > 0 ? `${t === 'porcentaje' ? `${v}%` : `$ ${v}`} (= $ ${m})` : 'sin bonificación');
    const antes = rot(op.bonificacion_tipo, op.bonificacion_valor == null ? null : Number(op.bonificacion_valor), Number(op.bonificacion_monto));
    const despues = rot(tipo, valor, monto);
    if (antes !== despues || (motivo ?? null) !== (op.bonificacion_motivo ?? null)) {
      await client.query(
        `UPDATE operaciones SET bonificacion_tipo = $2, bonificacion_valor = $3, bonificacion_motivo = $4, bonificacion_monto = $5 WHERE id = $1`,
        [e.operacion_id, monto > 0 ? tipo : null, monto > 0 ? valor : null, monto > 0 ? motivo : null, monto]);
      if (antes !== despues) cambio = { antes, despues };
    }
  }
  const { rows: [{ tomado }] } = await client.query(
    `SELECT COALESCE(SUM(bonificacion_presupuesto_monto), 0)::numeric AS tomado FROM recibos WHERE operacion_id = $1 AND estado = 'emitido'`,
    [e.operacion_id]);
  const falta = Math.max(monto - Number(tomado), 0);
  if (aplicado > falta + 0.01) {
    throw new BonificacionError(`La bonificación del presupuesto que falta aplicar es $ ${falta.toLocaleString('es-AR')} y el recibo toma $ ${aplicado.toLocaleString('es-AR')}`);
  }
  if (aplicado > Number(e.monto_descuento) + 0.01) {
    throw new BonificacionError('El descuento del recibo no puede ser menor que la bonificación del presupuesto que toma');
  }
  return { aplicado, cambio };
}
