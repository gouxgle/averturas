import { db } from '../db.js';

// Garantías y servicios técnicos (Post venta). La ficha (servicios_tecnicos) es la fuente de verdad: su visita
// programada se refleja en la agenda como tarea espejo tipo 'servicio', igual que las visitas de relevamiento.

type Queryable = { query: typeof db.query };

export const ESTADOS_SERVICIO = [
  'pendiente_coordinar', 'visita_programada', 'en_proceso', 'pendiente_repuesto', 'finalizado', 'cancelado',
] as const;
export type EstadoServicio = typeof ESTADOS_SERVICIO[number];

export const TIPO_SERVICIO_LABEL: Record<string, string> = {
  garantia: 'Garantía', reparacion: 'Reparación con cargo', mantenimiento: 'Mantenimiento',
};

/**
 * Tarea espejo de la visita del servicio: programada con fecha → tarea en la agenda (con el responsable en la
 * descripción); en proceso, finalizado o cancelado → la tarea queda completada como historial; sin fecha (vuelve a
 * "pendiente de coordinar") → se quita de la agenda. Mover la fecha reabre la tarea; guardar sin moverla no deshace
 * un "Hecho" marcado desde la agenda.
 */
export async function sincronizarTareaServicio(q: Queryable, servicioId: string): Promise<void> {
  const { rows: [s] } = await q.query(`
    SELECT s.id, s.numero, s.tipo, s.estado, s.cliente_id, s.operacion_id, s.tarea_id, s.producto_descripcion,
           s.fecha_visita::text AS fecha, s.hora_visita::text AS hora, s.created_by,
           COALESCE(u.nombre, s.responsable_nombre) AS responsable
      FROM servicios_tecnicos s LEFT JOIN usuarios u ON u.id = s.responsable_id
     WHERE s.id = $1`, [servicioId]);
  if (!s) return;

  if (s.estado !== 'visita_programada' || !s.fecha) {
    if (!s.tarea_id) return;
    // Volvió a "por coordinar" sin que la visita se hiciera → se quita; cualquier otro estado → la visita queda hecha
    if (s.estado !== 'pendiente_coordinar') {
      await q.query(`UPDATE tareas SET completada = true, completada_at = COALESCE(completada_at, now()) WHERE id = $1`, [s.tarea_id]);
    } else {
      await q.query('DELETE FROM tareas WHERE id = $1 AND NOT completada', [s.tarea_id]);
      await q.query('UPDATE servicios_tecnicos SET tarea_id = NULL WHERE id = $1 AND tarea_id = $2', [s.id, s.tarea_id]);
    }
    return;
  }

  const descripcion = [
    `Servicio técnico ${s.numero} (${TIPO_SERVICIO_LABEL[s.tipo] ?? s.tipo})`,
    s.producto_descripcion ? `· ${s.producto_descripcion}` : null,
    s.responsable ? `— ${s.responsable}` : null,
  ].filter(Boolean).join(' ');
  if (s.tarea_id) {
    const { rowCount } = await q.query(`
      UPDATE tareas SET
        descripcion = $1, vencimiento = $2::date, hora = $3::time,
        completada = CASE WHEN vencimiento IS DISTINCT FROM $2::date OR hora IS DISTINCT FROM $3::time THEN false ELSE completada END,
        completada_at = CASE WHEN vencimiento IS DISTINCT FROM $2::date OR hora IS DISTINCT FROM $3::time THEN NULL ELSE completada_at END
      WHERE id = $4`, [descripcion, s.fecha, s.hora, s.tarea_id]);
    if (rowCount) return;
  }
  const { rows: [t] } = await q.query(`
    INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, hora, prioridad, tipo_accion, created_by)
    VALUES ($1, $2, $3, $4::date, $5::time, 'normal', 'servicio', $6) RETURNING id`,
    [s.cliente_id, s.operacion_id, descripcion, s.fecha, s.hora, s.created_by]);
  await q.query('UPDATE servicios_tecnicos SET tarea_id = $1 WHERE id = $2', [t.id, s.id]);
}

/**
 * Completar (o reabrir) la visita desde la agenda: hecha → el servicio pasa a "en proceso" (el técnico ya fue y
 * falta cargar lo que hizo); reabierta sin intervenciones cargadas → vuelve a "visita programada".
 */
