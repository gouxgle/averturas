import { db } from '../db.js';

type Queryable = { query: typeof db.query };

// Una aprobación online (pub.ts) reserva stock: un movimiento 'reserva' negativo por ítem.
// La reserva se cancela con el remito (aplicarTransicionRemito) o, si la venta no sigue
// adelante, al cancelar / rechazar / deshacer la aprobación. Antes solo lo hacía el remito:
// una operación cancelada dejaba el stock reservado para siempre.
//
// Netea a cero lo que haya reservado la operación (idempotente: llamarla dos veces no
// duplica). Corre dentro de la transacción del llamador. Devuelve cuántos productos liberó.
export async function liberarReservas(
  q: Queryable, operacionId: string, motivo: string, referenciaNro: string | null, userId: string | null,
): Promise<number> {
  const { rows } = await q.query(`
    SELECT producto_id, SUM(cantidad) AS total
    FROM stock_movimientos
    WHERE operacion_id = $1 AND tipo = 'reserva'
    GROUP BY producto_id
    HAVING SUM(cantidad) < 0
  `, [operacionId]);
  for (const r of rows) {
    await q.query(`
      INSERT INTO stock_movimientos
        (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
      VALUES ($1, 'reserva', $2, $3, $4, $5, $6)
    `, [r.producto_id, Math.abs(Number(r.total)), motivo, operacionId, referenciaNro, userId]);
  }
  return rows.length;
}
