import { Hono } from 'hono';
import { db } from '../db.js';

const comentarios = new Hono();

const WITH_AUTOR = `
  SELECT cb.*,
    creador.nombre AS created_by_nombre,
    resolutor.nombre AS resuelto_by_nombre
  FROM comentarios_buzon cb
  LEFT JOIN usuarios creador   ON creador.id   = cb.created_by
  LEFT JOIN usuarios resolutor ON resolutor.id = cb.resuelto_by
`;

// GET / — todos, pendientes primero (por fecha desc), resueltos al final
comentarios.get('/', async (c) => {
  const { rows } = await db.query(
    `${WITH_AUTOR} ORDER BY cb.resuelto ASC, cb.created_at DESC LIMIT 200`
  );
  return c.json(rows);
});

comentarios.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  if (!body.texto?.trim()) return c.json({ error: 'texto es requerido' }, 400);

  const { rows: [row] } = await db.query(
    `INSERT INTO comentarios_buzon (texto, created_by) VALUES ($1, $2) RETURNING *`,
    [body.texto.trim(), user?.id ?? null]
  );
  return c.json(row, 201);
});

comentarios.patch('/:id/resolver', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const body = await c.req.json<{ resuelto: boolean }>();

  const { rows: [row] } = await db.query(`
    UPDATE comentarios_buzon SET
      resuelto    = $1,
      resuelto_at = CASE WHEN $1 THEN now() ELSE NULL END,
      resuelto_by = CASE WHEN $1 THEN $2::uuid ELSE NULL END
    WHERE id = $3 RETURNING *
  `, [body.resuelto, user?.id ?? null, id]);

  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json(row);
});

comentarios.delete('/:id', async (c) => {
  const { id } = c.req.param();
  await db.query('DELETE FROM comentarios_buzon WHERE id = $1', [id]);
  return c.json({ ok: true });
});

export default comentarios;
