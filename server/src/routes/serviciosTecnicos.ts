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
import { generarPDFServicio } from '../lib/pdf.js';
import { enviarWhatsappPdf } from '../lib/whatsapp.js';
import {
  ESTADOS_SERVICIO, TIPO_SERVICIO_LABEL, productosEntregadosDelCliente, sincronizarTareaServicio, programarRecontacto,
  anularRecontacto, type EstadoServicio,
} from '../lib/serviciosTecnicos.js';
import { nextNumeroRecibo } from './recibos.js';
import { nextNumeroCompra, recalcularEstadoCalidad, actualizarCierreTotal } from '../lib/compras.js';
import { TIPOS_INCIDENCIA } from '../lib/schemas.js';
import { FORMA_PAGO_SALDO_FAVOR } from '../lib/saldoFavor.js';

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
  const [{ rows: intervenciones }, { rows: otros }, { rows: recibos }, { rows: presupuestos }, { rows: reclamos }] = await Promise.all([
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
    // Reclamos al proveedor: incidencias sobre la OC original o solicitudes de repuesto
    db.query(`
      SELECT 'incidencia' AS clase, i.id, i.numero, i.estado, i.tipo, i.descripcion, i.solucion, i.respuesta_proveedor, i.created_at,
             p.id AS pedido_id, p.numero AS pedido_numero, pr.nombre AS proveedor
        FROM compras_incidencias i JOIN pedidos p ON p.id = i.pedido_id LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
       WHERE i.servicio_tecnico_id = $1
      UNION ALL
      SELECT 'solicitud', sc.id, sc.numero, sc.estado, NULL, sc.observaciones, NULL, NULL, sc.created_at, NULL, NULL, NULL
        FROM compras_solicitudes sc WHERE sc.servicio_tecnico_id = $1
      ORDER BY created_at`, [id]),
  ]);
  return c.json({ ...s, intervenciones, otros_servicios: otros, recibos, presupuestos, reclamos });
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
    if (b.estado === 'finalizado') await programarRecontacto(client, id, c.get('user').id);
    if (reabre) await anularRecontacto(client, id);
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

// ── Visitas del técnico (intervenciones) ────────────────────────────────────────────────────────

const TRABAJO_LABEL: Record<string, string> = {
  ajuste: 'Ajuste', reparacion: 'Reparación', cambio_pieza: 'Cambio de pieza', reemplazo_completo: 'Reemplazo completo', otro: 'Otro',
};
const RESULTADO_LABEL: Record<string, string> = {
  resuelto: 'Problema resuelto', nueva_visita: 'Requiere una nueva visita', pendiente_repuesto: 'Pendiente de repuesto',
};
const Fotos = z.array(z.string().startsWith('/uploads/').max(300)).max(20);
const IntervencionSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tecnico_id: uuid.nullish(),
  tecnico_nombre: zTexto(120).nullish(),
  problema_encontrado: zTexto(4000).nullish(),
  trabajo_tipo: z.enum(['ajuste', 'reparacion', 'cambio_pieza', 'reemplazo_completo', 'otro']),
  trabajo_detalle: zTexto(4000).min(3, 'Contá qué trabajo se hizo'),
  materiales: z.array(z.object({ descripcion: zTexto(200).min(1), cantidad: z.number().positive().max(100000) })).max(50).default([]),
  fotos_antes: Fotos.default([]),
  fotos_despues: Fotos.default([]),
  observaciones: zTexto(4000).nullish(),
  pendientes: zTexto(4000).nullish(),
  con_cargo: z.boolean(),
  resultado: z.enum(['resuelto', 'nueva_visita', 'pendiente_repuesto']),
});
type IntervencionBody = z.infer<typeof IntervencionSchema>;

