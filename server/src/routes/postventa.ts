import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { enviarWhatsapp } from '../lib/whatsapp.js';
import { registrarActividad } from '../lib/actividad.js';
import {
  armarMensajePostventa, completarTareaDeSeguimiento, nombreParaSaludo, PLANTILLA_DEFECTO, resumenProductos,
} from '../lib/postventa.js';

// Seguimiento post venta: a los N días de una entrega se le pregunta al cliente por WhatsApp cómo le fue.
// El operador revisa el mensaje (plantilla editable) y lo manda con un clic; la respuesta llega por el link de
// la encuesta pública (/e/:token, en pub.ts) o se carga a mano si el cliente contestó por chat.
export const postventa = new Hono();

const TABS = ['hoy', 'proximos', 'enviados', 'respondidos', 'descartados'] as const;
type Tab = typeof TABS[number];

const WHERE_TAB: Record<Tab, string> = {
  hoy:         `ps.estado = 'pendiente' AND ps.fecha_contacto <= CURRENT_DATE`,
  proximos:    `ps.estado = 'pendiente' AND ps.fecha_contacto > CURRENT_DATE`,
  enviados:    `ps.estado = 'enviado'`,
  respondidos: `ps.estado = 'respondido'`,
  descartados: `ps.estado = 'descartado'`,
};

const ORDEN_TAB: Record<Tab, string> = {
  hoy: 'ps.fecha_contacto ASC', proximos: 'ps.fecha_contacto ASC', enviados: 'ps.enviado_at ASC',
  respondidos: 'ps.respondido_at DESC', descartados: 'ps.updated_at DESC',
};

const FILAS = `
  ps.id, ps.estado, ps.fecha_entrega::text AS fecha_entrega, ps.fecha_contacto::text AS fecha_contacto,
  GREATEST(CURRENT_DATE - ps.fecha_contacto, 0)::int AS dias_atraso,
  ps.enviado_at, ps.respondido_at, ps.canal_respuesta, ps.comentario, ps.motivo_descarte, ps.operacion_id, ps.cliente_id,
  ps.puntaje_productos, ps.puntaje_entrega, ps.puntaje_atencion,
  op.numero AS operacion_numero, cl.telefono, cl.tipo_persona, cl.nombre, cl.apellido, cl.razon_social,
  (SELECT json_build_object('id', st.id, 'numero', st.numero, 'estado', st.estado) FROM servicios_tecnicos st
    WHERE st.postventa_seguimiento_id = ps.id ORDER BY st.created_at DESC LIMIT 1) AS servicio`;

const linkEncuesta = (token: string) => `${(process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/e/${token}`;

const noConsulta = (c: { get: (k: 'user') => { rol?: string } | undefined }) => c.get('user')?.rol !== 'consulta';

// GET /resumen — indicadores de arriba de la pantalla
postventa.get('/resumen', async (c) => {
  const { rows: [r] } = await db.query(`
    SELECT
      count(*) FILTER (WHERE estado = 'pendiente' AND fecha_contacto <= CURRENT_DATE)::int AS para_hoy,
      count(*) FILTER (WHERE estado = 'pendiente' AND fecha_contacto > CURRENT_DATE)::int AS proximos,
      count(*) FILTER (WHERE estado = 'enviado')::int AS sin_respuesta,
      count(*) FILTER (WHERE estado = 'respondido' AND respondido_at > now() - interval '90 days')::int AS respondidos_90d,
      count(*) FILTER (WHERE estado IN ('enviado', 'respondido') AND COALESCE(enviado_at, respondido_at) > now() - interval '90 days')::int AS contactados_90d,
      round(avg(puntaje_productos) FILTER (WHERE estado = 'respondido' AND respondido_at > now() - interval '90 days'), 1)::float AS prom_productos,
      round(avg(puntaje_entrega) FILTER (WHERE estado = 'respondido' AND respondido_at > now() - interval '90 days'), 1)::float AS prom_entrega,
      round(avg(puntaje_atencion) FILTER (WHERE estado = 'respondido' AND respondido_at > now() - interval '90 days'), 1)::float AS prom_atencion,
      count(*) FILTER (WHERE estado = 'respondido' AND respondido_at > now() - interval '90 days'
        AND LEAST(COALESCE(puntaje_productos, 5), COALESCE(puntaje_entrega, 5), COALESCE(puntaje_atencion, 5)) <= 2)::int AS insatisfechos_90d
    FROM postventa_seguimientos`);
  const { rows: [e] } = await db.query(`SELECT postventa_dias FROM empresa ORDER BY updated_at DESC LIMIT 1`);
  return c.json({
    ...r, tasa_respuesta: r.contactados_90d > 0 ? Math.round(100 * r.respondidos_90d / r.contactados_90d) : null,
    dias: Number(e?.postventa_dias ?? 3),
  });
});

