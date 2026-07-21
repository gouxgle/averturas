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
      AND (o.token_expira_at IS NULL OR o.token_expira_at > now())
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
    `SELECT id, estado FROM operaciones
     WHERE token_acceso = $1
       AND (token_expira_at IS NULL OR token_expira_at > now())`,
    [token]
  );

  if (!op) return c.json({ error: 'Link inválido o expirado' }, 404);

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
    `SELECT id, estado FROM operaciones
     WHERE token_acceso = $1
       AND (token_expira_at IS NULL OR token_expira_at > now())`,
    [token]
  );

  if (!op) return c.json({ error: 'Link inválido o expirado' }, 404);

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

// ─── Respuesta intermedia (no terminal): más tiempo / consulta / llamada / modificar ───
const RESPUESTA_LABEL: Record<string, string> = {
  mas_tiempo: 'Necesita más tiempo',
  consulta:   'Tiene una consulta',
  llamada:    'Pidió que lo llamen',
  modificar:  'Pidió modificar la propuesta',
};

// Días de seguimiento sugeridos según el motivo de "necesito más tiempo"
function diasSeguimiento(motivo: string | null): number {
  const m = (motivo ?? '').toLowerCase();
  if (m.includes('compar'))  return 5;   // comparando presupuestos
  if (m.includes('cobr'))    return 15;  // esperando cobrar
  if (m.includes('obra'))    return 30;  // obra sin comenzar
  return 7;
}

// POST /pub/presupuesto/:token/responder — respuesta intermedia del cliente (no cambia el estado)
pub.post('/presupuesto/:token/responder', async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json().catch(() => ({})) as any;
  const tipo: string = body.tipo;
  const motivo: string | null       = body.motivo || null;
  const comentario: string | null   = body.comentario || null;
  const cambios: string[]           = Array.isArray(body.cambios) ? body.cambios : [];
  const llamadaFecha: string | null = body.llamada_fecha || null;   // 'YYYY-MM-DD'
  const llamadaHorario: string | null = body.llamada_horario || null; // 'HH:MM' o texto

  if (!RESPUESTA_LABEL[tipo]) {
    return c.json({ error: 'Tipo de respuesta inválido' }, 400);
  }

  const { rows: [op] } = await db.query(
    `SELECT id, cliente_id, estado, numero FROM operaciones
     WHERE token_acceso = $1
       AND (token_expira_at IS NULL OR token_expira_at > now())`,
    [token]
  );

  if (!op) return c.json({ error: 'Link inválido o expirado' }, 404);
  if (['aprobado', 'rechazado', 'cancelado'].includes(op.estado)) {
    return c.json({ error: `La proforma está en estado "${op.estado}" y no admite esta respuesta` }, 400);
  }

  // Marca la intención sin tocar estado_operacion; enciende la campanita
  await db.query(
    `UPDATE operaciones
     SET respuesta_cliente = $1, respuesta_cliente_at = now(), notif_leida = false, updated_at = now()
     WHERE id = $2`,
    [tipo, op.id]
  );

  // Descripción legible para la interacción (timeline del cliente)
  const proformaNumero = (op.numero as string).replace(/^OP-/, 'PRO-');
  const partes: string[] = [`${RESPUESTA_LABEL[tipo]} — Proforma ${proformaNumero}`];
  if (motivo)              partes.push(`Motivo: ${motivo}`);
  if (cambios.length)      partes.push(`Cambios pedidos: ${cambios.join(', ')}`);
  if (llamadaFecha)        partes.push(`Prefiere ${llamadaFecha}${llamadaHorario ? ` ${llamadaHorario}` : ''}`);
  if (comentario)          partes.push(`Comentario: ${comentario}`);
  const descripcion = partes.join('. ');

  db.query(
    `INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by)
     VALUES ($1, $2, 'respuesta_proforma', $3, NULL)`,
    [op.cliente_id, op.id, descripcion]
  ).catch(err => console.error('[crm] Error al registrar interacción:', err));

  // Tarea de seguimiento con fecha sugerida
  let vencimiento: string;   // 'YYYY-MM-DD'
  if (tipo === 'llamada' && llamadaFecha) {
    vencimiento = llamadaFecha;
  } else {
    const dias = tipo === 'mas_tiempo' ? diasSeguimiento(motivo) : 2;
    const d = new Date();
    d.setDate(d.getDate() + dias);
    vencimiento = d.toISOString().slice(0, 10);
  }
  const tipoAccion = tipo === 'llamada' ? 'llamada' : 'seguimiento';
  const tareaDesc =
    tipo === 'llamada'   ? `Llamar al cliente — Proforma ${proformaNumero}${llamadaHorario ? ` (horario: ${llamadaHorario})` : ''}` :
    tipo === 'consulta'  ? `Responder consulta del cliente — Proforma ${proformaNumero}` :
    tipo === 'modificar' ? `Ajustar y reenviar proforma — Proforma ${proformaNumero}` :
                           `Seguimiento de proforma — Proforma ${proformaNumero}`;

  db.query(
    `INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, hora)
     VALUES ($1, $2, $3, $4, 'alta', $5, $6)`,
    [op.cliente_id, op.id, `${tareaDesc}${comentario ? ` — "${comentario}"` : ''}`, vencimiento, tipoAccion,
     tipo === 'llamada' && llamadaHorario && /^\d{2}:\d{2}/.test(llamadaHorario) ? llamadaHorario : null]
  ).catch(err => console.error('[crm] Error al registrar tarea:', err));

  return c.json({ ok: true, tipo, seguimiento: vencimiento });
});

