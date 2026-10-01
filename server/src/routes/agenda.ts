import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { RecordarSchema, ReprogramarSchema, TareaInternaSchema, RecotizacionSchema } from '../lib/schemas.js';
import { sincronizarTarea } from '../lib/oportunidades.js';
import { sincronizarTareaEntrega } from '../lib/remitos.js';
import { sincronizarTareaVisita, agendarRecotizacion } from '../lib/tareas.js';
import { hoyAR } from '../lib/fechas.js';

// Agenda del día: el aviso que ve cada operador al entrar y que vuelve a aparecer hasta que lo
// pendiente se resuelve. Es siempre una FOTO de lo pendiente al consultar (no hay proceso
// nocturno ni cola de avisos): abrir el sistema horas después muestra un solo aviso con todo,
// nunca uno por cada hora sin abrir. "Recordar" es por usuario (tarea_recordatorios);
// completar y reprogramar cambian la tarea para todos. Todos ven todas las tareas.

const agenda = new Hono();

type Q = { query: typeof db.query };

/** El rol consulta ve la agenda y puede posponer su propio aviso, pero no cambia tareas. */
async function puedeEditar(c: Context, next: Next) {
  if (c.get('user')?.rol === 'consulta') return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  await next();
}

// Datos de cada tarea para el aviso y la pantalla Agenda: cliente o proveedor con teléfono, y
// el origen (oportunidad, entrega, visita o proforma) para el botón "Ir".
const CAMPOS = `
  t.id, t.descripcion, t.tipo_accion, t.hora::text AS hora, t.prioridad, t.vencimiento::text AS vencimiento,
  t.ambito, t.categoria, t.notas, t.repetir, t.repetir_cada_dias, t.completada, t.completada_at,
  t.cliente_id, t.operacion_id, t.proveedor_id, t.created_at,
  c.nombre, c.apellido, c.razon_social, c.tipo_persona, c.telefono,
  p.nombre AS proveedor_nombre, p.telefono AS proveedor_telefono,
  o.numero AS operacion_numero, o.estado AS operacion_estado,
  op.id AS oportunidad_id, r.id AS remito_id, r.numero AS remito_numero, vt.id AS visita_id, vt.numero AS visita_numero,
  uc.nombre AS creada_por, uh.nombre AS completada_por`;
const JOINS = `
  LEFT JOIN clientes c        ON c.id = t.cliente_id
  LEFT JOIN proveedores p     ON p.id = t.proveedor_id
  LEFT JOIN operaciones o     ON o.id = t.operacion_id
  LEFT JOIN oportunidades op  ON op.tarea_id = t.id
  LEFT JOIN remitos r         ON r.tarea_id = t.id
  LEFT JOIN visitas_tecnicas vt ON vt.tarea_id = t.id
  LEFT JOIN usuarios uc       ON uc.id = t.created_by
  LEFT JOIN usuarios uh       ON uh.id = t.completada_by`;

// GET /hoy — pendientes de hoy y atrasadas, con el estado del aviso para este usuario.
// debe_mostrarse: nunca la vio, ya pasó la hora a la que pidió que se la recuerden, o faltan
// 15 minutos o menos para la hora de la tarea (y no la vio desde entonces). Cada tarea viene
// una sola vez aunque se hayan vencido varios recordatorios: la clave es la tarea, no el aviso.
agenda.get('/hoy', async (c) => {
  const { rows } = await db.query(`
    SELECT ${CAMPOS},
      tr.mostrar_desde,
      (t.vencimiento < CURRENT_DATE) AS atrasada,
      ( tr.tarea_id IS NULL
        OR tr.mostrar_desde <= now()
        OR ( t.vencimiento = CURRENT_DATE AND t.hora IS NOT NULL
             AND now() >= (CURRENT_DATE + t.hora) - interval '15 minutes'
             AND tr.visto_at < (CURRENT_DATE + t.hora) - interval '15 minutes')
      ) AS debe_mostrarse
    FROM tareas t ${JOINS}
    LEFT JOIN tarea_recordatorios tr ON tr.tarea_id = t.id AND tr.usuario_id = $1
    WHERE NOT t.completada AND t.vencimiento <= CURRENT_DATE
    ORDER BY t.vencimiento, t.hora NULLS LAST, CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.created_at
    LIMIT 300`, [c.get('user').id]);
  return c.json({ hoy: hoyAR(), tareas: rows });
});