const valoresIntervencion = (b: IntervencionBody) => [
  b.fecha, b.tecnico_id ?? null, b.tecnico_id ? null : (b.tecnico_nombre?.trim() || null), b.problema_encontrado?.trim() || null,
  b.trabajo_tipo, b.trabajo_detalle, JSON.stringify(b.materiales), JSON.stringify(b.fotos_antes), JSON.stringify(b.fotos_despues),
  b.observaciones?.trim() || null, b.pendientes?.trim() || null, b.con_cargo, b.resultado,
];

/**
 * Después de cargar la visita: la tarea de la agenda queda hecha (y se suelta, así la próxima visita crea otra) y el
 * servicio pasa a "en proceso" si se resolvió (falta la firma) o a "repuesto o nueva visita" si no.
 */
async function aplicarResultadoVisita(q: { query: typeof db.query }, servicioId: string, resultado: string) {
  const { rows: [s] } = await q.query(`SELECT tarea_id FROM servicios_tecnicos WHERE id = $1`, [servicioId]);
  if (s?.tarea_id) {
    await q.query(`UPDATE tareas SET completada = true, completada_at = COALESCE(completada_at, now()) WHERE id = $1`, [s.tarea_id]);
    await q.query(`DELETE FROM tarea_recordatorios WHERE tarea_id = $1`, [s.tarea_id]);
  }
  await q.query(`
    UPDATE servicios_tecnicos SET estado = $2, tarea_id = NULL, fecha_visita = NULL, hora_visita = NULL, updated_at = now()
     WHERE id = $1`, [servicioId, resultado === 'resuelto' ? 'en_proceso' : 'pendiente_repuesto']);
}

