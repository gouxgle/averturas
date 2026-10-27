import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { registrarActividad } from '../lib/actividad.js';
import { siguienteNumero } from '../lib/numeracion.js';
import {
  ESTADOS_SERVICIO, TIPO_SERVICIO_LABEL, productosEntregadosDelCliente, sincronizarTareaServicio, type EstadoServicio,
} from '../lib/serviciosTecnicos.js';

// Garantías y servicios técnicos (Post venta): la ficha de cada reclamo o pedido de servicio, desde que el cliente
// avisa hasta que se cierra. Plan y decisiones en ~/.claude/plans (2026-10-27).
export const serviciosTecnicos = new Hono();

const uuid = z.string().uuid();
const noConsulta = (c: Context) => c.get('user')?.rol !== 'consulta';
const SOLO_CONSULTA = { error: 'Tu usuario es de solo consulta' };

const TABS = ['pendientes', 'programados', 'en_proceso', 'repuesto', 'reconsultar', 'finalizados', 'cancelados'] as const;
type Tab = typeof TABS[number];
const WHERE_TAB: Record<Tab, string> = {
  pendientes:  `s.estado = 'pendiente_coordinar'`,
  programados: `s.estado = 'visita_programada'`,
  en_proceso:  `s.estado = 'en_proceso'`,
  repuesto:    `s.estado = 'pendiente_repuesto'`,
  reconsultar: `s.estado = 'finalizado' AND s.recontacto_fecha IS NOT NULL AND s.recontacto_resultado IS NULL AND s.recontacto_fecha <= CURRENT_DATE`,
  finalizados: `s.estado = 'finalizado'`,
  cancelados:  `s.estado = 'cancelado'`,
};
const ORDEN_TAB: Record<Tab, string> = {
  pendientes: 's.fecha_reclamo, s.created_at', programados: 's.fecha_visita, s.hora_visita NULLS LAST',
  en_proceso: 's.updated_at DESC', repuesto: 's.updated_at', reconsultar: 's.recontacto_fecha',
  finalizados: 's.finalizado_at DESC NULLS LAST', cancelados: 's.updated_at DESC',
};

const NOMBRE_CLIENTE = `CASE WHEN cl.tipo_persona = 'juridica' THEN cl.razon_social ELSE concat_ws(', ', cl.apellido, cl.nombre) END`;
const FILAS = `
  s.id, s.numero, s.tipo, s.estado, s.origen, s.problema, s.producto_descripcion, s.adjuntos,
  s.fecha_reclamo::text AS fecha_reclamo, s.fecha_visita::text AS fecha_visita, to_char(s.hora_visita, 'HH24:MI') AS hora_visita,
  s.cliente_id, s.operacion_id, s.remito_id, s.responsable_id, s.responsable_nombre,
  COALESCE(u.nombre, s.responsable_nombre) AS responsable,
  s.recontacto_fecha::text AS recontacto_fecha, s.recontacto_resultado, s.finalizado_at, s.created_at, s.updated_at,
  ${NOMBRE_CLIENTE} AS cliente_nombre, cl.telefono AS cliente_telefono, cl.direccion AS cliente_direccion, cl.localidad AS cliente_localidad,
  o.numero AS operacion_numero, r.numero AS remito_numero,
  (SELECT count(*)::int FROM servicio_intervenciones i WHERE i.servicio_id = s.id) AS intervenciones`;
const JOINS = `
  JOIN clientes cl ON cl.id = s.cliente_id
  LEFT JOIN usuarios u ON u.id = s.responsable_id
  LEFT JOIN operaciones o ON o.id = s.operacion_id
  LEFT JOIN remitos r ON r.id = s.remito_id`;

// ── Adjuntos: fotos (→ webp), videos cortos (tal cual, hasta 50 MB) y PDF ─────────────────────────────

const MAX_VIDEO = 50 * 1024 * 1024;
const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp' };

