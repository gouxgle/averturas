import { Hono } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import {
  OportunidadSchema, OportunidadUpdateSchema, OportunidadPosponerSchema,
  OportunidadEstadoSchema, OportunidadContactoSchema,
} from '../lib/schemas.js';
import { sincronizarTarea, completarTareaDeOportunidad } from '../lib/oportunidades.js';
import { enviarWhatsapp } from '../lib/whatsapp.js';

const oportunidades = new Hono();

const CLIENTE_JSON = `
  json_build_object(
    'id', cl.id, 'nombre', cl.nombre, 'apellido', cl.apellido,
    'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona,
    'telefono', cl.telefono, 'email', cl.email
  ) AS cliente
`;

// GET / — listado, ?vista=vencidas|hoy|proximas|abiertas|a_definir|todas, ?cliente_id=
oportunidades.get('/', async (c) => {
  const vista = c.req.query('vista') || 'abiertas';
  const clienteId = c.req.query('cliente_id');
  const params: unknown[] = [];
  const conds: string[] = [];

  if (vista === 'vencidas')      conds.push(`o.estado = 'pendiente' AND o.fecha_recontacto < CURRENT_DATE`);
  else if (vista === 'hoy')      conds.push(`o.estado = 'pendiente' AND o.fecha_recontacto = CURRENT_DATE`);
  else if (vista === 'proximas') conds.push(`o.estado = 'pendiente' AND o.fecha_recontacto > CURRENT_DATE`);
  else if (vista === 'a_definir') conds.push(`o.estado = 'contactada'`);
  else if (vista === 'abiertas') conds.push(`o.estado IN ('pendiente','contactada')`);
  // 'todas' — sin condición de estado

  if (clienteId) {
    params.push(clienteId);
    conds.push(`o.cliente_id = $${params.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await db.query(`
    SELECT o.*,
      (CURRENT_DATE - o.fecha_recontacto)::int AS dias_atraso,
      op.numero AS operacion_origen_numero,
      ${CLIENTE_JSON}
    FROM oportunidades o
    JOIN clientes cl ON cl.id = o.cliente_id
    LEFT JOIN operaciones op ON op.id = o.operacion_id_origen
    ${where}
    ORDER BY o.fecha_recontacto ASC
    LIMIT 100
  `, params);

  return c.json(rows);
});

// GET /resumen — contadores por bucket, para los badges del panel
oportunidades.get('/resumen', async (c) => {
  const { rows: [row] } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_recontacto < CURRENT_DATE)::int AS vencidas,
      COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_recontacto = CURRENT_DATE)::int AS hoy,
      COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_recontacto > CURRENT_DATE
        AND fecha_recontacto <= CURRENT_DATE + 7)::int AS semana,
      COUNT(*) FILTER (WHERE estado IN ('pendiente','contactada'))::int AS abiertas,
      COUNT(*) FILTER (WHERE estado = 'contactada')::int AS a_definir
    FROM oportunidades
  `);
  return c.json(row);
});

// GET /plantilla/:id — mensaje sugerido ya sustituido, para el popover de contacto
oportunidades.get('/plantilla/:id', async (c) => {
  const { id } = c.req.param();
  const [{ rows: [op] }, { rows: [tpl] }, { rows: [empresa] }] = await Promise.all([
    db.query(`
      SELECT o.motivo, cl.nombre, cl.apellido, cl.razon_social, cl.tipo_persona
      FROM oportunidades o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.id = $1
    `, [id]),
    db.query(`SELECT contenido FROM mensajes_plantilla WHERE clave = 'oportunidad_recontacto'`),
    db.query(`SELECT nombre FROM empresa ORDER BY updated_at DESC LIMIT 1`),
  ]);
  if (!op) return c.json({ error: 'Oportunidad no encontrada' }, 404);

  const nombreCliente = op.tipo_persona === 'juridica'
    ? (op.razon_social ?? '')
    : (op.nombre ?? '');

  const contenido = tpl?.contenido
    ?? 'Hola {{nombre}}! Te escribo de {{empresa}}. Habíamos quedado en volver a contactarte por {{motivo}}. ¿Seguís con la idea?';

  const mensaje = contenido
    .replace(/\{\{nombre\}\}/g, nombreCliente)
    .replace(/\{\{motivo\}\}/g, op.motivo)
    .replace(/\{\{empresa\}\}/g, empresa?.nombre ?? '');

  return c.json({ mensaje });
});

// POST / — crea la oportunidad + la tarea espejo + una interacción de registro
oportunidades.post('/', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, OportunidadSchema);
  if (b instanceof Response) return b;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [op] } = await client.query(`
      INSERT INTO oportunidades
        (cliente_id, operacion_id_origen, motivo, fecha_recontacto, interes, probabilidad, observaciones, origen, created_by)
      VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      b.cliente_id, b.operacion_id_origen || null, b.motivo, b.fecha_recontacto,
      b.interes, b.probabilidad, b.observaciones || null, b.origen, user.id,
    ]);

    await sincronizarTarea(client, op.id);

    await client.query(`
      INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by)
      VALUES ($1, $2, 'nota', $3, $4)
    `, [
      op.cliente_id, b.operacion_id_origen || null,
      `Oportunidad futura registrada: ${b.motivo} — recontactar el ${b.fecha_recontacto}`,
      user.id,
    ]);

    // sincronizarTarea actualizó tarea_id después del RETURNING de arriba — releer.
    const { rows: [opFinal] } = await client.query(`SELECT * FROM oportunidades WHERE id = $1`, [op.id]);

    await client.query('COMMIT');
    return c.json(opFinal, 201);
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err?.code === '23505') {
      return c.json({ error: 'Ya existe una oportunidad igual pendiente para este cliente' }, 409);
    }
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id — edita los 5 campos. Si cambió la fecha, resync + notif_leida=false
oportunidades.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, OportunidadUpdateSchema);
  if (b instanceof Response) return b;

  const { rows: [actual] } = await db.query(`SELECT id FROM oportunidades WHERE id = $1`, [id]);
  if (!actual) return c.json({ error: 'Oportunidad no encontrada' }, 404);

  // Si vino fecha_recontacto en el body, es porque se está reprogramando —
  // resetea notif_leida (ver comentario en la migración) sin necesidad de
  // comparar contra el valor anterior.
  const cambioFecha = b.fecha_recontacto != null;

  const { rows: [op] } = await db.query(`
    UPDATE oportunidades SET
      operacion_id_origen = COALESCE($1, operacion_id_origen),
      motivo               = COALESCE($2, motivo),
      fecha_recontacto      = COALESCE($3::date, fecha_recontacto),
      interes               = COALESCE($4, interes),
      probabilidad           = COALESCE($5, probabilidad),
      observaciones           = COALESCE($6, observaciones),
      notif_leida             = CASE WHEN $7 THEN false ELSE notif_leida END,
      updated_at              = now()
    WHERE id = $8
    RETURNING *
  `, [
    b.operacion_id_origen, b.motivo, b.fecha_recontacto, b.interes,
    b.probabilidad, b.observaciones, cambioFecha, id,
  ]);

  await sincronizarTarea(db, op.id);
  return c.json(op);
});

// PATCH /:id/posponer — nueva fecha, cuenta la pospuesta, vuelve a sonar
oportunidades.patch('/:id/posponer', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, OportunidadPosponerSchema);
  if (b instanceof Response) return b;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [op] } = await client.query(`
      UPDATE oportunidades SET
        fecha_recontacto = $1::date,
        estado           = 'pendiente',
        veces_pospuesta   = veces_pospuesta + 1,
        notif_leida       = false,
        observaciones     = COALESCE($2, observaciones),
        updated_at        = now()
      WHERE id = $3
      RETURNING *
    `, [b.fecha_recontacto, b.observaciones || null, id]);

    if (!op) { await client.query('ROLLBACK'); return c.json({ error: 'Oportunidad no encontrada' }, 404); }

    await sincronizarTarea(client, op.id);

    await client.query(`
      INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by)
      VALUES ($1, 'nota', $2, $3)
    `, [op.cliente_id, `Oportunidad pospuesta al ${b.fecha_recontacto}`, user.id]);

    const { rows: [opFinal] } = await client.query(`SELECT * FROM oportunidades WHERE id = $1`, [op.id]);

    await client.query('COMMIT');
    return c.json(opFinal);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id/estado — cierra (convertida/descartada) o reabre (pendiente)
oportunidades.patch('/:id/estado', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, OportunidadEstadoSchema);
  if (b instanceof Response) return b;

  const cerrando = b.estado === 'convertida' || b.estado === 'descartada';

  const { rows: [op] } = await db.query(`
    UPDATE oportunidades SET
      estado              = $1,
      motivo_cierre        = $2,
      operacion_id_ganada   = COALESCE($3, operacion_id_ganada),
      cerrada_at            = CASE WHEN $4 THEN now() ELSE NULL END,
      updated_at            = now()
    WHERE id = $5
    RETURNING *
  `, [b.estado, b.motivo_cierre || null, b.operacion_id_ganada || null, cerrando, id]);

  if (!op) return c.json({ error: 'Oportunidad no encontrada' }, 404);

  if (cerrando) await completarTareaDeOportunidad(db, op.id);
  else if (b.estado === 'pendiente') await sincronizarTarea(db, op.id);

  return c.json(op);
});

// POST /:id/contactar — envía WhatsApp (u otro canal), registra interacción,
// actualiza ultima_interaccion, y pasa la oportunidad a "contactada"
oportunidades.post('/:id/contactar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, OportunidadContactoSchema);
  if (b instanceof Response) return b;

  const { rows: [op] } = await db.query(`
    SELECT o.*, cl.telefono, cl.email
    FROM oportunidades o JOIN clientes cl ON cl.id = o.cliente_id
    WHERE o.id = $1
  `, [id]);
  if (!op) return c.json({ error: 'Oportunidad no encontrada' }, 404);

  if (b.canal === 'whatsapp') {
    if (!op.telefono) return c.json({ error: 'El cliente no tiene teléfono registrado' }, 422);
    if (!b.mensaje?.trim()) return c.json({ error: 'Mensaje requerido' }, 422);
    const resultado = await enviarWhatsapp(op.telefono, b.mensaje);
    if (!resultado.ok) return c.json({ error: resultado.error }, resultado.status as 422 | 500 | 502);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by)
      VALUES ($1, $2, $3, $4)
    `, [
      op.cliente_id, b.canal,
      b.canal === 'whatsapp' ? `Mensaje enviado: ${(b.mensaje ?? '').slice(0, 100)}` : `Contacto por ${b.canal} — oportunidad "${op.motivo}"`,
      user.id,
    ]);

    await client.query(`UPDATE clientes SET ultima_interaccion = now() WHERE id = $1`, [op.cliente_id]);

    const { rows: [actualizada] } = await client.query(`
      UPDATE oportunidades SET estado = 'contactada', ultimo_contacto_at = now(), updated_at = now()
      WHERE id = $1 RETURNING *
    `, [id]);

    await client.query('COMMIT');
    await completarTareaDeOportunidad(db, id);
    return c.json(actualizada);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /:id — solo si nunca se contactó (en UI se prefiere "descartada")
oportunidades.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [op] } = await db.query(`SELECT estado FROM oportunidades WHERE id = $1`, [id]);
  if (!op) return c.json({ error: 'Oportunidad no encontrada' }, 404);
  if (op.estado !== 'pendiente') {
    return c.json({ error: 'Esta oportunidad ya fue contactada — descartala en vez de borrarla' }, 409);
  }
  await db.query(`DELETE FROM oportunidades WHERE id = $1`, [id]);
  return c.json({ ok: true });
});

export default oportunidades;