// POST /:id/intervenciones — lo que hizo el técnico en una visita
serviciosTecnicos.post('/:id/intervenciones', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, IntervencionSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`SELECT numero, estado FROM servicios_tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'Servicio no encontrado' }, 404); }
    if (['finalizado', 'cancelado'].includes(s.estado)) {
      await client.query('ROLLBACK');
      return c.json({ error: 'El servicio está cerrado: reabrilo para cargar otra visita' }, 409);
    }
    const { rows: [i] } = await client.query(`
      INSERT INTO servicio_intervenciones (servicio_id, orden, fecha, tecnico_id, tecnico_nombre, problema_encontrado, trabajo_tipo,
        trabajo_detalle, materiales, fotos_antes, fotos_despues, observaciones, pendientes, con_cargo, resultado, created_by)
      SELECT $1, COALESCE(MAX(orden), 0) + 1, $2::date, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15
        FROM servicio_intervenciones WHERE servicio_id = $1
      RETURNING id, orden`, [id, ...valoresIntervencion(b), c.get('user').id]);
    await aplicarResultadoVisita(client, id, b.resultado);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: s.numero, accion: 'editar',
      detalle: `Visita ${i.orden}: ${TRABAJO_LABEL[b.trabajo_tipo]} — ${RESULTADO_LABEL[b.resultado]}` });
    return c.json(i, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/** La visita del servicio, solo si todavía no se firmó (firmada no se toca: es el comprobante). */
async function intervencionEditable(q: { query: typeof db.query }, servicioId: string, iid: string) {
  const { rows: [i] } = await q.query(`
    SELECT i.id, i.orden, i.firmada_at, s.numero, s.estado,
           (SELECT MAX(orden) FROM servicio_intervenciones WHERE servicio_id = s.id) AS ultima
      FROM servicio_intervenciones i JOIN servicios_tecnicos s ON s.id = i.servicio_id
     WHERE i.id = $1 AND i.servicio_id = $2 FOR UPDATE OF i, s`, [iid, servicioId]);
  if (!i) return { error: 'Visita no encontrada', status: 404 as const };
  if (i.firmada_at) return { error: 'La visita ya está firmada por el cliente: no se puede modificar', status: 409 as const };
  return { i };
}

serviciosTecnicos.put('/:id/intervenciones/:iid', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const { id, iid } = c.req.param();
  if (!uuid.safeParse(id).success || !uuid.safeParse(iid).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, IntervencionSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = await intervencionEditable(client, id, iid);
    if ('error' in r) { await client.query('ROLLBACK'); return c.json({ error: r.error }, r.status); }
    await client.query(`
      UPDATE servicio_intervenciones SET fecha = $2::date, tecnico_id = $3, tecnico_nombre = $4, problema_encontrado = $5,
        trabajo_tipo = $6, trabajo_detalle = $7, materiales = $8::jsonb, fotos_antes = $9::jsonb, fotos_despues = $10::jsonb,
        observaciones = $11, pendientes = $12, con_cargo = $13, resultado = $14, updated_at = now()
      WHERE id = $1`, [iid, ...valoresIntervencion(b)]);
    // Si es la última visita y el servicio sigue abierto, el estado acompaña al resultado corregido
    if (r.i.orden === r.i.ultima && ['en_proceso', 'pendiente_repuesto'].includes(r.i.estado)) {
      await client.query(`UPDATE servicios_tecnicos SET estado = $2, updated_at = now() WHERE id = $1`,
        [id, b.resultado === 'resuelto' ? 'en_proceso' : 'pendiente_repuesto']);
    }
    await client.query('COMMIT');
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

serviciosTecnicos.delete('/:id/intervenciones/:iid', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const { id, iid } = c.req.param();
  if (!uuid.safeParse(id).success || !uuid.safeParse(iid).success) return c.json({ error: 'Id inválido' }, 422);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = await intervencionEditable(client, id, iid);
    if ('error' in r) { await client.query('ROLLBACK'); return c.json({ error: r.error }, r.status); }
    if (r.i.orden !== r.i.ultima) { await client.query('ROLLBACK'); return c.json({ error: 'Solo se puede borrar la última visita' }, 409); }
    await client.query(`DELETE FROM servicio_intervenciones WHERE id = $1`, [iid]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: r.i.numero, accion: 'eliminar', detalle: `Visita ${r.i.orden} (sin firmar)` });
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const FirmaSchema = z.object({
  firma_url: z.string().startsWith('/uploads/').max(300).nullish(),
  sin_firma_motivo: zTexto(300).nullish(),
  recibio_nombre: zTexto(120).min(2, 'Indicá quién recibió el servicio'),
  recibio_dni: z.string().regex(/^\d{7,11}$/, 'DNI inválido').nullish(),
  conformidad: z.enum(['conforme', 'con_observaciones']),
  conformidad_obs: zTexto(2000).nullish(),
}).refine(b => !!b.firma_url || !!b.sin_firma_motivo?.trim(), { message: 'Falta la firma o el motivo por el que no firma' })
  .refine(b => b.conformidad === 'conforme' || !!b.conformidad_obs?.trim(), { message: 'Escribí las observaciones del cliente' });

// POST /:id/intervenciones/:iid/firmar — conformidad del cliente en el celular. Deja constancia del servicio recibido
// (no impide reclamos futuros). Si la visita resolvió el problema, el servicio queda finalizado.
serviciosTecnicos.post('/:id/intervenciones/:iid/firmar', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const { id, iid } = c.req.param();
  if (!uuid.safeParse(id).success || !uuid.safeParse(iid).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, FirmaSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = await intervencionEditable(client, id, iid);
    if ('error' in r) { await client.query('ROLLBACK'); return c.json({ error: r.error }, r.status); }
    const { rows: [i] } = await client.query(`
      UPDATE servicio_intervenciones SET firma_url = $2, sin_firma_motivo = $3, recibio_nombre = $4, recibio_dni = $5,
        conformidad = $6, conformidad_obs = $7, firmada_at = now(), updated_at = now()
      WHERE id = $1 RETURNING resultado, orden`,
      [iid, b.firma_url ?? null, b.firma_url ? null : b.sin_firma_motivo!.trim(), b.recibio_nombre, b.recibio_dni ?? null,
       b.conformidad, b.conformidad === 'conforme' ? null : b.conformidad_obs!.trim()]);
    const { rows: [s] } = await client.query(`SELECT cliente_id, operacion_id, estado FROM servicios_tecnicos WHERE id = $1`, [id]);
    const finaliza = i.resultado === 'resuelto' && r.i.orden === r.i.ultima && !['finalizado', 'cancelado'].includes(s.estado);
    if (finaliza) {
      await client.query(`UPDATE servicios_tecnicos SET estado = 'finalizado', finalizado_at = now(), updated_at = now() WHERE id = $1`, [id]);
      await sincronizarTareaServicio(client, id);
      await programarRecontacto(client, id, c.get('user').id);
    }
    await client.query(`INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by) VALUES ($1, $2, 'nota', $3, $4)`,
      [s.cliente_id, s.operacion_id,
       `Servicio ${r.i.numero}, visita ${i.orden}: ${b.conformidad === 'conforme' ? 'recibido conforme' : `recibido con observaciones (${b.conformidad_obs})`}`
         + ` — ${b.firma_url ? `firmó ${b.recibio_nombre}` : `sin firma: ${b.sin_firma_motivo}`}${finaliza ? '. Servicio finalizado.' : ''}`,
       c.get('user').id]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: r.i.numero, accion: 'firmar',
      detalle: `Visita ${i.orden}: ${b.conformidad === 'conforme' ? 'conforme' : 'con observaciones'}` });
    return c.json({ ok: true, finalizado: finaliza });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/** Arma el PDF de la ficha de una visita, siempre desde la base. */
async function pdfDeVisita(servicioId: string, iid: string) {
  const { rows: [d] } = await db.query(`
    SELECT s.numero, s.tipo, s.problema, s.producto_descripcion, o.numero AS operacion_numero, r.numero AS remito_numero,
           ${NOMBRE_CLIENTE} AS cliente_nombre, cl.telefono, cl.documento_nro, cl.cuit, cl.direccion, cl.localidad,
           i.*, i.fecha::text AS fecha, COALESCE(u.nombre, i.tecnico_nombre) AS tecnico,
           (SELECT count(*)::int FROM servicio_intervenciones WHERE servicio_id = s.id) AS visitas
      FROM servicio_intervenciones i
      JOIN servicios_tecnicos s ON s.id = i.servicio_id
      JOIN clientes cl ON cl.id = s.cliente_id
      LEFT JOIN operaciones o ON o.id = s.operacion_id
      LEFT JOIN remitos r ON r.id = s.remito_id
      LEFT JOIN usuarios u ON u.id = i.tecnico_id
     WHERE i.id = $1 AND i.servicio_id = $2`, [iid, servicioId]);
  if (!d) return null;
  const { rows: [empresa] } = await db.query(`SELECT nombre, cuit, telefono, email, direccion FROM empresa ORDER BY updated_at DESC LIMIT 1`);
  const pdf = await generarPDFServicio({
    numero: d.numero, tipo: TIPO_SERVICIO_LABEL[d.tipo] ?? d.tipo, visita: d.orden, visitas: d.visitas, fecha: d.fecha, tecnico: d.tecnico,
    cliente: { nombre: d.cliente_nombre ?? '—', documento: d.cuit || d.documento_nro || null, telefono: d.telefono,
      direccion: [d.direccion, d.localidad].filter(Boolean).join(', ') || null },
    producto: d.producto_descripcion,
    referencias: [d.operacion_numero?.replace(/^OP-/, 'PRO-'), d.remito_numero ? `Remito ${d.remito_numero}` : null].filter(Boolean),
    problema_informado: d.problema, problema_encontrado: d.problema_encontrado,
    trabajo_tipo: TRABAJO_LABEL[d.trabajo_tipo] ?? d.trabajo_tipo, trabajo_detalle: d.trabajo_detalle, materiales: d.materiales ?? [],
    fotos_antes: d.fotos_antes ?? [], fotos_despues: d.fotos_despues ?? [], observaciones: d.observaciones, pendientes: d.pendientes,
    con_cargo: d.con_cargo, resultado: RESULTADO_LABEL[d.resultado] ?? d.resultado,
    firma_url: d.firma_url, recibio_nombre: d.recibio_nombre, recibio_dni: d.recibio_dni, conformidad: d.conformidad,
    conformidad_obs: d.conformidad_obs, sin_firma_motivo: d.sin_firma_motivo, firmada_at: d.firmada_at,
  }, empresa ?? { nombre: '', cuit: null, telefono: null, email: null, direccion: null });
  return { pdf, d, empresa };
}

// GET /:id/intervenciones/:iid/pdf — la ficha de servicio de esa visita
serviciosTecnicos.get('/:id/intervenciones/:iid/pdf', async (c) => {
  const { id, iid } = c.req.param();
  if (!uuid.safeParse(id).success || !uuid.safeParse(iid).success) return c.json({ error: 'Id inválido' }, 422);
  const r = await pdfDeVisita(id, iid);
  if (!r) return c.json({ error: 'Visita no encontrada' }, 404);
  return new Response(new Uint8Array(r.pdf), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${r.d.numero}-visita-${r.d.orden}.pdf"`,
  } });
});