serviciosTecnicos.post('/adjuntos', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const body = await c.req.formData();
  const file = (body.get('archivo') ?? body.get('imagen')) as File | null;
  if (!file || !file.size) return c.json({ error: 'No se recibió el archivo' }, 400);

  const dir = './uploads/servicios';
  await mkdir(dir, { recursive: true });
  const nombre = file.name || 'archivo';
  const extVideo = VIDEO_EXT[file.type] ?? (/\.(mp4|mov|webm|3gp)$/i.exec(nombre)?.[1]?.toLowerCase());
  if (extVideo) {
    if (file.size > MAX_VIDEO) return c.json({ error: 'El video supera los 50 MB. Grabá uno más corto (hasta ~30 segundos).' }, 413);
    const filename = `${randomUUID()}.${extVideo}`;
    await writeFile(`${dir}/${filename}`, Buffer.from(await file.arrayBuffer()));
    return c.json({ url: `/uploads/servicios/${filename}`, nombre, tipo: 'video' });
  }
  if (file.size > 20 * 1024 * 1024) return c.json({ error: 'El archivo supera los 20 MB' }, 413);
  const buf = Buffer.from(await file.arrayBuffer());
  if (file.type === 'application/pdf' || /\.pdf$/i.test(nombre) || buf.subarray(0, 4).toString() === '%PDF') {
    const filename = `${randomUUID()}.pdf`;
    await writeFile(`${dir}/${filename}`, buf);
    return c.json({ url: `/uploads/servicios/${filename}`, nombre, tipo: 'pdf' });
  }
  // Sin chequeo previo de MIME: sharp es la validación real (ver visitasTecnicas.ts).
  let optimizado: Buffer;
  try {
    optimizado = await sharp(buf).rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
  } catch (err) {
    console.error('[servicios] Error procesando adjunto:', err instanceof Error ? err.message : err);
    return c.json({ error: 'No se pudo procesar el archivo. Se aceptan fotos, videos y PDF.' }, 422);
  }
  const filename = `${randomUUID()}.webp`;
  await writeFile(`${dir}/${filename}`, optimizado);
  return c.json({ url: `/uploads/servicios/${filename}`, nombre, tipo: 'imagen' });
});

// ── Lectura ───────────────────────────────────────────────────────────────────────────────────

// GET /?tab=&tipo=&q=&cliente_id= — lista de una pestaña con los conteos de todas
serviciosTecnicos.get('/', async (c) => {
  const tabQ = c.req.query('tab') ?? '';
  const tab = (TABS as readonly string[]).includes(tabQ) ? tabQ as Tab : 'pendientes';
  const clienteId = c.req.query('cliente_id');
  const filtros: string[] = [];
  const params: unknown[] = [];
  if (clienteId) {
    if (!uuid.safeParse(clienteId).success) return c.json({ error: 'Cliente inválido' }, 422);
    params.push(clienteId); filtros.push(`s.cliente_id = $${params.length}`);
  }
  const tipo = c.req.query('tipo');
  if (tipo && TIPO_SERVICIO_LABEL[tipo]) { params.push(tipo); filtros.push(`s.tipo = $${params.length}`); }
  const q = c.req.query('q')?.trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    filtros.push(`(s.numero ILIKE ${p} OR s.problema ILIKE ${p} OR s.producto_descripcion ILIKE ${p}
                   OR ${NOMBRE_CLIENTE} ILIKE ${p} OR cl.telefono ILIKE ${p} OR o.numero ILIKE ${p})`);
  }
  const base = filtros.length ? filtros.join(' AND ') : 'true';
  // La ficha del cliente pide todo su historial, sin pestañas
  const where = clienteId ? base : `${WHERE_TAB[tab]} AND ${base}`;
  const [{ rows }, { rows: [conteos] }] = await Promise.all([
    db.query(`SELECT ${FILAS} FROM servicios_tecnicos s ${JOINS} WHERE ${where}
               ORDER BY ${clienteId ? 's.created_at DESC' : ORDEN_TAB[tab]} LIMIT 300`, params),
    db.query(`SELECT ${TABS.map(t => `count(*) FILTER (WHERE ${WHERE_TAB[t]})::int AS ${t}`).join(', ')}
                FROM servicios_tecnicos s ${JOINS} WHERE ${base}`, params),
  ]);
  return c.json({ tab, servicios: rows, conteos });
});

