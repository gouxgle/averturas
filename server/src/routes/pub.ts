import { Hono } from 'hono';
import { db } from '../db.js';
import {
  sendProformaAceptada, sendProformaRechazada,
  sendEmpresaAceptacion, sendEmpresaRechazo,
} from '../email.js';

const pub = new Hono();

// GET /pub/entorno — para el banner visual test/producción. Se deriva de APP_URL
// (ya es distinto por ambiente en cada .env) para que cambie solo al deployar,
// sin tocar nada a mano. Ver tabla de Ambientes en CLAUDE.md.
pub.get('/entorno', (c) => {
  const url = (process.env.APP_URL || '').toLowerCase();
  if (url.includes('solucionesgps.com.ar')) return c.json({ entorno: 'test' });
  if (url.includes('cesarbritez.com.ar'))   return c.json({ entorno: 'produccion' });
  return c.json({ entorno: 'local' });
});

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

// Resuelve un token de REVISIÓN (no de operación): busca en operacion_revisiones
// y trae junto el estado vivo de la operación + si es la última revisión enviada.
// Todo el link público gira alrededor de esto — ver plan de versionado.
interface RevisionRow {
  revision_id: string; operacion_id: string; revision: number; token: string;
  snapshot: Record<string, unknown>; contenido_hash: string;
  enviada_at: string; aprobada_at: string | null; rechazada_at: string | null;
  cliente_id: string; numero: string;
  estado_actual: string; aprobado_online_at: string | null;
  es_ultima: boolean;
}
async function buscarRevision(token: string): Promise<RevisionRow | null> {
  const { rows: [row] } = await db.query(`
    SELECT r.id AS revision_id, r.operacion_id, r.revision, r.token, r.snapshot, r.contenido_hash,
      r.enviada_at, r.aprobada_at, r.rechazada_at,
      o.cliente_id, o.numero, o.estado AS estado_actual, o.aprobado_online_at,
      (r.revision = (SELECT MAX(revision) FROM operacion_revisiones WHERE operacion_id = r.operacion_id)) AS es_ultima
    FROM operacion_revisiones r
    JOIN operaciones o ON o.id = r.operacion_id
    WHERE r.token = $1
  `, [token]);
  return row ?? null;
}

// GET /pub/presupuesto/:token — datos públicos de una revisión (link único por envío)
pub.get('/presupuesto/:token', async (c) => {
  const { token } = c.req.param();
  const rev = await buscarRevision(token);
  if (!rev) return c.json({ error: 'Link inválido o expirado' }, 404);

  const { rows: [empresa] } = await db.query(`
    SELECT nombre, cuit, telefono, email, direccion, logo_url, instagram, terminos_url
    FROM empresa LIMIT 1
  `);

  const { rows: revisiones } = await db.query(`
    SELECT revision AS numero, token, enviada_at FROM operacion_revisiones
    WHERE operacion_id = $1 ORDER BY revision ASC
  `, [rev.operacion_id]);
  const ultima = revisiones[revisiones.length - 1];

  return c.json({
    ...rev.snapshot,
    empresa,
    // El estado se sirve VIVO — pisa el que trae el snapshot (congelado al enviar).
    estado: rev.estado_actual,
    aprobado_online_at: rev.aprobado_online_at,
    revision: {
      numero: rev.revision, enviada_at: rev.enviada_at, es_ultima: rev.es_ultima,
      aprobada_at: rev.aprobada_at, rechazada_at: rev.rechazada_at,
    },
    ultima_revision: ultima ? { numero: ultima.numero, token: ultima.token, enviada_at: ultima.enviada_at } : null,
    revisiones,
  });
});

// GET /pub/presupuesto/:token/revisiones/:n — snapshot de otra revisión de la
// MISMA operación, para el comparador del cliente. 404 si "n" es de otra operación.
pub.get('/presupuesto/:token/revisiones/:n', async (c) => {
  const { token, n } = c.req.param();
  const rev = await buscarRevision(token);
  if (!rev) return c.json({ error: 'Link inválido o expirado' }, 404);

  const { rows: [otra] } = await db.query(`
    SELECT revision, enviada_at, snapshot FROM operacion_revisiones
    WHERE operacion_id = $1 AND revision = $2
  `, [rev.operacion_id, n]);
  if (!otra) return c.json({ error: 'Revisión no encontrada' }, 404);

  return c.json(otra);
});