const EnviarSchema = z.object({ telefono: zTexto(30).nullish() });

// POST /:id/intervenciones/:iid/enviar-whatsapp — manda la ficha firmada al cliente
serviciosTecnicos.post('/:id/intervenciones/:iid/enviar-whatsapp', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const { id, iid } = c.req.param();
  if (!uuid.safeParse(id).success || !uuid.safeParse(iid).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, EnviarSchema);
  if (b instanceof Response) return b;
  const { rows: [v] } = await db.query(`SELECT firmada_at FROM servicio_intervenciones WHERE id = $1 AND servicio_id = $2`, [iid, id]);
  if (!v) return c.json({ error: 'Visita no encontrada' }, 404);
  if (!v.firmada_at) return c.json({ error: 'Primero tiene que firmar el cliente' }, 409);
  const r = await pdfDeVisita(id, iid);
  if (!r) return c.json({ error: 'Visita no encontrada' }, 404);
  const telefono = b.telefono?.trim() || r.d.telefono;
  if (!telefono) return c.json({ error: 'El cliente no tiene teléfono cargado' }, 422);
  const caption = `Hola${r.d.cliente_nombre ? ` ${String(r.d.cliente_nombre).split(',').pop()!.trim()}` : ''}, te enviamos la ficha del servicio `
    + `${r.d.numero} (visita del ${String(r.d.fecha).split('-').reverse().join('/')}).${r.empresa?.nombre ? ` ${r.empresa.nombre}` : ''}`;
  const env = await enviarWhatsappPdf(telefono, r.pdf, `${r.d.numero}-visita-${r.d.orden}.pdf`, caption);
  if (!env.ok) return c.json({ error: env.error }, env.status as 422 | 500 | 502);
  const { rows: [s] } = await db.query(`
    WITH u AS (UPDATE servicio_intervenciones SET enviada_whatsapp_at = now() WHERE id = $1 RETURNING servicio_id)
    SELECT st.cliente_id, st.operacion_id FROM servicios_tecnicos st JOIN u ON u.servicio_id = st.id`, [iid]);
  await db.query(`INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by) VALUES ($1, $2, 'whatsapp', $3, $4)`,
    [s.cliente_id, s.operacion_id, `Ficha del servicio ${r.d.numero} (visita ${r.d.orden}) enviada por WhatsApp`, c.get('user').id]);
  return c.json({ ok: true });
});

