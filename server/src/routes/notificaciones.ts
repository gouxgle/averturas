import { Hono } from 'hono';
import { db } from '../db.js';

const notificaciones = new Hono();

// GET /notificaciones — aprobaciones online + respuestas del cliente (presupuestos),
// recepciones con problemas (remitos) y oportunidades futuras que llegaron a su fecha,
// todo no leído, ordenado por fecha del evento.
notificaciones.get('/', async (c) => {
  const { rows } = await db.query(`
    SELECT 'presupuesto' AS tipo, o.id, o.numero, o.aprobado_online_at, o.respuesta_cliente,
      o.precio_total, GREATEST(o.aprobado_online_at, o.respuesta_cliente_at) AS evento_at,
      NULL::text AS recepcion_estado, NULL::text AS recepcion_obs, NULL::text AS detalle,
      json_build_object(
        'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona
      ) AS cliente
    FROM operaciones o
    JOIN clientes cl ON cl.id = o.cliente_id
    WHERE (o.aprobado_online_at IS NOT NULL OR o.respuesta_cliente_at IS NOT NULL)
      AND o.notif_leida = false

    UNION ALL

    SELECT 'remito' AS tipo, r.id, r.numero, NULL::timestamptz, NULL::text,
      NULL::numeric, r.recepcion_at AS evento_at,
      r.recepcion_estado, r.recepcion_obs, NULL::text AS detalle,
      json_build_object(
        'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona
      ) AS cliente
    FROM remitos r
    JOIN clientes cl ON cl.id = r.cliente_id
    WHERE r.recepcion_estado IN ('con_observaciones', 'no_conforme')
      AND r.notif_leida = false

    UNION ALL

    SELECT 'oportunidad' AS tipo, op.id, NULL::text AS numero, NULL::timestamptz, NULL::text,
      NULL::numeric, (op.fecha_recontacto + TIME '09:00')::timestamptz AS evento_at,
      NULL::text AS recepcion_estado, NULL::text AS recepcion_obs, op.motivo AS detalle,
      json_build_object(
        'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona
      ) AS cliente
    FROM oportunidades op
    JOIN clientes cl ON cl.id = op.cliente_id
    WHERE op.estado = 'pendiente'
      AND op.fecha_recontacto <= CURRENT_DATE
      AND op.notif_leida = false

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
  await db.query(
    `UPDATE remitos SET notif_leida = true
     WHERE recepcion_estado IN ('con_observaciones', 'no_conforme') AND notif_leida = false`
  );
  await db.query(
    `UPDATE oportunidades SET notif_leida = true
     WHERE estado = 'pendiente' AND fecha_recontacto <= CURRENT_DATE AND notif_leida = false`
  );
  return c.json({ ok: true });
});

export default notificaciones;