// ─── REMITO PÚBLICO ──────────────────────────────────────────────────────────

// GET /pub/remito/:token — datos del remito para la vista pública
pub.get('/remito/:token', async (c) => {
  const { token } = c.req.param();

  const { rows: [rem] } = await db.query(`
    SELECT
      r.id, r.numero, r.estado, r.medio_envio, r.transportista, r.nro_seguimiento,
      r.direccion_entrega, r.fecha_emision, r.fecha_entrega_est, r.notas,
      r.token_acceso_at, r.recepcion_estado, r.recepcion_at, r.recepcion_obs,
      r.operacion_id,
      CASE WHEN op.id IS NOT NULL THEN
        json_build_object('id', op.id, 'numero', op.numero)
      ELSE NULL END AS operacion,
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
        'nombre',    e.nombre,
        'cuit',      e.cuit,
        'telefono',  e.telefono,
        'email',     e.email,
        'direccion', e.direccion,
        'logo_url',  e.logo_url,
        'instagram', e.instagram
      ) AS empresa
    FROM remitos r
    JOIN clientes cl ON cl.id = r.cliente_id
    LEFT JOIN operaciones op ON op.id = r.operacion_id
    CROSS JOIN (SELECT * FROM empresa LIMIT 1) e
    WHERE r.token_acceso = $1
  `, [token]);

  if (!rem) return c.json({ error: 'Link inválido o expirado' }, 404);

  // Items: usa operacion_items (con specs completos) si hay operacion_id, sino remito_items
  let items: unknown[];
  if (rem.operacion_id) {
    const { rows } = await db.query(`
      SELECT
        oi.orden, oi.descripcion, oi.cantidad, oi.color,
        oi.medida_ancho, oi.medida_alto, oi.vidrio, oi.premarco,
        oi.accesorios, oi.notas,
        cp.atributos AS producto_atributos,
        ta.nombre AS tipo_abertura_nombre,
        si.nombre AS sistema_nombre,
        cp.imagen_url AS producto_imagen_url
      FROM operacion_items oi
      LEFT JOIN tipos_abertura     ta ON ta.id = oi.tipo_abertura_id
      LEFT JOIN sistemas           si ON si.id = oi.sistema_id
      LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
      WHERE oi.operacion_id = $1
      ORDER BY oi.orden, oi.id
    `, [rem.operacion_id]);
    items = rows;
  } else {
    const { rows } = await db.query(`
      SELECT
        ri.descripcion, ri.cantidad, ri.estado_producto, ri.notas_item AS notas,
        NULL AS medida_ancho, NULL AS medida_alto, NULL AS color,
        NULL AS vidrio, false AS premarco, '{}' AS accesorios,
        NULL AS tipo_abertura_nombre, NULL AS sistema_nombre,
        cp.imagen_url AS producto_imagen_url,
        NULL AS producto_atributos
      FROM remito_items ri
      LEFT JOIN catalogo_productos cp ON cp.id = ri.producto_id
      WHERE ri.remito_id = $1
      ORDER BY ri.id
    `, [rem.id]);
    items = rows;
  }

  return c.json({ ...rem, items });
});

// POST /pub/remito/:token/confirmar — cliente confirma recepción
pub.post('/remito/:token/confirmar', async (c) => {
  const { token } = c.req.param();
  const { estado, observaciones } = await c.req.json().catch(() => ({})) as Record<string, string>;

  const estadosValidos = ['conforme', 'con_observaciones', 'no_conforme'];
  if (!estadosValidos.includes(estado)) {
    return c.json({ error: 'Estado inválido' }, 400);
  }

  const { rows: [rem] } = await db.query(
    `SELECT id, recepcion_estado FROM remitos WHERE token_acceso = $1`, [token]
  );
  if (!rem) return c.json({ error: 'Link inválido' }, 404);

  if (rem.recepcion_estado) {
    return c.json({ ok: true, ya_confirmado: true, estado: rem.recepcion_estado });
  }

  await db.query(
    `UPDATE remitos SET recepcion_estado = $1, recepcion_at = now(), recepcion_obs = $2 WHERE id = $3`,
    [estado, observaciones || null, rem.id]
  );

  return c.json({ ok: true, ya_confirmado: false });
});

export default pub;