// ── Cobro, reclamo al proveedor y consulta posterior ───────────────────────────────────────────

const CobrarSchema = z.object({
  monto: z.number().positive('El importe debe ser mayor a 0').max(1e10),
  forma_pago: zTexto(150).min(1, 'Elegí la forma de pago').refine(f => f !== FORMA_PAGO_SALDO_FAVOR, 'El saldo a favor se usa desde Recibos'),
  referencia_pago: zTexto(200).nullish(),
  concepto: zTexto(300).nullish(),
});

// POST /:id/cobrar — recibo directo por un trabajo simple (sin presupuesto). Queda vinculado al servicio y en la cuenta
// del cliente como cualquier recibo; si lleva repuestos o hay que pasar precio antes, se arma un presupuesto.
serviciosTecnicos.post('/:id/cobrar', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, CobrarSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`SELECT numero, cliente_id, tipo, estado, producto_descripcion FROM servicios_tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'Servicio no encontrado' }, 404); }
    if (s.estado === 'cancelado') { await client.query('ROLLBACK'); return c.json({ error: 'El servicio está cancelado' }, 409); }
    const numero = await nextNumeroRecibo(client);
    const concepto = b.concepto?.trim() || `Servicio técnico ${s.numero}${s.producto_descripcion ? ` — ${s.producto_descripcion}` : ''}`;
    const { rows: [rec] } = await client.query(`
      INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, forma_pago, referencia_pago, concepto,
                           monto_lista, monto_descuento, descuento_pct, created_by, servicio_tecnico_id)
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $3, 0, 0, $7, $8) RETURNING id, numero, monto_total`,
      [numero, s.cliente_id, b.monto, b.forma_pago, b.referencia_pago?.trim() || null, concepto, c.get('user').id, id]);
    await client.query(`INSERT INTO recibo_items (recibo_id, descripcion, cantidad, monto, orden) VALUES ($1, $2, 1, $3, 0)`,
      [rec.id, concepto, b.monto]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'recibo', entidad_id: rec.id, entidad_numero: rec.numero, accion: 'crear', detalle: `Cobro del servicio ${s.numero}` });
    return c.json(rec, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const ReclamoSchema = z.object({
  tipo: z.enum(TIPOS_INCIDENCIA),
  descripcion: zTexto(2000).min(3, 'Describí la falla'),
  cantidad: z.number().positive().max(10000).default(1),
});

// POST /:id/reclamo-proveedor — si el producto salió de una orden de compra, abre el reclamo (REC-) sobre esa línea y
// sigue el circuito de reclamos de Compras; si no (stock, fabricación propia, producto ajeno), crea una solicitud de
// compra de garantía para pedir el repuesto. Las fotos y videos del servicio viajan con el reclamo.
serviciosTecnicos.post('/:id/reclamo-proveedor', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, ReclamoSchema);
  if (b instanceof Response) return b;
  const user = c.get('user');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`
      SELECT numero, cliente_id, operacion_id, operacion_item_id, producto_descripcion, adjuntos, estado
        FROM servicios_tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'Servicio no encontrado' }, 404); }
    if (['finalizado', 'cancelado'].includes(s.estado)) {
      await client.query('ROLLBACK');
      return c.json({ error: 'El servicio está cerrado: reabrilo para reclamar al proveedor' }, 409);
    }
    const detalle = `Servicio ${s.numero}: ${b.descripcion}`;
    const { rows: [pi] } = s.operacion_item_id ? await client.query(`
      SELECT pi.id, pi.pedido_id FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
       WHERE pi.operacion_item_id = $1 AND p.estado_logistica <> 'cancelada' AND NOT COALESCE(pi.es_reposicion_reclamo, false)
       ORDER BY p.created_at DESC LIMIT 1`, [s.operacion_item_id]) : { rows: [] };

    let resultado: { clase: 'incidencia' | 'solicitud'; id: string; numero: string };
    if (pi) {
      const numero = await nextNumeroCompra(client, 'REC');
      const { rows: [inc] } = await client.query(`
        INSERT INTO compras_incidencias (numero, pedido_id, pedido_item_id, tipo, cantidad_afectada, descripcion, adjuntos, created_by, servicio_tecnico_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) RETURNING id, numero`,
        [numero, pi.pedido_id, pi.id, b.tipo, b.cantidad, detalle, JSON.stringify(s.adjuntos ?? []), user.id, id]);
      await recalcularEstadoCalidad(client, pi.pedido_id);
      await actualizarCierreTotal(client, pi.pedido_id);
      resultado = { clase: 'incidencia', ...inc };
    } else {
      const numero = await nextNumeroCompra(client, 'SC');
      const { rows: [sc] } = await client.query(`
        INSERT INTO compras_solicitudes (numero, origen, operacion_id, cliente_id, tipo_producto, observaciones, adjuntos, created_by, servicio_tecnico_id)
        VALUES ($1, 'garantia', $2, $3, 'otro', $4, $5::jsonb, $6, $7) RETURNING id, numero`,
        [numero, s.operacion_id, s.cliente_id, detalle, JSON.stringify(s.adjuntos ?? []), user.id, id]);
      await client.query(`
        INSERT INTO compras_solicitud_items (solicitud_id, orden, descripcion, cantidad, adjuntos, operacion_item_id)
        VALUES ($1, 0, $2, $3, $4::jsonb, $5)`,
        [sc.id, `Repuesto: ${s.producto_descripcion ?? b.descripcion}`.slice(0, 500), b.cantidad, JSON.stringify(s.adjuntos ?? []), s.operacion_item_id]);
      resultado = { clase: 'solicitud', ...sc };
    }
    await client.query(`UPDATE servicios_tecnicos SET estado = 'pendiente_repuesto', fecha_visita = NULL, hora_visita = NULL, updated_at = now() WHERE id = $1`, [id]);
    await sincronizarTareaServicio(client, id);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: s.numero, accion: 'editar',
      detalle: resultado.clase === 'incidencia' ? `Reclamo al proveedor ${resultado.numero}` : `Solicitud de repuesto ${resultado.numero}` });
    return c.json(resultado, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const RecontactoSchema = z.object({ resultado: z.enum(['funciona', 'sigue_con_problemas']), nota: zTexto(500).nullish() });

// PATCH /:id/recontacto — lo que dijo el cliente al volver a consultarlo. Si sigue con problemas, el servicio se reabre.
serviciosTecnicos.patch('/:id/recontacto', async (c) => {
  if (!noConsulta(c)) return c.json(SOLO_CONSULTA, 403);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) return c.json({ error: 'Id inválido' }, 422);
  const b = await validateBody(c, RecontactoSchema);
  if (b instanceof Response) return b;
  const user = c.get('user');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(`
      SELECT numero, cliente_id, estado, recontacto_tarea_id FROM servicios_tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    if (!s) { await client.query('ROLLBACK'); return c.json({ error: 'Servicio no encontrado' }, 404); }
    if (s.estado !== 'finalizado') { await client.query('ROLLBACK'); return c.json({ error: 'El servicio no está finalizado' }, 409); }
    if (s.recontacto_tarea_id) {
      await client.query(`UPDATE tareas SET completada = true, completada_at = COALESCE(completada_at, now()), completada_by = COALESCE(completada_by, $2) WHERE id = $1`,
        [s.recontacto_tarea_id, user.id]);
    }
    await client.query(`UPDATE servicios_tecnicos SET recontacto_resultado = $2, recontacto_at = now(), updated_at = now() WHERE id = $1`, [id, b.resultado]);
    if (b.resultado === 'sigue_con_problemas') {
      await client.query(`UPDATE servicios_tecnicos SET estado = 'pendiente_coordinar', finalizado_at = NULL WHERE id = $1`, [id]);
    }
    await client.query(`INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by) VALUES ($1, $2, $3, $4)`,
      [s.cliente_id, b.resultado === 'funciona' ? 'nota' : 'reclamo',
       `Servicio ${s.numero}: ${b.resultado === 'funciona' ? 'el cliente confirma que funciona bien' : 'el cliente sigue con problemas, se reabre'}${b.nota ? ` (${b.nota})` : ''}`, user.id]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'servicio_tecnico', entidad_id: id, entidad_numero: s.numero, accion: 'cambio_estado',
      detalle: b.resultado === 'funciona' ? 'Consulta posterior: funciona' : 'Consulta posterior: sigue con problemas (reabierto)' });
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
