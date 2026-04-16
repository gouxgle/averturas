import { Hono } from 'hono';
import { db } from '../db.js';

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

tareas.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.cliente_id || !body.descripcion?.trim()) {
    return c.json({ error: 'cliente_id y descripcion son requeridos' }, 400);
  }

  const { rows: [row] } = await db.query(`
    INSERT INTO tareas (cliente_id, descripcion, vencimiento, prioridad, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    body.cliente_id,
    body.descripcion.trim(),
    body.vencimiento || null,
    body.prioridad || 'normal',
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
  return c.json(row);
});

tareas.delete('/:id', async (c) => {
  const { id } = c.req.param();
  await db.query('DELETE FROM tareas WHERE id = $1', [id]);
  return c.json({ ok: true });
});

export default tareas;
