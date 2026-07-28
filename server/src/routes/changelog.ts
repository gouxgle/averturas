import { Hono } from 'hono';
import { db } from '../db.js';

const changelog = new Hono();

function requireAdmin(rol: string) {
  return rol === 'admin';
}

// GET / — listado cronológico (más reciente primero)
changelog.get('/', async (c) => {
  const { rows } = await db.query(
    `SELECT * FROM changelog_cambios ORDER BY fecha DESC, created_at DESC LIMIT 200`
  );
  return c.json(rows);
});

changelog.post('/', async (c) => {
  const user = c.get('user');
  if (!requireAdmin(user.rol)) return c.json({ error: 'Sin permisos' }, 403);

  const body = await c.req.json();
  if (!body.titulo?.trim()) return c.json({ error: 'titulo es requerido' }, 400);

  const { rows: [row] } = await db.query(
    `INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria)
     VALUES (COALESCE($1, CURRENT_DATE), $2, $3, $4) RETURNING *`,
    [body.fecha || null, body.titulo.trim(), body.descripcion?.trim() || null, body.categoria || 'mejora']
  );
  return c.json(row, 201);
});

export default changelog;