// GET /productos-cliente?cliente_id=&operacion_id= — lo que se le entregó, para elegir el producto del reclamo
serviciosTecnicos.get('/productos-cliente', async (c) => {
  const clienteId = c.req.query('cliente_id') ?? '';
  const operacionId = c.req.query('operacion_id') || null;
  if (!uuid.safeParse(clienteId).success || (operacionId && !uuid.safeParse(operacionId).success)) {
    return c.json({ error: 'Parámetros inválidos' }, 422);
  }
  const [productos, { rows: [emp] }] = await Promise.all([
    productosEntregadosDelCliente(db, clienteId, operacionId),
    db.query(`SELECT garantia_meses FROM empresa ORDER BY updated_at DESC LIMIT 1`),
  ]);
  return c.json({ productos, garantia_meses: Number(emp?.garantia_meses ?? 12) });
});

// GET /preparar?postventa_id=|remito_id=|operacion_id=|cliente_id= — datos para precargar la ficha nueva
serviciosTecnicos.get('/preparar', async (c) => {
  const [pv, rem, op, cli] = ['postventa_id', 'remito_id', 'operacion_id', 'cliente_id'].map(k => c.req.query(k) || null);
  for (const v of [pv, rem, op, cli]) if (v && !uuid.safeParse(v).success) return c.json({ error: 'Id inválido' }, 422);
  let origen: string = 'manual';
  let clienteId = cli, operacionId = op, remitoId = rem, problema: string | null = null;
  if (pv) {
    const { rows: [s] } = await db.query(
      `SELECT ps.cliente_id, ps.operacion_id, ps.remito_id, ps.comentario FROM postventa_seguimientos ps WHERE ps.id = $1`, [pv]);
    if (!s) return c.json({ error: 'Seguimiento no encontrado' }, 404);
    ({ cliente_id: clienteId, operacion_id: operacionId, remito_id: remitoId } = s);
    problema = s.comentario ?? null;
    origen = 'postventa';
  } else if (rem) {
    const { rows: [r] } = await db.query(`SELECT cliente_id, operacion_id FROM remitos WHERE id = $1`, [rem]);
    if (!r) return c.json({ error: 'Remito no encontrado' }, 404);
    clienteId = r.cliente_id; operacionId = r.operacion_id; origen = 'remito';
  } else if (op) {
    const { rows: [o] } = await db.query(`SELECT cliente_id FROM operaciones WHERE id = $1`, [op]);
    if (!o) return c.json({ error: 'Presupuesto no encontrado' }, 404);
    clienteId = o.cliente_id; origen = 'presupuesto';
  } else if (cli) {
    origen = 'cliente';
  }
  if (!clienteId) return c.json({ error: 'Falta el cliente' }, 422);
  const { rows: [cl] } = await db.query(
    `SELECT cl.id, ${NOMBRE_CLIENTE} AS nombre, cl.telefono, cl.localidad FROM clientes cl WHERE cl.id = $1`, [clienteId]);
  if (!cl) return c.json({ error: 'Cliente no encontrado' }, 404);
  const { rows: [o] } = operacionId
    ? await db.query(`SELECT numero FROM operaciones WHERE id = $1`, [operacionId]) : { rows: [] };
  return c.json({
    origen, postventa_seguimiento_id: pv, problema,
    cliente: { id: cl.id, nombre: cl.nombre ?? '—', detalle: [cl.telefono, cl.localidad].filter(Boolean).join(' · ') },
    operacion_id: operacionId, operacion_numero: o?.numero ?? null, remito_id: remitoId,
  });
});

