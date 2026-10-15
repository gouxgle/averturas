import type { PoolClient } from 'pg';

type Queryable = Pick<PoolClient, 'query'>;

export type TipoSaldoFavor = 'credito_devolucion' | 'consumo_recibo' | 'reintegro' | 'ajuste' | 'anulacion';

/**
 * ÚNICO lugar que escribe el libro de saldo a favor del cliente (mismo criterio que
 * asentarMovimiento() del proveedor en lib/compras.ts). Convención: monto positivo = a favor
 * del cliente; lo que usa o se le devuelve va en negativo. El saldo es SUM(monto)
 * (vista cliente_saldo_favor). Ninguna ruta inserta en la tabla directamente.
 *
 * Corre dentro de la transacción del llamador, que ya bloqueó al cliente (FOR UPDATE) si
 * necesita validar que alcance el saldo antes de consumirlo.
 */
export async function asentarSaldoFavor(client: Queryable, m: {
  cliente_id: string;
  tipo: TipoSaldoFavor;
  monto: number;
  devolucion_id?: string | null;
  recibo_id?: string | null;
  reintegro_id?: string | null;
  descripcion?: string | null;
  created_by?: string | null;
}): Promise<string> {
  // El crédito entra siempre en positivo; el consumo y el reintegro, siempre en negativo.
  // 'anulacion' y 'ajuste' llevan el signo que corresponda al que los llama.
  const monto = m.tipo === 'credito_devolucion' ? Math.abs(m.monto)
    : (m.tipo === 'consumo_recibo' || m.tipo === 'reintegro') ? -Math.abs(m.monto)
    : m.monto;
  const { rows: [row] } = await client.query(`
    INSERT INTO cliente_saldo_favor_movimientos
      (cliente_id, tipo, monto, devolucion_id, recibo_id, reintegro_id, descripcion, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [m.cliente_id, m.tipo, monto, m.devolucion_id ?? null, m.recibo_id ?? null, m.reintegro_id ?? null,
    m.descripcion ?? null, m.created_by ?? null]);
  return row.id as string;
}

/** Saldo a favor vigente del cliente (0 si nunca tuvo). */
export async function saldoFavorDe(client: Queryable, clienteId: string): Promise<number> {
  const { rows: [r] } = await client.query(
    `SELECT COALESCE(SUM(monto), 0) AS saldo FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [clienteId]);
  return Number(r.saldo);
}
