import { db } from '../db.js';

type Queryable = { query: typeof db.query };

const PRIORIDAD_POR_INTERES: Record<string, 'alta' | 'normal' | 'baja'> = {
  alto: 'alta', medio: 'normal', bajo: 'baja',
};

// La oportunidad es la fuente de verdad; la tarea es su proyección en la
// agenda del CRM (Tareas y seguimientos / Agenda de contactos), que ya
// filtran por vencimiento sin necesitar ningún cron. Idempotente: si la
// tarea fue borrada a mano (tarea_id quedó NULL por el FK ON DELETE SET
// NULL), la regenera en vez de fallar.
export async function sincronizarTarea(q: Queryable, oportunidadId: string): Promise<void> {
  const { rows: [op] } = await q.query(
    `SELECT id, cliente_id, operacion_id_origen, tarea_id, motivo, fecha_recontacto, interes, created_by
     FROM oportunidades WHERE id = $1`,
    [oportunidadId]
  );
  if (!op) return;

  const descripcion = `Recontactar — ${op.motivo}`;
  const prioridad = PRIORIDAD_POR_INTERES[op.interes] ?? 'normal';

  if (op.tarea_id) {
    await q.query(
      `UPDATE tareas SET
         descripcion = $1, vencimiento = $2, prioridad = $3,
         completada = false, completada_at = NULL
       WHERE id = $4`,
      [descripcion, op.fecha_recontacto, prioridad, op.tarea_id]
    );
    return;
  }

  const { rows: [tarea] } = await q.query(
    `INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, created_by)
     VALUES ($1, $2, $3, $4, $5, 'oportunidad', $6)
     RETURNING id`,
    [op.cliente_id, op.operacion_id_origen, descripcion, op.fecha_recontacto, prioridad, op.created_by]
  );
  await q.query(`UPDATE oportunidades SET tarea_id = $1 WHERE id = $2`, [tarea.id, oportunidadId]);
}

// Al cerrar la oportunidad (convertida/descartada) la tarea espejo se marca
// completada — pero NO se borra, queda como historial de la agenda.
export async function completarTareaDeOportunidad(q: Queryable, oportunidadId: string): Promise<void> {
  await q.query(
    `UPDATE tareas SET completada = true, completada_at = now()
     WHERE id = (SELECT tarea_id FROM oportunidades WHERE id = $1)`,
    [oportunidadId]
  );
}

// Reverso: alguien completó/descompletó desde la agenda del CRM (no desde el
// panel de oportunidades). Ninguna decisión de negocio se toma leyendo
// tareas — esto solo mantiene el estado de la oportunidad coherente.
export async function sincronizarDesdeTarea(q: Queryable, tareaId: string, completada: boolean): Promise<void> {
  const { rows: [op] } = await q.query(
    `SELECT id, estado FROM oportunidades WHERE tarea_id = $1`, [tareaId]
  );
  if (!op) return;

  if (completada && op.estado === 'pendiente') {
    await q.query(
      `UPDATE oportunidades SET estado = 'contactada', ultimo_contacto_at = now() WHERE id = $1`,
      [op.id]
    );
  } else if (!completada && op.estado === 'contactada') {
    await q.query(`UPDATE oportunidades SET estado = 'pendiente' WHERE id = $1`, [op.id]);
  }
}