// GET /?tab= — la lista de una pestaña, con los conteos de todas
postventa.get('/', async (c) => {
  const tab = (TABS as readonly string[]).includes(c.req.query('tab') ?? '') ? c.req.query('tab') as Tab : 'hoy';
  const [{ rows }, { rows: [cont] }] = await Promise.all([
    db.query(`
      SELECT ${FILAS} FROM postventa_seguimientos ps
        JOIN clientes cl ON cl.id = ps.cliente_id JOIN operaciones op ON op.id = ps.operacion_id
       WHERE ${WHERE_TAB[tab]} ORDER BY ${ORDEN_TAB[tab]} LIMIT 200`),
    db.query(`
      SELECT ${TABS.map(t => `count(*) FILTER (WHERE ${WHERE_TAB[t]})::int AS ${t}`).join(', ')}
        FROM postventa_seguimientos ps`),
  ]);
  const seguimientos = await Promise.all(rows.map(async r => ({ ...r, productos: await resumenProductos(db, r.operacion_id) })));
  return c.json({ tab, seguimientos, conteos: cont });
});

// GET /:id/mensaje — el mensaje sugerido (plantilla con las variables ya reemplazadas) para revisarlo y mandarlo
postventa.get('/:id/mensaje', async (c) => {
  const id = c.req.param('id');
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const [{ rows: [s] }, { rows: [tpl] }, { rows: [emp] }] = await Promise.all([
    db.query(`SELECT ps.id, ps.token, ps.operacion_id, ps.estado, cl.telefono, cl.tipo_persona, cl.nombre, cl.razon_social
                FROM postventa_seguimientos ps JOIN clientes cl ON cl.id = ps.cliente_id WHERE ps.id = $1`, [id]),
    db.query(`SELECT contenido FROM mensajes_plantilla WHERE clave = 'postventa_satisfaccion'`),
    db.query(`SELECT nombre FROM empresa ORDER BY updated_at DESC LIMIT 1`),
  ]);
  if (!s) return c.json({ error: 'Seguimiento no encontrado' }, 404);
  const link = linkEncuesta(s.token);
  let mensaje = armarMensajePostventa(tpl?.contenido ?? PLANTILLA_DEFECTO, {
    nombre: nombreParaSaludo(s), productos: await resumenProductos(db, s.operacion_id), empresa: emp?.nombre ?? '', link,
  });
  // Si la plantilla editada no trae {{link}}, se agrega: sin el link el cliente no puede responder
  if (!mensaje.includes(link)) mensaje += `\n\nContanos tu opinión acá: ${link}`;
  return c.json({ mensaje, telefono: s.telefono, estado: s.estado });
});

const EnviarSchema = z.object({ mensaje: z.string().trim().min(10, 'El mensaje es muy corto').max(2000) });