// GET /:id — la ficha completa
serviciosTecnicos.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const { rows: [s] } = await db.query(`
    SELECT ${FILAS}, s.remito_item_id, s.operacion_item_id, s.producto_id, s.postventa_seguimiento_id,
           s.motivo_cancelacion, s.recontacto_at, s.tarea_id, uc.nombre AS creado_por
      FROM servicios_tecnicos s ${JOINS} LEFT JOIN usuarios uc ON uc.id = s.created_by
     WHERE s.id = $1`, [id]);
  if (!s) return c.json({ error: 'Servicio no encontrado' }, 404);
  const [{ rows: intervenciones }, { rows: otros }, { rows: recibos }, { rows: presupuestos }] = await Promise.all([
    db.query(`
      SELECT i.*, i.fecha::text AS fecha, COALESCE(u.nombre, i.tecnico_nombre) AS tecnico
        FROM servicio_intervenciones i LEFT JOIN usuarios u ON u.id = i.tecnico_id
       WHERE i.servicio_id = $1 ORDER BY i.orden`, [id]),
    // Otros servicios del mismo producto (por línea de remito o ítem del presupuesto)
    (s.remito_item_id || s.operacion_item_id)
      ? db.query(`
          SELECT s2.id, s2.numero, s2.tipo, s2.estado, s2.fecha_reclamo::text AS fecha_reclamo, s2.problema
            FROM servicios_tecnicos s2
           WHERE s2.id <> $1 AND ((s2.remito_item_id IS NOT NULL AND s2.remito_item_id = $2)
                               OR (s2.operacion_item_id IS NOT NULL AND s2.operacion_item_id = $3))
           ORDER BY s2.created_at DESC`, [id, s.remito_item_id, s.operacion_item_id])
      : Promise.resolve({ rows: [] }),
    db.query(`SELECT id, numero, monto_total, forma_pago, estado, fecha::text AS fecha FROM recibos WHERE servicio_tecnico_id = $1 ORDER BY created_at`, [id]),
    db.query(`SELECT id, numero, estado, precio_total FROM operaciones WHERE servicio_tecnico_id = $1 ORDER BY created_at`, [id]),
  ]);
  return c.json({ ...s, intervenciones, otros_servicios: otros, recibos, presupuestos });
});

// ── Alta y edición ─────────────────────────────────────────────────────────────────────────────

const zTexto = (max: number) => z.string().trim().max(max);
const Adjuntos = z.array(z.string().startsWith('/uploads/').max(300)).max(30);
const ServicioSchema = z.object({
  cliente_id: uuid,
  tipo: z.enum(['garantia', 'reparacion', 'mantenimiento']),
  problema: zTexto(4000).min(3, 'Contá cuál es el problema'),
  fecha_reclamo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adjuntos: Adjuntos.default([]),
  operacion_id: uuid.nullish(),
  remito_id: uuid.nullish(),
  remito_item_id: uuid.nullish(),
  producto_descripcion: zTexto(500).nullish(),
  origen: z.enum(['manual', 'cliente', 'remito', 'presupuesto', 'postventa']).default('manual'),
  postventa_seguimiento_id: uuid.nullish(),
});

/** Completa operación, remito, ítem del presupuesto y producto desde la línea de remito elegida (si hay). */
async function datosProducto(b: z.infer<typeof ServicioSchema>) {
  let operacionId = b.operacion_id ?? null, remitoId = b.remito_id ?? null;
  let operacionItemId: string | null = null, productoId: string | null = null, descripcion = b.producto_descripcion?.trim() || null;
  if (b.remito_item_id) {
    const { rows: [ri] } = await db.query(`
      SELECT ri.descripcion, ri.producto_id, ri.operacion_item_id, r.id AS remito_id, r.operacion_id, r.cliente_id
        FROM remito_items ri JOIN remitos r ON r.id = ri.remito_id WHERE ri.id = $1`, [b.remito_item_id]);
    if (!ri || ri.cliente_id !== b.cliente_id) return { error: 'El producto elegido no es de este cliente' } as const;
    remitoId = ri.remito_id; operacionId = ri.operacion_id ?? operacionId;
    operacionItemId = ri.operacion_item_id; productoId = ri.producto_id; descripcion = descripcion || ri.descripcion;
  }
  return { operacionId, remitoId, operacionItemId, productoId, descripcion } as const;
}