export async function sincronizarServicioDesdeTarea(q: Queryable, tareaId: string, completada: boolean): Promise<void> {
  if (completada) {
    await q.query(`UPDATE servicios_tecnicos SET estado = 'en_proceso', updated_at = now()
                    WHERE tarea_id = $1 AND estado = 'visita_programada'`, [tareaId]);
  } else {
    await q.query(`
      UPDATE servicios_tecnicos s SET estado = 'visita_programada', updated_at = now()
       WHERE s.tarea_id = $1 AND s.estado = 'en_proceso' AND s.fecha_visita IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM servicio_intervenciones i WHERE i.servicio_id = s.id)`, [tareaId]);
  }
}

/**
 * Productos que se le entregaron al cliente (líneas de remitos emitidos o entregados, sin servicios), con la
 * antigüedad para sugerir si está en garantía y cuántos servicios ya tuvo cada uno. A diferencia de devoluciones,
 * no filtra lo ya devuelto: un producto devuelto o cambiado también puede tener historial de reclamos.
 */
export async function productosEntregadosDelCliente(q: Queryable, clienteId: string, operacionId?: string | null) {
  const { rows } = await q.query(`
    SELECT ri.id AS remito_item_id, ri.descripcion, ri.cantidad, ri.producto_id, ri.operacion_item_id,
           r.id AS remito_id, r.numero AS remito_numero, r.estado AS remito_estado,
           COALESCE(r.fecha_entrega_real, r.fecha_emision)::text AS fecha_entrega,
           r.operacion_id, o.numero AS operacion_numero,
           (SELECT count(*)::int FROM servicios_tecnicos s
             WHERE s.remito_item_id = ri.id
                OR (ri.operacion_item_id IS NOT NULL AND s.operacion_item_id = ri.operacion_item_id)) AS servicios_previos
      FROM remito_items ri
      JOIN remitos r ON r.id = ri.remito_id
      LEFT JOIN operaciones o ON o.id = r.operacion_id
      LEFT JOIN operacion_items oi ON oi.id = ri.operacion_item_id
     WHERE r.cliente_id = $1 AND r.estado IN ('emitido', 'entregado')
       AND COALESCE(oi.tipo_item, '') <> 'servicio'
       AND ($2::uuid IS NULL OR r.operacion_id = $2)
     ORDER BY COALESCE(r.fecha_entrega_real, r.fecha_emision) DESC, r.numero, ri.descripcion
     LIMIT 200`, [clienteId, operacionId ?? null]);
  return rows;
}

/**
 * Al cerrar un servicio, se agenda volver a consultar al cliente a los días de post venta configurados
 * («¿quedó funcionando bien?»). Una sola consulta pendiente por servicio: si ya había una, se reemplaza.
 */
export async function programarRecontacto(q: Queryable, servicioId: string, usuarioId: string | null): Promise<void> {
  const { rows: [s] } = await q.query(`
    SELECT s.numero, s.cliente_id, s.operacion_id, s.recontacto_tarea_id, s.producto_descripcion,
           (SELECT COALESCE(postventa_dias, 3) FROM empresa ORDER BY updated_at DESC LIMIT 1) AS dias
      FROM servicios_tecnicos s WHERE s.id = $1`, [servicioId]);
  if (!s) return;
  if (s.recontacto_tarea_id) await q.query('DELETE FROM tareas WHERE id = $1 AND NOT completada', [s.recontacto_tarea_id]);
  const { rows: [t] } = await q.query(`
    INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, created_by)
    VALUES ($1, $2, $3, CURRENT_DATE + $4::int, 'normal', 'seguimiento', $5) RETURNING id, vencimiento::text AS v`,
    [s.cliente_id, s.operacion_id, `Consultar si quedó bien el servicio ${s.numero}${s.producto_descripcion ? ` (${s.producto_descripcion})` : ''}`,
     Number(s.dias ?? 3), usuarioId]);
  await q.query(`
    UPDATE servicios_tecnicos SET recontacto_fecha = $2::date, recontacto_tarea_id = $3, recontacto_resultado = NULL, recontacto_at = NULL
     WHERE id = $1`, [servicioId, t.v, t.id]);
}

/** Al reabrir un servicio, la consulta posterior que todavía no se hizo deja de tener sentido. */
export async function anularRecontacto(q: Queryable, servicioId: string): Promise<void> {
  const { rows: [s] } = await q.query(`SELECT recontacto_tarea_id FROM servicios_tecnicos WHERE id = $1`, [servicioId]);
  if (s?.recontacto_tarea_id) await q.query('DELETE FROM tareas WHERE id = $1 AND NOT completada', [s.recontacto_tarea_id]);
  await q.query(`UPDATE servicios_tecnicos SET recontacto_fecha = NULL, recontacto_tarea_id = NULL WHERE id = $1 AND recontacto_resultado IS NULL`, [servicioId]);
}
