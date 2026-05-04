import { Hono } from 'hono';
import { db } from '../db.js';

const pub = new Hono();

// GET /pub/presupuesto/:token — datos públicos del presupuesto
pub.get('/presupuesto/:token', async (c) => {
  const { token } = c.req.param();

  const { rows: [op] } = await db.query(`
    SELECT
      o.id, o.numero, o.estado, o.tipo, o.forma_pago, o.forma_envio,
      o.costo_envio, o.tiempo_entrega, o.fecha_validez, o.notas,
      o.precio_total, o.aprobado_online_at, o.token_acceso_at,
      json_build_object(
        'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona,
        'direccion', cl.direccion, 'localidad', cl.localidad
      ) AS cliente,
      json_build_object(
        'nombre', e.nombre, 'cuit', e.cuit, 'telefono', e.telefono,
        'email', e.email, 'direccion', e.direccion, 'logo_url', e.logo_url
      ) AS empresa
    FROM operaciones o
    JOIN clientes cl ON cl.id = o.cliente_id
    CROSS JOIN (SELECT * FROM empresa LIMIT 1) e
    WHERE o.token_acceso = $1
  `, [token]);

  if (!op) return c.json({ error: 'Link inválido o expirado' }, 404);

  const { rows: items } = await db.query(`
    SELECT
      oi.descripcion, oi.cantidad, oi.precio_unitario,
      oi.precio_instalacion, oi.incluye_instalacion, oi.color,
      oi.medida_ancho, oi.medida_alto,
      ta.nombre AS tipo_abertura_nombre,
      si.nombre AS sistema_nombre,
      (oi.precio_unitario * oi.cantidad
        + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion * oi.cantidad ELSE 0 END
      ) AS precio_total
    FROM operacion_items oi
    LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
    LEFT JOIN sistemas        si ON si.id = oi.sistema_id
    WHERE oi.operacion_id = $1
    ORDER BY oi.orden, oi.id
  `, [op.id]);

  return c.json({ ...op, items });
});

// POST /pub/presupuesto/:token/aprobar — aprobación por el cliente
pub.post('/presupuesto/:token/aprobar', async (c) => {
  const { token } = c.req.param();

  const { rows: [op] } = await db.query(
    `SELECT id, estado FROM operaciones WHERE token_acceso = $1`,
    [token]
  );

  if (!op) return c.json({ error: 'Link inválido' }, 404);

  if (op.estado === 'aprobado') {
    return c.json({ ok: true, ya_aprobado: true });
  }

  if (!['presupuesto', 'enviado'].includes(op.estado)) {
    return c.json({ error: `No se puede aprobar un presupuesto en estado "${op.estado}"` }, 400);
  }

  await db.query(
    `UPDATE operaciones
     SET estado = 'aprobado', aprobado_online_at = now(), notif_leida = false, updated_at = now()
     WHERE id = $1`,
    [op.id]
  );

  return c.json({ ok: true, ya_aprobado: false });
});

export default pub;
