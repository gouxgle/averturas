import { db } from '../db.js';

type Queryable = { query: typeof db.query };

// Reservas de stock (regla del 2026-11-14: "lo que no tiene seña no está reservado").
// - Un presupuesto, enviado o aprobado SIN pago no reserva nada.
// - La reserva nace con el primer recibo emitido (sincronizarReserva desde POST /recibos) y se
//   ajusta sola: al emitir un remito (lo entregado deja de estar reservado; lo que falta sigue),
//   al cancelar un remito y al anular recibos (sin ningún recibo emitido, se libera).
// - Se libera entera al cancelar / rechazar / anular / deshacer la aprobación (liberarReservas).
// - Una reserva NO baja el stock físico (ver stock_fisico/stock_disponible en la base).
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
  await q.query(`
    UPDATE tareas SET completada = true, completada_at = now(), completada_by = $2
    WHERE operacion_id = $1 AND NOT completada AND descripcion LIKE 'Reserva de stock de %'
  `, [operacionId, userId]);
  return rows.length;
}

const DESC_TAREA = 'Reserva de stock';

export interface ReservaResultado { reservado: number; sin_stock: { producto_id: string; nombre: string; faltan: number }[] }

/**
 * Deja la reserva de la operación igual a lo que corresponde ahora: si tiene al menos un recibo
 * emitido, reserva lo que falta entregar de cada producto (cantidad del presupuesto − lo que ya
 * salió en remitos emitidos/entregados), hasta lo disponible (sin contar su propia reserva); si no
 * tiene pagos, la reserva queda en cero. Idempotente: inserta solo la diferencia. Corre dentro de la
 * transacción del llamador. Mantiene la tarea "Reserva de stock" (revisar a los 30 días si sigue sin
 * entregarse) y la cierra cuando ya no queda nada reservado.
 */
export async function sincronizarReserva(
  q: Queryable, operacionId: string, referenciaNro: string | null, userId: string | null,
): Promise<ReservaResultado> {
  const { rows: [op] } = await q.query(`
    SELECT o.numero, o.cliente_id, o.estado,
      -- Seña = un recibo del cliente; el de una visita de relevamiento acreditada no cuenta (igual que para comprar).
      EXISTS (SELECT 1 FROM recibos r WHERE r.operacion_id = o.id AND r.estado = 'emitido'
              AND NOT EXISTS (SELECT 1 FROM visitas_tecnicas vt WHERE vt.recibo_id = r.id)) AS pagado
    FROM operaciones o WHERE o.id = $1`, [operacionId]);
  if (!op) return { reservado: 0, sin_stock: [] };
  // Lo ya entregado sale solo del cálculo (remitos emitidos/entregados), así una entrega parcial no suelta el resto.
  const vigente = op.pagado && !['cancelado', 'rechazado'].includes(op.estado);

  const { rows } = await q.query(`
    WITH pendiente AS (
      SELECT oi.producto_id,
        SUM(GREATEST(0, oi.cantidad - COALESCE((
          SELECT SUM(ri.cantidad) FROM remito_items ri JOIN remitos rm ON rm.id = ri.remito_id
          WHERE ri.operacion_item_id = oi.id AND rm.estado IN ('emitido', 'entregado')), 0)))::int AS falta
      FROM operacion_items oi
      WHERE oi.operacion_id = $1 AND oi.producto_id IS NOT NULL AND COALESCE(oi.tipo_item, 'estandar') = 'estandar'
      GROUP BY oi.producto_id
    ), actual AS (
      SELECT producto_id, (-SUM(cantidad))::int AS reservado
      FROM stock_movimientos WHERE operacion_id = $1 AND tipo = 'reserva' GROUP BY producto_id
    )
    SELECT COALESCE(p.producto_id, a.producto_id) AS producto_id, cp.nombre,
      COALESCE(p.falta, 0) AS falta, COALESCE(a.reservado, 0) AS reservado,
      GREATEST(0, stock_disponible(COALESCE(p.producto_id, a.producto_id), $1::uuid)) AS disponible
    FROM pendiente p FULL JOIN actual a ON a.producto_id = p.producto_id
    JOIN catalogo_productos cp ON cp.id = COALESCE(p.producto_id, a.producto_id)
  `, [operacionId]);

  let reservado = 0;
  const sin_stock: ReservaResultado['sin_stock'] = [];
  for (const r of rows) {
    const objetivo = vigente ? Math.min(r.falta, r.disponible) : 0;
    if (vigente && r.falta > objetivo) sin_stock.push({ producto_id: r.producto_id, nombre: r.nombre, faltan: r.falta - objetivo });
    const delta = objetivo - r.reservado;   // positivo = reservar más
    if (delta !== 0) {
      await q.query(`
        INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
        VALUES ($1, 'reserva', $2, $3, $4, $5, $6)
      `, [r.producto_id, -delta,
          delta > 0 ? `Reserva por pago (${op.numero})` : `Reserva ajustada (${op.numero})`,
          operacionId, referenciaNro, userId]);
    }
    reservado += objetivo;
  }

  // Tarea de control: una sola pendiente por operación mientras haya algo reservado.
  if (reservado > 0) {
    await q.query(`
      INSERT INTO tareas (cliente_id, operacion_id, descripcion, notas, tipo_accion, prioridad, vencimiento, created_by)
      SELECT $1, $2, $3, $4, 'seguimiento', 'normal', CURRENT_DATE + 30, $5
      WHERE NOT EXISTS (SELECT 1 FROM tareas WHERE operacion_id = $2 AND NOT completada AND descripcion LIKE $6)
    `, [op.cliente_id, operacionId, `${DESC_TAREA} de ${op.numero}: ¿entregar o liberar?`,
        'Esta venta está señada y tiene stock reservado hace 30 días sin entregarse. Coordiná la entrega o, si no sigue, ' +
        'liberá la reserva desde el presupuesto para que ese stock se pueda vender.', userId, `${DESC_TAREA} de %`]);
  } else {
    await q.query(`
      UPDATE tareas SET completada = true, completada_at = now(), completada_by = $2
      WHERE operacion_id = $1 AND NOT completada AND descripcion LIKE $3
    `, [operacionId, userId, `${DESC_TAREA} de %`]);
  }
  return { reservado, sin_stock };
}
