import { Hono } from 'hono';
import { db } from '../db.js';

const interacciones = new Hono();

interacciones.post('/', async (c) => {
  const user = c.get('user');
  const { cliente_id, tipo, descripcion } = await c.req.json<{
    cliente_id: string;
    tipo?: string;
    descripcion: string;
  }>();

  if (!cliente_id || !descripcion?.trim()) {
    return c.json({ error: 'cliente_id y descripcion son requeridos' }, 400);
  }

  const { rows: [row] } = await db.query(`
    INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [cliente_id, tipo ?? 'nota', descripcion.trim(), user.id]);

  // Actualizar ultima_interaccion del cliente
  await db.query(`
    UPDATE clientes SET ultima_interaccion = now() WHERE id = $1
  `, [cliente_id]);

  return c.json(row, 201);
});

export default interacciones;
