import { db } from '../db.js';

type Queryable = { query: typeof db.query };

// La entrega programada en el remito es la fuente de verdad; la tarea es su
// proyección en la agenda del CRM — mismo patrón que sincronizarTarea() en
// lib/oportunidades.ts. Idempotente: si tarea_id quedó NULL (se borró a
// mano), la regenera.
export async function sincronizarTareaEntrega(q: Queryable, remitoId: string): Promise<void> {
  const { rows: [r] } = await q.query(
    `SELECT id, cliente_id, operacion_id, tarea_id, fecha_entrega_est, hora_entrega_est, created_by
     FROM remitos WHERE id = $1`,
    [remitoId]
  );
  if (!r || !r.fecha_entrega_est) return;

  const horaTxt = r.hora_entrega_est ? ` a las ${String(r.hora_entrega_est).slice(0, 5)}hs` : '';
  const descripcion = `Entrega programada${horaTxt}`;

  if (r.tarea_id) {
    await q.query(
      `UPDATE tareas SET descripcion = $1, vencimiento = $2, completada = false, completada_at = NULL
       WHERE id = $3`,
      [descripcion, r.fecha_entrega_est, r.tarea_id]
    );
    return;
  }

  const { rows: [tarea] } = await q.query(
    `INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, created_by)
     VALUES ($1, $2, $3, $4, 'normal', 'entrega', $5)
     RETURNING id`,
    [r.cliente_id, r.operacion_id, descripcion, r.fecha_entrega_est, r.created_by]
  );
  await q.query(`UPDATE remitos SET tarea_id = $1 WHERE id = $2`, [tarea.id, remitoId]);
}

// Al entregar o cancelar el remito, la tarea espejo se marca completada —
// no se borra, queda de historial en la agenda.
export async function completarTareaDeEntrega(q: Queryable, remitoId: string): Promise<void> {
  await q.query(
    `UPDATE tareas SET completada = true, completada_at = now()
     WHERE id = (SELECT tarea_id FROM remitos WHERE id = $1)`,
    [remitoId]
  );
}
