import { Hono } from 'hono';
import { db } from '../db.js';

const configuracion = new Hono();

// GET /configuracion/mensajes — lista todas las plantillas
configuracion.get('/mensajes', async (c) => {
  const { rows } = await db.query(
    `SELECT clave, titulo, contenido, variables FROM mensajes_plantilla ORDER BY clave`
  );
  return c.json(rows);
});

// PUT /configuracion/mensajes/:clave — actualiza contenido de una plantilla
configuracion.put('/mensajes/:clave', async (c) => {
  const { clave } = c.req.param();
  const body = await c.req.json() as { contenido: string };
  if (!body.contenido?.trim()) return c.json({ error: 'contenido requerido' }, 422);

  const { rowCount } = await db.query(
    `UPDATE mensajes_plantilla SET contenido = $1 WHERE clave = $2`,
    [body.contenido.trim(), clave]
  );
  if (!rowCount) return c.json({ error: 'Plantilla no encontrada' }, 404);
  return c.json({ ok: true });
});

export default configuracion;