// POST /:id/enviar — manda el WhatsApp, anota la interacción y cierra la tarea de la agenda
postventa.post('/:id/enviar', async (c) => {
  if (!noConsulta(c)) return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  const id = c.req.param('id');
  const b = await validateBody(c, EnviarSchema);
  if (b instanceof Response) return b;
  const { rows: [s] } = await db.query(
    `SELECT ps.id, ps.estado, ps.cliente_id, ps.token, cl.telefono FROM postventa_seguimientos ps JOIN clientes cl ON cl.id = ps.cliente_id WHERE ps.id = $1`, [id]);
  if (!s) return c.json({ error: 'Seguimiento no encontrado' }, 404);
  if (!['pendiente', 'enviado'].includes(s.estado)) return c.json({ error: s.estado === 'respondido' ? 'El cliente ya respondió' : 'Este seguimiento está descartado' }, 409);
  if (!s.telefono?.trim()) return c.json({ error: 'El cliente no tiene teléfono registrado' }, 422);
  // El mensaje tiene que llevar el link de la encuesta: sin él no hay forma de responder
  if (!b.mensaje.includes(`/e/${s.token}`)) return c.json({ error: 'El mensaje tiene que incluir el link de la encuesta (no lo borres)' }, 422);

  const r = await enviarWhatsapp(s.telefono, b.mensaje);
  if (!r.ok) return c.json({ error: r.error }, r.status as 422 | 500 | 502);

  const user = c.get('user');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE postventa_seguimientos SET estado = 'enviado', mensaje = $2, enviado_at = now(), enviado_por = $3, updated_at = now() WHERE id = $1`,
      [id, b.mensaje, user?.id ?? null]);
    await client.query(`INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by) VALUES ($1, 'whatsapp', $2, $3)`,
      [s.cliente_id, `Post venta: ${b.mensaje.slice(0, 100)}`, user?.id ?? null]);
    await client.query(`UPDATE clientes SET ultima_interaccion = now() WHERE id = $1`, [s.cliente_id]);
    await completarTareaDeSeguimiento(client, id);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return c.json({ ok: true });
});

const ReprogramarSchema = z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida') });

// PATCH /:id/reprogramar — mueve la fecha de contacto (y la tarea de la agenda)
postventa.patch('/:id/reprogramar', async (c) => {
  if (!noConsulta(c)) return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  const b = await validateBody(c, ReprogramarSchema);
  if (b instanceof Response) return b;
  const { rows: [s] } = await db.query(
    `UPDATE postventa_seguimientos SET fecha_contacto = $2::date, updated_at = now() WHERE id = $1 AND estado = 'pendiente' RETURNING tarea_id`, [c.req.param('id'), b.fecha]);
  if (!s) return c.json({ error: 'Solo se puede reprogramar un seguimiento pendiente' }, 409);
  if (s.tarea_id) await db.query(`UPDATE tareas SET vencimiento = $2::date, completada = false, completada_at = NULL WHERE id = $1`, [s.tarea_id, b.fecha]);
  return c.json({ ok: true });
});

const DescartarSchema = z.object({ motivo: z.string().trim().max(300).optional() });

// PATCH /:id/descartar — no corresponde preguntar (cliente conflictivo, obra cancelada, ya hablaron, etc.)
postventa.patch('/:id/descartar', async (c) => {
  if (!noConsulta(c)) return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  const b = await validateBody(c, DescartarSchema);
  if (b instanceof Response) return b;
  const id = c.req.param('id');
  const { rows: [s] } = await db.query(
    `UPDATE postventa_seguimientos SET estado = 'descartado', motivo_descarte = $2, updated_at = now()
      WHERE id = $1 AND estado IN ('pendiente', 'enviado') RETURNING id`, [id, b.motivo || null]);
  if (!s) return c.json({ error: 'No se puede descartar este seguimiento' }, 409);
  await completarTareaDeSeguimiento(db, id);
  return c.json({ ok: true });
});

const Puntaje = z.number().int().min(1).max(5).nullish();
const RespuestaManualSchema = z.object({
  puntaje_productos: Puntaje, puntaje_entrega: Puntaje, puntaje_atencion: Puntaje,
  comentario: z.string().trim().max(1000).optional(),
}).refine(b => b.puntaje_productos || b.puntaje_entrega || b.puntaje_atencion || b.comentario, { message: 'Cargá al menos un puntaje o un comentario' });

// POST /:id/respuesta-manual — el cliente contestó por chat o por teléfono: se carga a mano
postventa.post('/:id/respuesta-manual', async (c) => {
  if (!noConsulta(c)) return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  const b = await validateBody(c, RespuestaManualSchema);
  if (b instanceof Response) return b;
  const id = c.req.param('id');
  const { rows: [s] } = await db.query(`
    UPDATE postventa_seguimientos SET estado = 'respondido', canal_respuesta = 'manual', respondido_at = now(),
           puntaje_productos = $2, puntaje_entrega = $3, puntaje_atencion = $4, comentario = $5, updated_at = now()
     WHERE id = $1 AND estado IN ('pendiente', 'enviado') RETURNING id, operacion_id`,
    [id, b.puntaje_productos ?? null, b.puntaje_entrega ?? null, b.puntaje_atencion ?? null, b.comentario || null]);
  if (!s) return c.json({ error: 'Este seguimiento ya está respondido o descartado' }, 409);
  await completarTareaDeSeguimiento(db, id);
  registrarActividad(c, { entidad: 'presupuesto', entidad_id: s.operacion_id, entidad_numero: null, accion: 'editar', detalle: 'Post venta: respuesta del cliente cargada a mano' });
  return c.json({ ok: true });
});