// GET /tareas?vista=proximas|internas|hechas[&categoria=] — listas de la pantalla Agenda
agenda.get('/tareas', async (c) => {
  const vista = c.req.query('vista') ?? 'proximas';
  const categoria = c.req.query('categoria');
  const params: unknown[] = [];
  let where: string;
  let orden = `t.vencimiento NULLS LAST, t.hora NULLS LAST, t.created_at`;
  if (vista === 'hechas') {
    where = 't.completada';
    orden = 't.completada_at DESC NULLS LAST';
  } else if (vista === 'internas') {
    where = `NOT t.completada AND t.ambito = 'interna'`;
  } else {
    where = 'NOT t.completada AND (t.vencimiento > CURRENT_DATE OR t.vencimiento IS NULL)';
  }
  if (categoria) { params.push(categoria); where += ` AND t.categoria = $${params.length}`; }
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM tareas t ${JOINS} WHERE ${where} ORDER BY ${orden} LIMIT ${vista === 'hechas' ? 150 : 300}`, params);
  return c.json(rows);
});

// POST /recordar — "Leído" (1 h), "Recordar en X" o "a las HH:MM" (si ya pasó, mañana).
// Idempotente: repetirlo solo corre la hora. Con respetar_posterior (cerrar el aviso) no
// adelanta una tarea que el usuario ya había pospuesto para más tarde.
agenda.post('/recordar', async (c) => {
  const b = await validateBody(c, RecordarSchema);
  if (b instanceof Response) return b;
  const cuando = b.a_las
    ? `CASE WHEN CURRENT_DATE + $3::time > now() THEN CURRENT_DATE + $3::time ELSE CURRENT_DATE + 1 + $3::time END`
    : `now() + make_interval(mins => $3::int)`;
  const { rows } = await db.query(`
    INSERT INTO tarea_recordatorios (tarea_id, usuario_id, mostrar_desde, visto_at)
    SELECT t.id, $2, ${cuando}, now() FROM tareas t WHERE t.id = ANY($1::uuid[]) AND NOT t.completada
    ON CONFLICT (tarea_id, usuario_id) DO UPDATE
      SET mostrar_desde = EXCLUDED.mostrar_desde, visto_at = now()
      WHERE NOT $4 OR tarea_recordatorios.mostrar_desde <= EXCLUDED.mostrar_desde
    RETURNING tarea_id, mostrar_desde`,
    [b.tarea_ids, c.get('user').id, b.a_las ?? (b.en_minutos ?? 60), b.respetar_posterior ?? false]);
  return c.json({ ok: true, recordatorios: rows });
});

/**
 * Cambia la fecha (y la hora si viene) de una tarea. Si es espejo de una oportunidad, una
 * entrega o una visita, mueve el origen con la misma lógica que su pantalla y la tarea se
 * resincroniza desde ahí. Borra los recordatorios: el día nuevo vuelve a avisar.
 */
async function reprogramarTarea(q: Q, id: string, fecha: string, hora: string | null | undefined, usuarioId: string): Promise<string | null> {
  const { rows: [t] } = await q.query(`
    SELECT t.id, t.completada, t.cliente_id, op.id AS oportunidad_id, r.id AS remito_id, r.estado AS remito_estado, vt.id AS visita_id
      FROM tareas t
      LEFT JOIN oportunidades op ON op.tarea_id = t.id
      LEFT JOIN remitos r ON r.tarea_id = t.id
      LEFT JOIN visitas_tecnicas vt ON vt.tarea_id = t.id
     WHERE t.id = $1 FOR UPDATE OF t`, [id]);
  if (!t) return 'La tarea ya no existe';
  if (t.completada) return 'La tarea ya está hecha';

  if (t.oportunidad_id) {
    await q.query(`
      UPDATE oportunidades SET fecha_recontacto = $1::date, estado = 'pendiente', veces_pospuesta = veces_pospuesta + 1,
             notif_leida = false, updated_at = now()
       WHERE id = $2`, [fecha, t.oportunidad_id]);
    await sincronizarTarea(q, t.oportunidad_id);
    await q.query(`INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by) VALUES ($1, 'nota', $2, $3)`,
      [t.cliente_id, `Oportunidad pospuesta al ${fecha} desde la agenda`, usuarioId]);
  } else if (t.remito_id) {
    if (!['borrador', 'emitido'].includes(t.remito_estado)) return 'La entrega ya no se puede reprogramar';
    await q.query(`
      UPDATE remitos SET fecha_entrega_est = $1::date,
             hora_entrega_est = CASE WHEN $2 THEN $3::time ELSE hora_entrega_est END,
             recordatorio_dia_antes_visto = false, recordatorio_hora_antes_visto = false, updated_at = now()
       WHERE id = $4`, [fecha, hora !== undefined, hora ?? null, t.remito_id]);
    await sincronizarTareaEntrega(q, t.remito_id);
  } else if (t.visita_id) {
    await q.query(`UPDATE visitas_tecnicas SET fecha_visita = $1::date, updated_at = now() WHERE id = $2`, [fecha, t.visita_id]);
    await sincronizarTareaVisita(q, t.visita_id);
  }

  await q.query(`
    UPDATE tareas SET vencimiento = $2::date,
           hora = CASE WHEN $3 THEN $4::time ELSE hora END,
           completada = false, completada_at = NULL
     WHERE id = $1`, [id, fecha, hora !== undefined, hora ?? null]);
  await q.query('DELETE FROM tarea_recordatorios WHERE tarea_id = $1', [id]);
  return null;
}

// PATCH /reprogramar — una o varias ("Pasar todas a hoy"). Todo o nada.
agenda.patch('/reprogramar', puedeEditar, async (c) => {
  const b = await validateBody(c, ReprogramarSchema);
  if (b instanceof Response) return b;
  if (b.fecha < hoyAR()) return c.json({ error: 'La fecha nueva no puede ser anterior a hoy' }, 400);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const id of b.tarea_ids) {
      const error = await reprogramarTarea(client, id, b.fecha, b.hora, c.get('user').id);
      if (error) { await client.query('ROLLBACK'); return c.json({ error }, 409); }
    }
    await client.query('COMMIT');
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── Tareas internas de la empresa ───────────────────────────────

function datosInterna(b: ReturnType<typeof TareaInternaSchema.parse>) {
  const repetir = b.repetir ?? null;
  return [
    b.descripcion, b.vencimiento, b.hora || null, b.prioridad, b.categoria, b.proveedor_id || null, b.notas?.trim() || null,
    repetir, repetir === 'dias' ? b.repetir_cada_dias : null,
    repetir === 'mensual' ? Number(b.vencimiento.slice(8, 10)) : null,
  ];
}

agenda.post('/tareas', puedeEditar, async (c) => {
  const b = await validateBody(c, TareaInternaSchema);
  if (b instanceof Response) return b;
  const { rows: [row] } = await db.query(`
    INSERT INTO tareas (descripcion, vencimiento, hora, prioridad, categoria, proveedor_id, notas,
                        repetir, repetir_cada_dias, repetir_dia_mes, ambito, tipo_accion, created_by)
    VALUES ($1, $2::date, $3::time, $4, $5, $6, $7, $8, $9, $10, 'interna', 'nota', $11)
    RETURNING id`, [...datosInterna(b), c.get('user').id]);
  return c.json(row, 201);
});

agenda.put('/tareas/:id', puedeEditar, async (c) => {
  const b = await validateBody(c, TareaInternaSchema);
  if (b instanceof Response) return b;
  const { rows: [row] } = await db.query(`
    UPDATE tareas SET descripcion = $1, vencimiento = $2::date, hora = $3::time, prioridad = $4, categoria = $5,
           proveedor_id = $6, notas = $7, repetir = $8, repetir_cada_dias = $9, repetir_dia_mes = $10
     WHERE id = $11 AND ambito = 'interna'
    RETURNING id`, [...datosInterna(b), c.req.param('id')]);
  if (!row) return c.json({ error: 'Tarea interna no encontrada' }, 404);
  // Cambió la fecha o la hora: que vuelva a avisar
  await db.query('DELETE FROM tarea_recordatorios WHERE tarea_id = $1', [row.id]);
  return c.json({ id: row.id });
});

agenda.delete('/tareas/:id', puedeEditar, async (c) => {
  const { rowCount } = await db.query(`DELETE FROM tareas WHERE id = $1 AND ambito = 'interna'`, [c.req.param('id')]);
  if (!rowCount) return c.json({ error: 'Tarea interna no encontrada' }, 404);
  return c.json({ ok: true });
});

// ── Recotizar (revisar y adecuar una proforma) ──────────────────

agenda.get('/recotizar/:operacionId', async (c) => {
  const { rows: [row] } = await db.query(`
    SELECT ${CAMPOS} FROM tareas t ${JOINS}
     WHERE t.operacion_id = $1 AND t.tipo_accion = 'recotizar' AND NOT t.completada`, [c.req.param('operacionId')]);
  return c.json(row ?? null);
});

agenda.post('/recotizar', puedeEditar, async (c) => {
  const b = await validateBody(c, RecotizacionSchema);
  if (b instanceof Response) return b;
  if (b.fecha < hoyAR()) return c.json({ error: 'La fecha no puede ser anterior a hoy' }, 400);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = await agendarRecotizacion(client, {
      operacionId: b.operacion_id, fecha: b.fecha, hora: b.hora ?? null, nota: b.nota ?? null, usuarioId: c.get('user').id,
    });
    if (!r) { await client.query('ROLLBACK'); return c.json({ error: 'Proforma no encontrada' }, 404); }
    await client.query('COMMIT');
    return c.json(r, r.creada ? 201 : 200);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default agenda;
