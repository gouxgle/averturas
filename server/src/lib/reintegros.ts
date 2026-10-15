import type { PoolClient } from 'pg';
import { siguienteNumero } from './numeracion.js';
import { asentarSaldoFavor } from './saldoFavor.js';

type Queryable = Pick<PoolClient, 'query'>;

export const FORMAS_REINTEGRO = ['Efectivo', 'Transferencia', 'Otro'] as const;
export type FormaReintegro = typeof FORMAS_REINTEGRO[number];

export class ReintegroError extends Error {
  constructor(message: string, public status: 403 | 404 | 409 | 422) { super(message); }
}

export interface ReintegroCreado { id: string; numero: string; monto: number; forma_pago: string }

// Registra la salida de dinero (comprobante REI-). NO toca el libro de saldo a favor: quien lo llama
// decide si el dinero sale de una devolución (que nunca llegó a acreditarse) o de un saldo ya acreditado
// (en cuyo caso asienta el consumo). Corre dentro de la transacción del llamador.
export async function crearReintegro(client: Queryable, d: {
  cliente_id: string; devolucion_id?: string | null; operacion_id?: string | null;
  monto: number; forma_pago: FormaReintegro; referencia?: string | null; motivo?: string | null; userId: string | null;
}): Promise<ReintegroCreado> {
  const numero = await siguienteNumero(client as PoolClient, 'reintegros', 'REI');
  const { rows: [r] } = await client.query(`
    INSERT INTO reintegros (numero, cliente_id, devolucion_id, operacion_id, monto, forma_pago, referencia, motivo, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [numero, d.cliente_id, d.devolucion_id ?? null, d.operacion_id ?? null, d.monto, d.forma_pago,
    d.referencia?.trim() || null, d.motivo?.trim() || null, d.userId]);
  return { id: r.id as string, numero, monto: d.monto, forma_pago: d.forma_pago };
}

// Devolver en dinero un saldo a favor que el cliente ya tenía: valida que alcance (con el cliente
// bloqueado, dos reintegros simultáneos no pueden retirar el mismo crédito) y lo consume del libro.
export async function reintegrarSaldoFavor(client: Queryable, d: {
  cliente_id: string; monto: number; forma_pago: FormaReintegro; referencia?: string | null; motivo: string; userId: string | null;
}): Promise<ReintegroCreado> {
  await client.query(`SELECT id FROM clientes WHERE id = $1 FOR UPDATE`, [d.cliente_id]);
  const { rows: [s] } = await client.query(
    `SELECT COALESCE(SUM(monto), 0) AS saldo FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [d.cliente_id]);
  const disponible = Number(s.saldo);
  if (d.monto > disponible + 0.009) {
    throw new ReintegroError(`El cliente tiene $ ${disponible.toLocaleString('es-AR')} a favor: no se pueden devolver $ ${d.monto.toLocaleString('es-AR')}.`, 409);
  }
  const rei = await crearReintegro(client, { ...d, devolucion_id: null });
  await asentarSaldoFavor(client, {
    cliente_id: d.cliente_id, tipo: 'reintegro', monto: d.monto, reintegro_id: rei.id,
    descripcion: `Reintegro ${rei.numero} (${d.forma_pago})`, created_by: d.userId,
  });
  return rei;
}

// Anular un reintegro (admin): el dinero no salió, así que vuelve a quedar a favor del cliente.
// Si venía de una devolución, esa parte pasa de "reintegro" a "saldo a favor" en la propia devolución.
export async function anularReintegro(client: Queryable, id: string, motivo: string, userId: string | null) {
  const { rows: [r] } = await client.query(`SELECT * FROM reintegros WHERE id = $1 FOR UPDATE`, [id]);
  if (!r) throw new ReintegroError('Reintegro no encontrado', 404);
  if (r.estado === 'anulado') throw new ReintegroError('Este reintegro ya está anulado', 409);
  await client.query(`
    UPDATE reintegros SET estado = 'anulado', motivo_anulacion = $2, anulado_por = $3, anulado_at = now() WHERE id = $1
  `, [id, motivo, userId]);
  const monto = Number(r.monto);
  await asentarSaldoFavor(client, {
    cliente_id: r.cliente_id, tipo: 'anulacion', monto, reintegro_id: id, devolucion_id: r.devolucion_id,
    descripcion: `Reintegro ${r.numero} anulado: vuelve a quedar a favor`, created_by: userId,
  });
  if (r.devolucion_id) {
    await client.query(`
      UPDATE devoluciones SET reintegro_monto = reintegro_monto - $2, credito_monto = credito_monto + $2, updated_at = now() WHERE id = $1
    `, [r.devolucion_id, monto]);
  }
  return { ...r, estado: 'anulado' as const, monto };
}