// POST /pub/presupuesto/:token/aprobar — aprobación por el cliente
pub.post('/presupuesto/:token/aprobar', async (c) => {
  const { token } = c.req.param();
  const rev = await buscarRevision(token);
  if (!rev) return c.json({ error: 'Link inválido o expirado' }, 404);

  if (rev.estado_actual === 'aprobado') {
    return c.json({ ok: true, ya_aprobado: true });
  }

  if (!rev.es_ultima) {
    const { rows: [ultima] } = await db.query(
      `SELECT token FROM operacion_revisiones WHERE operacion_id=$1 ORDER BY revision DESC LIMIT 1`,
      [rev.operacion_id]
    );
    return c.json({ error: 'Hay una propuesta más nueva. Pedí el link actualizado.', ultima_token: ultima?.token }, 409);
  }

  if (!['presupuesto', 'enviado'].includes(rev.estado_actual)) {
    return c.json({ error: `No se puede aprobar un presupuesto en estado "${rev.estado_actual}"` }, 400);
  }

  // El admin pudo haber editado sin reenviar: lo que el cliente ve (congelado en
  // esta revisión) puede ya no coincidir con la operación viva. Sin este chequeo
  // el cliente aprobaría algo que nunca llegó a ver.
  const { rows: [{ hash: hashVivo }] } = await db.query(
    `SELECT proforma_hash(proforma_snapshot($1)) AS hash`, [rev.operacion_id]
  );
  if (hashVivo !== rev.contenido_hash) {
    return c.json({ error: 'Esta propuesta fue actualizada. Pedí el link nuevo antes de aprobar.' }, 409);
  }

  await db.query(
    `UPDATE operaciones
     SET estado = 'aprobado', aprobado_online_at = now(), notif_leida = false, updated_at = now()
     WHERE id = $1`,
    [rev.operacion_id]
  );
  await db.query(`UPDATE operacion_revisiones SET aprobada_at = now() WHERE id = $1`, [rev.revision_id]);

  // Reserva de stock: un movimiento 'reserva' por cada item con producto_id
  db.query(`
    SELECT oi.producto_id, oi.cantidad
    FROM operacion_items oi
    WHERE oi.operacion_id = $1 AND oi.producto_id IS NOT NULL AND oi.cantidad > 0
  `, [rev.operacion_id]).then(async ({ rows: items }) => {
    for (const item of items) {
      await db.query(`
        INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id)
        VALUES ($1, 'reserva', $2, 'Proforma aprobada', $3)
      `, [item.producto_id, -Math.abs(item.cantidad), rev.operacion_id]);
    }
  }).catch(err => console.error('[stock] Error al crear reserva:', err));

  // Emails (fire and forget)
  fetchCtxEmail(rev.operacion_id).then(ctx => {
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

  const rev = await buscarRevision(token);
  if (!rev) return c.json({ error: 'Link inválido o expirado' }, 404);

  if (rev.estado_actual === 'aprobado') {
    return c.json({ error: 'Este presupuesto ya fue aprobado y no puede rechazarse' }, 400);
  }

  if (rev.estado_actual === 'rechazado') {
    return c.json({ ok: true, ya_rechazado: true });
  }

  if (!rev.es_ultima) {
    const { rows: [ultima] } = await db.query(
      `SELECT token FROM operacion_revisiones WHERE operacion_id=$1 ORDER BY revision DESC LIMIT 1`,
      [rev.operacion_id]
    );
    return c.json({ error: 'Hay una propuesta más nueva. Pedí el link actualizado.', ultima_token: ultima?.token }, 409);
  }

  await db.query(
    `UPDATE operaciones
     SET estado = 'rechazado',
         motivo_rechazo     = $1,
         comentario_rechazo = $2,
         updated_at         = now()
     WHERE id = $3`,
    [motivo || null, comentario || null, rev.operacion_id]
  );
  await db.query(`UPDATE operacion_revisiones SET rechazada_at = now() WHERE id = $1`, [rev.revision_id]);

  // Deja la devolución en el historial del cliente — sin esto, el motivo de
  // rechazo solo quedaba en la operación y no aparecía en el timeline.
  const proformaNumero = rev.numero.replace(/^OP-/, 'PRO-');
  const partesRechazo: string[] = [`Rechazó la proforma ${proformaNumero}`];
  if (motivo)     partesRechazo.push(`Motivo: ${motivo}`);
  if (comentario) partesRechazo.push(`Comentario: ${comentario}`);
  db.query(
    `INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by)
     VALUES ($1, $2, 'respuesta_proforma', $3, NULL)`,
    [rev.cliente_id, rev.operacion_id, partesRechazo.join('. ')]
  ).catch(err => console.error('[crm] Error al registrar interacción de rechazo:', err));

  // Emails (fire and forget)
  fetchCtxEmail(rev.operacion_id).then(ctx => {
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

  const rev = await buscarRevision(token);
  if (!rev) return c.json({ error: 'Link inválido o expirado' }, 404);
  if (['aprobado', 'rechazado', 'cancelado'].includes(rev.estado_actual)) {
    return c.json({ error: `La proforma está en estado "${rev.estado_actual}" y no admite esta respuesta` }, 400);
  }
  if (!rev.es_ultima) {
    const { rows: [ultima] } = await db.query(
      `SELECT token FROM operacion_revisiones WHERE operacion_id=$1 ORDER BY revision DESC LIMIT 1`,
      [rev.operacion_id]
    );
    return c.json({ error: 'Hay una propuesta más nueva. Pedí el link actualizado.', ultima_token: ultima?.token }, 409);
  }
  const op = { id: rev.operacion_id, cliente_id: rev.cliente_id };

  // Marca la intención sin tocar estado_operacion; enciende la campanita
  await db.query(
    `UPDATE operaciones
     SET respuesta_cliente = $1, respuesta_cliente_at = now(), notif_leida = false, updated_at = now()
     WHERE id = $2`,
    [tipo, op.id]
  );

  // Descripción legible para la interacción (timeline del cliente)
  const proformaNumero = rev.numero.replace(/^OP-/, 'PRO-');
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

  // Tarea de seguimiento con fecha sugerida. Fecha calculada en SQL (CURRENT_DATE
  // del server, ya en horario Argentina) — nunca con Date+toISOString(), que corre
  // un día entre las 21:00 y las 23:59 locales (bug UTC documentado en CLAUDE.md).
  let vencimiento: string;   // 'YYYY-MM-DD'
  if (tipo === 'llamada' && llamadaFecha) {
    vencimiento = llamadaFecha;
  } else {
    const dias = tipo === 'mas_tiempo' ? diasSeguimiento(motivo) : 2;
    const { rows: [{ vencimiento: v }] } = await db.query(
      `SELECT (CURRENT_DATE + $1::int)::text AS vencimiento`, [dias]
    );
    vencimiento = v;
  }

  // "Necesito más tiempo" es, en esencia, una oportunidad futura: la tarea que se
  // genera es directamente la tarea espejo de esa oportunidad (tipo_accion='oportunidad'),
  // no una tarea de seguimiento aparte — evita duplicar el aviso en la agenda.
  const esOportunidad = tipo === 'mas_tiempo';
  const tipoAccion = esOportunidad ? 'oportunidad' : tipo === 'llamada' ? 'llamada' : 'seguimiento';
  const tareaDesc =
    tipo === 'llamada'   ? `Llamar al cliente — Proforma ${proformaNumero}${llamadaHorario ? ` (horario: ${llamadaHorario})` : ''}` :
    tipo === 'consulta'  ? `Responder consulta del cliente — Proforma ${proformaNumero}` :
    tipo === 'modificar' ? `Ajustar y reenviar proforma — Proforma ${proformaNumero}` :
                           `Seguimiento de proforma — Proforma ${proformaNumero}`;

  const { rows: [tarea] } = await db.query(
    `INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, hora)
     VALUES ($1, $2, $3, $4, 'alta', $5, $6) RETURNING id`,
    [op.cliente_id, op.id, `${tareaDesc}${comentario ? ` — "${comentario}"` : ''}`, vencimiento, tipoAccion,
     tipo === 'llamada' && llamadaHorario && /^\d{2}:\d{2}/.test(llamadaHorario) ? llamadaHorario : null]
  ).catch(err => { console.error('[crm] Error al registrar tarea:', err); return { rows: [] as { id: string }[] }; });

  if (esOportunidad && tarea?.id) {
    const motivoOportunidad = motivo || `Respuesta desde la proforma ${proformaNumero}: necesita más tiempo`;
    db.query(
      `INSERT INTO oportunidades (cliente_id, operacion_id_origen, tarea_id, motivo, fecha_recontacto, observaciones, origen)
       VALUES ($1, $2, $3, $4, $5, $6, 'publico')`,
      [op.cliente_id, op.id, tarea.id, motivoOportunidad, vencimiento, comentario]
    ).catch(err => console.error('[oportunidades] Error al registrar oportunidad pública:', err));
  }

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

  // Los ítems del REMITO son la verdad de lo que se entrega — no los de la
  // operación entera. Antes esto listaba TODOS los ítems del presupuesto
  // (con su cantidad original) cuando el remito tenía operacion_id, así que
  // en una entrega parcial el cliente veía mercadería que no estaba
  // recibiendo (mismo bug que ya se había corregido en ImprimirRemito.tsx,
  // pero solo ahí — esta ruta pública se quedó con la versión vieja).
  // De la operación se toman solo los datos descriptivos que remito_items no
  // guarda (medidas, color, vidrio, tipo, sistema, atributos, foto), vía el
  // ítem de origen (`operacion_item_id`); si el renglón se cargó a mano,
  // `oi` no matchea y solo quedan los datos propios de remito_items.
  const { rows: items } = await db.query(`
    SELECT
      ri.descripcion, ri.cantidad, ri.estado_producto, ri.notas_item AS notas,
      oi.color, oi.medida_ancho, oi.medida_alto, oi.vidrio, oi.premarco, oi.accesorios,
      ta.nombre AS tipo_abertura_nombre,
      si.nombre AS sistema_nombre,
      cp.atributos  AS producto_atributos,
      cp.imagen_url AS producto_imagen_url
    FROM remito_items ri
    LEFT JOIN operacion_items    oi ON oi.id = ri.operacion_item_id
    LEFT JOIN tipos_abertura     ta ON ta.id = oi.tipo_abertura_id
    LEFT JOIN sistemas           si ON si.id = oi.sistema_id
    LEFT JOIN catalogo_productos cp ON cp.id = COALESCE(oi.producto_id, ri.producto_id)
    WHERE ri.remito_id = $1
    ORDER BY ri.id
  `, [rem.id]);

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