// POST / — abre la ficha (pendiente de coordinar) y lo deja en el historial del cliente
serviciosTecnicos.post('/', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const b = await validateBody(c, ServicioSchema);
  if (b instanceof Response) return b;
  const p = await datosProducto(b);
  if ('error' in p) return c.json({ error: p.error }, 422);
  const user = c.get('user');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const numero = await siguienteNumero(client, 'servicios_tecnicos', 'ST');
    const { rows: [s] } = await client.query(`
      INSERT INTO servicios_tecnicos (numero, cliente_id, operacion_id, remito_id, remito_item_id, operacion_item_id, producto_id,
        producto_descripcion, origen, postventa_seguimiento_id, tipo, problema, adjuntos, fecha_reclamo, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::date, $15)
      RETURNING id, numero`,
      [numero, b.cliente_id, p.operacionId, p.remitoId, b.remito_item_id ?? null, p.operacionItemId, p.productoId,
       p.descripcion, b.origen, b.postventa_seguimiento_id ?? null, b.tipo, b.problema, JSON.stringify(b.adjuntos),
       b.fecha_reclamo, user.id]);
    await client.query(`INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by) VALUES ($1, $2, $3, $4, $5)`,
      [b.cliente_id, p.operacionId, b.tipo === 'garantia' ? 'garantia' : 'reclamo',
       `${TIPO_SERVICIO_LABEL[b.tipo]} ${numero} abierto${p.descripcion ? ` (${p.descripcion})` : ''}: ${b.problema}`, user.id]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: s.id, entidad_numero: s.numero, accion: 'crear',
      detalle: `${TIPO_SERVICIO_LABEL[b.tipo]}: ${b.problema.slice(0, 120)}` });
    return c.json(s, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PUT /:id — corrige los datos del reclamo (no el estado ni la agenda)
serviciosTecnicos.put('/:id', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, ServicioSchema);
  if (b instanceof Response) return b;
  const { rows: [actual] } = await db.query(`SELECT cliente_id, estado FROM servicios_tecnicos WHERE id = $1`, [id]);
  if (!actual) return c.json({ error: 'Servicio no encontrado' }, 404);
  if (actual.cliente_id !== b.cliente_id) return c.json({ error: 'No se puede cambiar el cliente de un servicio' }, 422);
  const p = await datosProducto(b);
  if ('error' in p) return c.json({ error: p.error }, 422);
  await db.query(`
    UPDATE servicios_tecnicos SET operacion_id = $2, remito_id = $3, remito_item_id = $4, operacion_item_id = $5, producto_id = $6,
      producto_descripcion = $7, tipo = $8, problema = $9, adjuntos = $10::jsonb, fecha_reclamo = $11::date, updated_at = now()
    WHERE id = $1`,
    [id, p.operacionId, p.remitoId, b.remito_item_id ?? null, p.operacionItemId, p.productoId, p.descripcion,
     b.tipo, b.problema, JSON.stringify(b.adjuntos), b.fecha_reclamo]);
  await sincronizarTareaServicio(db, id);   // la descripción de la tarea lleva tipo y producto
  return c.json({ ok: true });
});

const ProgramarSchema = z.object({
  responsable_id: uuid.nullish(),
  responsable_nombre: zTexto(120).nullish(),
  fecha_visita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  hora_visita: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
});

