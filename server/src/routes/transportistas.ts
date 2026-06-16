import { Hono } from 'hono';
import { db } from '../db.js';

const transportistas = new Hono();

// GET / — lista activos ordenados por nombre
transportistas.get('/', async (c) => {
  const { rows } = await db.query(
    `SELECT id, nombre, activo FROM transportistas WHERE activo = true ORDER BY nombre ASC`
  );
  return c.json(rows);
});

// POST / — crear nuevo transportista
transportistas.post('/', async (c) => {
  const body = await c.req.json();
  const nombre = String(body.nombre ?? '').trim();
  if (!nombre) return c.json({ error: 'nombre requerido' }, 400);
  if (nombre.length > 200) return c.json({ error: 'nombre demasiado largo' }, 400);

  const { rows: [t] } = await db.query(
    `INSERT INTO transportistas (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET activo = true RETURNING id, nombre, activo`,
    [nombre]
  );
  return c.json(t, 201);
});

// PATCH /:id — desactivar/activar
transportistas.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { rows: [t] } = await db.query(
    `UPDATE transportistas SET activo = $1 WHERE id = $2 RETURNING id, nombre, activo`,
    [body.activo ?? false, id]
  );
  if (!t) return c.json({ error: 'no encontrado' }, 404);
  return c.json(t);
});

export default transportistas;
