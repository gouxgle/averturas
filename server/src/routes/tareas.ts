import { Hono } from 'hono';
import { db } from '../db.js';
import { sincronizarDesdeTarea } from '../lib/oportunidades.js';

const tareas = new Hono();

tareas.get('/', async (c) => {
  const cliente_id = c.req.query('cliente_id');
  const solo_pendientes = c.req.query('pendientes') !== 'false';

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (cliente_id) {
    params.push(cliente_id);
    where += ` AND t.cliente_id = $${params.length}`;
  }
  if (solo_pendientes) {
    where += ` AND t.completada = false`;
  }

  const { rows } = await db.query(`
    SELECT t.*,
      json_build_object('id', c.id, 'nombre', c.nombre, 'apellido', c.apellido, 'razon_social', c.razon_social)
        AS cliente
    FROM tareas t
    JOIN clientes c ON c.id = t.cliente_id
    ${where}
    ORDER BY
      CASE WHEN t.vencimiento IS NULL THEN 1 ELSE 0 END,
      t.vencimiento ASC,
      CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END
    LIMIT 100
  `, params);

  return c.json(rows);
});

// GET /agenda — atrasadas / hoy / próximos 3 días, agrupado (registrar ANTES de /:id-like)
tareas.get('/agenda', async (c) => {
  const CAMPOS = `
    t.id, t.descripcion, t.tipo_accion, t.hora::text, t.prioridad,
    t.vencimiento, t.operacion_id, t.cliente_id,
    c.nombre, c.apellido, c.razon_social, c.tipo_persona, c.telefono
  `;
  const [{ rows: vencidas }, { rows: hoy }, { rows: proximos }] = await Promise.all([
    db.query(`
      SELECT ${CAMPOS} FROM tareas t JOIN clientes c ON c.id = t.cliente_id
      WHERE t.completada = false AND t.vencimiento < CURRENT_DATE
      ORDER BY t.vencimiento ASC LIMIT 50
    `),
    db.query(`
      SELECT ${CAMPOS} FROM tareas t JOIN clientes c ON c.id = t.cliente_id
      WHERE t.completada = false AND t.vencimiento = CURRENT_DATE
      ORDER BY t.hora ASC NULLS LAST, t.prioridad = 'alta' DESC LIMIT 50
    `),
    db.query(`
      SELECT ${CAMPOS} FROM tareas t JOIN clientes c ON c.id = t.cliente_id
      WHERE t.completada = false AND t.vencimiento > CURRENT_DATE AND t.vencimiento <= CURRENT_DATE + 3
      ORDER BY t.vencimiento ASC, t.hora ASC NULLS LAST LIMIT 50
    `),
  ]);
  return c.json({ vencidas, hoy, proximos });
});

tareas.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.cliente_id || !body.descripcion?.trim()) {
    return c.json({ error: 'cliente_id y descripcion son requeridos' }, 400);
  }

  const { rows: [row] } = await db.query(`
    INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, hora, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    body.cliente_id,
    body.operacion_id || null,
    body.descripcion.trim(),
    body.vencimiento || null,
    body.prioridad || 'normal',
    body.tipo_accion || 'nota',
    body.hora || null,
    user.id,
  ]);

  return c.json(row, 201);
});

tareas.patch('/:id/completar', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ completada: boolean }>();

  const { rows: [row] } = await db.query(`
    UPDATE tareas SET
      completada    = $1,
      completada_at = CASE WHEN $1 THEN now() ELSE NULL END
    WHERE id = $2 RETURNING *
  `, [body.completada, id]);

  if (!row) return c.json({ error: 'Tarea no encontrada' }, 404);

  // Completar la tarea de seguimiento cierra también el badge de "respuesta pendiente" de la operación
  if (body.completada && row.operacion_id) {
    db.query(
      `UPDATE operaciones SET respuesta_cliente = NULL, respuesta_cliente_at = NULL
       WHERE id = $1 AND respuesta_cliente IS NOT NULL`,
      [row.operacion_id]
    ).catch(err => console.error('[tareas] Error al limpiar respuesta_cliente:', err));
  }

  if (row.tipo_accion === 'oportunidad') {
    sincronizarDesdeTarea(db, row.id, body.completada)
      .catch(err => console.error('[oportunidades] sync desde tarea:', err));
  }

  return c.json(row);
});

tareas.delete('/:id', async (c) => {
  const { id } = c.req.param();
  await db.query('DELETE FROM tareas WHERE id = $1', [id]);
  return c.json({ ok: true });
});

export default tareas;