// PATCH /:id/programar — responsable y visita. Con fecha → "visita programada" y tarea en la agenda; sin fecha →
// vuelve a "pendiente de coordinar" (si estaba programada) y la tarea se quita.
serviciosTecnicos.patch('/:id/programar', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, ProgramarSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`SELECT numero, estado FROM servicios_tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'Servicio no encontrado' }, 404); }
    if (['finalizado', 'cancelado'].includes(s.estado)) {
      await client.query('ROLLBACK');
      return c.json({ error: 'El servicio está cerrado: reabrilo para programar otra visita' }, 409);
    }
    const estado: EstadoServicio = b.fecha_visita ? 'visita_programada'
      : s.estado === 'visita_programada' ? 'pendiente_coordinar' : s.estado;
    await client.query(`
      UPDATE servicios_tecnicos SET responsable_id = $2, responsable_nombre = $3, fecha_visita = $4::date,
        hora_visita = $5::time, estado = $6, updated_at = now() WHERE id = $1`,
      [id, b.responsable_id ?? null, b.responsable_id ? null : (b.responsable_nombre?.trim() || null),
       b.fecha_visita ?? null, b.fecha_visita ? (b.hora_visita ?? null) : null, estado]);
    await sincronizarTareaServicio(client, id);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: s.numero, accion: 'programar',
      detalle: b.fecha_visita ? `Visita el ${b.fecha_visita}${b.hora_visita ? ` ${b.hora_visita}` : ''}` : 'Sin fecha de visita' });
    return c.json({ ok: true, estado });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Cambios de estado a mano. "Visita programada" sale de /programar y "cancelado" de /cancelar.
const TRANSICIONES: Record<EstadoServicio, EstadoServicio[]> = {
  pendiente_coordinar: ['en_proceso', 'pendiente_repuesto', 'finalizado'],
  visita_programada:   ['en_proceso', 'pendiente_repuesto', 'pendiente_coordinar', 'finalizado'],
  en_proceso:          ['pendiente_repuesto', 'pendiente_coordinar', 'finalizado'],
  pendiente_repuesto:  ['pendiente_coordinar', 'en_proceso', 'finalizado'],
  finalizado:          ['pendiente_coordinar'],
  cancelado:           ['pendiente_coordinar'],
};
const EstadoSchema = z.object({ estado: z.enum(ESTADOS_SERVICIO), nota: zTexto(500).nullish() });

serviciosTecnicos.patch('/:id/estado', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, EstadoSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`SELECT numero, estado, cliente_id FROM servicios_tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'Servicio no encontrado' }, 404); }
    if (!TRANSICIONES[s.estado as EstadoServicio].includes(b.estado)) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Ese cambio de estado no corresponde' }, 409);
    }
    const reabre = ['finalizado', 'cancelado'].includes(s.estado);
    await client.query(`
      UPDATE servicios_tecnicos SET estado = $2, updated_at = now(),
        finalizado_at = CASE WHEN $2 = 'finalizado' THEN now() WHEN $3 THEN NULL ELSE finalizado_at END,
        motivo_cancelacion = CASE WHEN $3 THEN NULL ELSE motivo_cancelacion END,
        fecha_visita = CASE WHEN $2 = 'pendiente_coordinar' THEN NULL ELSE fecha_visita END,
        hora_visita = CASE WHEN $2 = 'pendiente_coordinar' THEN NULL ELSE hora_visita END
      WHERE id = $1`, [id, b.estado, reabre]);
    await sincronizarTareaServicio(client, id);
    if (reabre || b.estado === 'finalizado') {
      await client.query(`INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by) VALUES ($1, 'nota', $2, $3)`,
        [s.cliente_id, `Servicio ${s.numero} ${reabre ? 'reabierto' : 'finalizado'}${b.nota ? `: ${b.nota}` : ''}`, c.get('user').id]);
    }
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: s.numero, accion: 'cambio_estado',
      detalle: `${s.estado} → ${b.estado}${b.nota ? ` (${b.nota})` : ''}` });
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const CancelarSchema = z.object({ motivo: zTexto(500).min(3, 'Indicá el motivo') });

serviciosTecnicos.patch('/:id/cancelar', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, CancelarSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`
      UPDATE servicios_tecnicos SET estado = 'cancelado', motivo_cancelacion = $2, updated_at = now()
       WHERE id = $1 AND estado NOT IN ('finalizado', 'cancelado') RETURNING numero, cliente_id`, [id, b.motivo]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'El servicio ya está cerrado' }, 409); }
    await sincronizarTareaServicio(client, id);
    await client.query(`INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by) VALUES ($1, 'nota', $2, $3)`,
      [s.cliente_id, `Servicio ${s.numero} cancelado: ${b.motivo}`, c.get('user').id]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: s.numero, accion: 'cancelar', detalle: b.motivo });
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
