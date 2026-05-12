import { Hono } from 'hono';
import { db } from '../db.js';
import {
  sendProformaAceptada, sendProformaRechazada,
  sendEmpresaAceptacion, sendEmpresaRechazo,
} from '../email.js';

const pub = new Hono();

// Trae datos completos para emails (cliente + empresa)
async function fetchCtxEmail(operacionId: string) {
  const { rows: [row] } = await db.query(`
    SELECT
      o.numero, o.precio_total,
      cl.nombre AS cliente_nombre, cl.apellido AS cliente_apellido,
      cl.razon_social, cl.tipo_persona, cl.email AS cliente_email,
      e.nombre   AS empresa_nombre,
      e.telefono AS empresa_telefono,
      e.email    AS empresa_email
    FROM operaciones o
    JOIN clientes cl ON cl.id = o.cliente_id
    CROSS JOIN (SELECT * FROM empresa LIMIT 1) e
    WHERE o.id = $1
  `, [operacionId]);
  return row ?? null;
}

// GET /pub/presupuesto/:token — datos públicos del presupuesto
pub.get('/presupuesto/:token', async (c) => {
  const { token } = c.req.param();

  const { rows: [op] } = await db.query(`
    SELECT
      o.id, o.numero, o.estado, o.tipo, o.forma_pago, o.forma_envio,
      o.costo_envio, o.tiempo_entrega, o.fecha_validez, o.notas,
      o.precio_total, o.aprobado_online_at, o.token_acceso_at, o.created_at,
      json_build_object(
        'nombre',        cl.nombre,
        'apellido',      cl.apellido,
        'razon_social',  cl.razon_social,
        'tipo_persona',  cl.tipo_persona,
        'documento_nro', cl.documento_nro,
        'telefono',      cl.telefono,
        'email',         cl.email,
        'direccion',     cl.direccion,
        'localidad',     cl.localidad
      ) AS cliente,
      json_build_object(
        'nombre',       e.nombre,
        'cuit',         e.cuit,
        'telefono',     e.telefono,
        'email',        e.email,
        'direccion',    e.direccion,
        'logo_url',     e.logo_url,
        'instagram',    e.instagram,
        'terminos_url', e.terminos_url
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
      cp.imagen_url AS producto_imagen_url,
      (oi.precio_unitario * oi.cantidad
        + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion * oi.cantidad ELSE 0 END
      ) AS precio_total
    FROM operacion_items oi
    LEFT JOIN tipos_abertura    ta ON ta.id = oi.tipo_abertura_id
    LEFT JOIN sistemas          si ON si.id = oi.sistema_id
    LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
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

  // Reserva de stock: un movimiento 'reserva' por cada item con producto_id
  db.query(`
    SELECT oi.producto_id, oi.cantidad
    FROM operacion_items oi
    WHERE oi.operacion_id = $1 AND oi.producto_id IS NOT NULL AND oi.cantidad > 0
  `, [op.id]).then(async ({ rows: items }) => {
    for (const item of items) {
      await db.query(`
        INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id)
        VALUES ($1, 'reserva', $2, 'Proforma aprobada', $3)
      `, [item.producto_id, -Math.abs(item.cantidad), op.id]);
    }
  }).catch(err => console.error('[stock] Error al crear reserva:', err));

  // Emails (fire and forget)
  fetchCtxEmail(op.id).then(ctx => {
    if (!ctx) return;
    const clienteNombre = ctx.tipo_persona === 'juridica'
      ? (ctx.razon_social ?? '')
      : [ctx.cliente_apellido, ctx.cliente_nombre].filter(Boolean).join(' ');
    const proformaNumero = (ctx.numero as string).replace(/^OP-/, 'PRO-');
    const total = Number(ctx.precio_total);

    if (ctx.cliente_email) {
      sendProformaAceptada({
        to: ctx.cliente_email, clienteNombre, proformaNumero, total,
        empresaNombre: ctx.empresa_nombre, empresaTelefono: ctx.empresa_telefono ?? null,
        empresaEmail:  ctx.empresa_email  ?? null, appUrl: process.env.APP_URL ?? '',
      }).catch(err => console.error('[email] cliente aceptada:', err));
    }

    if (ctx.empresa_email) {
      sendEmpresaAceptacion({
        to: ctx.empresa_email, clienteNombre, proformaNumero, total,
        empresaNombre: ctx.empresa_nombre,
      }).catch(err => console.error('[email] empresa aceptada:', err));
    }
  }).catch(() => {});

  return c.json({ ok: true, ya_aprobado: false });
});

// POST /pub/presupuesto/:token/rechazar — rechazo con motivo
pub.post('/presupuesto/:token/rechazar', async (c) => {
  const { token } = c.req.param();
  const { motivo, comentario } = await c.req.json().catch(() => ({})) as any;

  const { rows: [op] } = await db.query(
    `SELECT id, estado FROM operaciones WHERE token_acceso = $1`,
    [token]
  );

  if (!op) return c.json({ error: 'Link inválido' }, 404);

  if (op.estado === 'aprobado') {
    return c.json({ error: 'Este presupuesto ya fue aprobado y no puede rechazarse' }, 400);
  }

  if (op.estado === 'rechazado') {
    return c.json({ ok: true, ya_rechazado: true });
  }

  await db.query(
    `UPDATE operaciones
     SET estado = 'rechazado',
         motivo_rechazo     = $1,
         comentario_rechazo = $2,
         updated_at         = now()
     WHERE id = $3`,
    [motivo || null, comentario || null, op.id]
  );

  // Emails (fire and forget)
  fetchCtxEmail(op.id).then(ctx => {
    if (!ctx) return;
    const clienteNombre = ctx.tipo_persona === 'juridica'
      ? (ctx.razon_social ?? '')
      : [ctx.cliente_apellido, ctx.cliente_nombre].filter(Boolean).join(' ');
    const proformaNumero = (ctx.numero as string).replace(/^OP-/, 'PRO-');

    if (ctx.cliente_email) {
      sendProformaRechazada({
        to: ctx.cliente_email, clienteNombre, proformaNumero,
        motivo: motivo || null, comentario: comentario || null,
        empresaNombre: ctx.empresa_nombre, empresaTelefono: ctx.empresa_telefono ?? null,
        appUrl: process.env.APP_URL ?? '',
      }).catch(err => console.error('[email] cliente rechazada:', err));
    }

    if (ctx.empresa_email) {
      sendEmpresaRechazo({
        to: ctx.empresa_email, clienteNombre, proformaNumero,
        motivo: motivo || null, comentario: comentario || null,
        empresaNombre: ctx.empresa_nombre,
      }).catch(err => console.error('[email] empresa rechazada:', err));
    }
  }).catch(() => {});

  return c.json({ ok: true, ya_rechazado: false });
});

export default pub;
