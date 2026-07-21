import { Hono } from 'hono';
import { db } from '../db.js';

const notificaciones = new Hono();

// GET /notificaciones — aprobaciones online + respuestas del cliente no leídas
notificaciones.get('/', async (c) => {
  const { rows } = await db.query(`
    SELECT o.id, o.numero, o.aprobado_online_at, o.respuesta_cliente, o.respuesta_cliente_at, o.precio_total,
      GREATEST(o.aprobado_online_at, o.respuesta_cliente_at) AS evento_at,
      json_build_object(
        'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona
      ) AS cliente
    FROM operaciones o
    JOIN clientes cl ON cl.id = o.cliente_id
    WHERE (o.aprobado_online_at IS NOT NULL OR o.respuesta_cliente_at IS NOT NULL)
      AND o.notif_leida = false
    ORDER BY evento_at DESC
    LIMIT 50
  `);
  return c.json(rows);
});

// PATCH /notificaciones/marcar-leidas — marca todas como leídas
notificaciones.patch('/marcar-leidas', async (c) => {
  await db.query(
    `UPDATE operaciones SET notif_leida = true
     WHERE (aprobado_online_at IS NOT NULL OR respuesta_cliente_at IS NOT NULL) AND notif_leida = false`
  );
  return c.json({ ok: true });
});

export default notificaciones;
