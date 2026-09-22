/**
 * Módulo Compras y Proveedores — Etapa 1: Solicitud (SC) → Cotización (PC) → Orden de compra (OC).
 * Ver docs/compras-plan.md. La OC es la tabla `pedidos` extendida; `routes/pedidos.ts`
 * sigue sirviendo el flujo viejo (Presupuestos, NuevoRecibo, NuevoRemito, Operaciones).
 *
 * Orden de registro: Hono matchea en orden, así que todas las rutas específicas
 * (`/tablero`, `/solicitudes/preparar`, …) van antes que sus `/:id`.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { PoolClient } from 'pg';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import {
  SolicitudCompraSchema, SolicitudEstadoSchema, CotizacionCrearSchema, CotizacionRespuestaSchema,
  CotizacionAdjudicarSchema, CotizacionCerrarSchema, OrdenDirectaSchema, OrdenConsolidarSchema,
  OrdenEditarSchema, EnviarCompraSchema,
} from '../lib/schemas.js';
import {
  nextNumeroCompra, armarItemDesde, calcularTotales, recalcularTotalesOC, sincronizarEstadoLegacy,
  recalcularEstadoSolicitud, empresaActual, resumenEspecificaciones,
} from '../lib/compras.js';
import { sqlItemsTotal, sqlItemsPendientes, sqlItemsCubiertos } from '../lib/coverage.js';
import { registrarActividad } from '../lib/actividad.js';
import { generarPDFCompra, type CompraPDF, type CompraItemPDF } from '../lib/pdf.js';
import { enviarWhatsappPdf } from '../lib/whatsapp.js';
import { sendCompra, emailDisponible } from '../email.js';

const compras = new Hono();

// Filas de pg: se accede por clave dinámica en los armados de PDF/mensajes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const CLIENTE_JSON = (alias: string) => `json_build_object(
  'id', ${alias}.id, 'nombre', ${alias}.nombre, 'apellido', ${alias}.apellido,
  'razon_social', ${alias}.razon_social, 'tipo_persona', ${alias}.tipo_persona, 'telefono', ${alias}.telefono)`;

const PROVEEDOR_JSON = (alias: string) => `json_build_object(
  'id', ${alias}.id, 'nombre', ${alias}.nombre, 'telefono', ${alias}.telefono,
  'email', ${alias}.email, 'contacto', ${alias}.contacto, 'color', ${alias}.color)`;

const fmtMonto = (n: number) =>
  Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

const fmtFechaAR = (d: unknown) => {
  if (!d) return '';
  const iso = d instanceof Date ? d.toISOString() : String(d);
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR');
};

async function enTransaccion<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Error de negocio que se devuelve como JSON con su status (409/422) en vez de 500. */
class ErrorNegocio extends Error {
  constructor(public status: 400 | 404 | 409 | 422, message: string) { super(message); }
}

function manejarErrorNegocio(c: Context, err: unknown) {
  if (err instanceof ErrorNegocio) return c.json({ error: err.message }, err.status);
  throw err;
}

// ═════════════════════════════════════════════════════════════════════════════
// SQL compartido
// ═════════════════════════════════════════════════════════════════════════════

const SOLICITUD_SQL = `
  SELECT sc.*,
    CASE WHEN c.id IS NOT NULL THEN ${CLIENTE_JSON('c')} ELSE NULL END AS cliente,
    CASE WHEN o.id IS NOT NULL THEN json_build_object('id', o.id, 'numero', o.numero, 'estado', o.estado) ELSE NULL END AS operacion,
    CASE WHEN vt.id IS NOT NULL THEN json_build_object('id', vt.id, 'numero', vt.numero) ELSE NULL END AS visita_tecnica,
    CASE WHEN prov.id IS NOT NULL THEN ${PROVEEDOR_JSON('prov')} ELSE NULL END AS proveedor_sugerido,
    (SELECT COUNT(*)::int FROM compras_solicitud_items i WHERE i.solicitud_id = sc.id) AS items_count,
    (SELECT COUNT(*)::int FROM compras_solicitud_items i WHERE i.solicitud_id = sc.id AND i.estado = 'pendiente') AS items_pendientes,
    (SELECT COALESCE(json_agg(json_build_object('id', pc.id, 'numero', pc.numero, 'estado', pc.estado) ORDER BY pc.created_at), '[]'::json)
       FROM compras_cotizaciones pc WHERE pc.solicitud_id = sc.id) AS cotizaciones,
    (SELECT COALESCE(json_agg(DISTINCT jsonb_build_object('id', p.id, 'numero', p.numero, 'estado_logistica', p.estado_logistica)), '[]'::json)
       FROM pedidos p
       WHERE p.estado <> 'cancelado' AND (p.solicitud_id = sc.id OR EXISTS (
         SELECT 1 FROM pedido_items pi JOIN compras_solicitud_items si ON si.id = pi.solicitud_item_id
         WHERE pi.pedido_id = p.id AND si.solicitud_id = sc.id))) AS ordenes,
    (SELECT json_agg(json_build_object('descripcion', i.descripcion, 'cantidad', i.cantidad) ORDER BY i.orden)
       FROM compras_solicitud_items i WHERE i.solicitud_id = sc.id) AS items_resumen
  FROM compras_solicitudes sc
  LEFT JOIN clientes c ON c.id = sc.cliente_id
  LEFT JOIN operaciones o ON o.id = sc.operacion_id
  LEFT JOIN visitas_tecnicas vt ON vt.id = sc.visita_tecnica_id
  LEFT JOIN proveedores prov ON prov.id = sc.proveedor_sugerido_id
`;

const SOLICITUD_ITEMS_SQL = `
  SELECT i.*,
    prod.nombre AS producto_nombre, prod.imagen_url AS producto_imagen_url, prod.codigo AS producto_codigo,
    (SELECT json_build_object('id', p.id, 'numero', p.numero, 'estado_logistica', p.estado_logistica)
       FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
       WHERE pi.solicitud_item_id = i.id AND p.estado <> 'cancelado'
       ORDER BY p.created_at DESC LIMIT 1) AS orden_compra,
    (SELECT COALESCE(json_agg(json_build_object('id', pc.id, 'numero', pc.numero, 'estado', pc.estado)), '[]'::json)
       FROM compras_cotizacion_items ci JOIN compras_cotizaciones pc ON pc.id = ci.cotizacion_id
       WHERE ci.solicitud_item_id = i.id) AS cotizaciones
  FROM compras_solicitud_items i
  LEFT JOIN catalogo_productos prod ON prod.id = i.producto_id
`;

const COTIZACION_SQL = `
  SELECT pc.*,
    json_build_object('id', sc.id, 'numero', sc.numero, 'origen', sc.origen, 'obra', sc.obra,
      'fecha_necesaria', sc.fecha_necesaria, 'tipo_producto', sc.tipo_producto,
      'cliente', CASE WHEN c.id IS NOT NULL THEN ${CLIENTE_JSON('c')} ELSE NULL END,
      'operacion', CASE WHEN o.id IS NOT NULL THEN json_build_object('id', o.id, 'numero', o.numero) ELSE NULL END
    ) AS solicitud,
    (SELECT COUNT(*)::int FROM compras_cotizacion_proveedores cp WHERE cp.cotizacion_id = pc.id) AS proveedores_count,
    (SELECT COUNT(*)::int FROM compras_cotizacion_proveedores cp WHERE cp.cotizacion_id = pc.id AND cp.estado IN ('respondida','seleccionada')) AS respondidas_count,
    (SELECT COUNT(*)::int FROM compras_cotizacion_proveedores cp WHERE cp.cotizacion_id = pc.id AND cp.estado = 'enviada') AS esperando_count,
    (SELECT COUNT(*)::int FROM compras_cotizacion_items ci WHERE ci.cotizacion_id = pc.id) AS items_count,
    (SELECT json_agg(json_build_object('id', prov.id, 'nombre', prov.nombre, 'color', prov.color, 'estado', cp.estado, 'total', cp.total) ORDER BY prov.nombre)
       FROM compras_cotizacion_proveedores cp JOIN proveedores prov ON prov.id = cp.proveedor_id
       WHERE cp.cotizacion_id = pc.id) AS proveedores_resumen,
    (SELECT json_build_object('id', p.id, 'numero', p.numero) FROM pedidos p WHERE p.cotizacion_id = pc.id AND p.estado <> 'cancelado' ORDER BY p.created_at DESC LIMIT 1) AS orden_compra
  FROM compras_cotizaciones pc
  JOIN compras_solicitudes sc ON sc.id = pc.solicitud_id
  LEFT JOIN clientes c ON c.id = sc.cliente_id
  LEFT JOIN operaciones o ON o.id = sc.operacion_id
`;

const ORDEN_SQL = `
  SELECT p.*,
    t.nombre AS transportista_nombre,
    ${PROVEEDOR_JSON('prov')} AS proveedor,
    CASE WHEN o.id IS NOT NULL
      THEN json_build_object('id', o.id, 'numero', o.numero, 'tipo', o.tipo, 'precio_total', o.precio_total,
        'cliente', ${CLIENTE_JSON('c')})
      ELSE NULL END AS operacion,
    CASE WHEN sc.id IS NOT NULL THEN json_build_object('id', sc.id, 'numero', sc.numero, 'origen', sc.origen, 'obra', sc.obra) ELSE NULL END AS solicitud,
    CASE WHEN pc.id IS NOT NULL THEN json_build_object('id', pc.id, 'numero', pc.numero) ELSE NULL END AS cotizacion,
    -- Clientes de origen de los ítems (una OC consolidada tiene varios)
    (SELECT COALESCE(json_agg(DISTINCT jsonb_build_object(
        'solicitud_id', sc2.id, 'solicitud_numero', sc2.numero, 'obra', sc2.obra,
        'cliente', CASE WHEN c2.id IS NOT NULL THEN jsonb_build_object('id', c2.id, 'nombre', c2.nombre, 'apellido', c2.apellido,
                        'razon_social', c2.razon_social, 'tipo_persona', c2.tipo_persona) ELSE NULL END,
        'operacion_numero', o2.numero)), '[]'::json)
       FROM pedido_items pi
       JOIN compras_solicitud_items si ON si.id = pi.solicitud_item_id
       JOIN compras_solicitudes sc2 ON sc2.id = si.solicitud_id
       LEFT JOIN clientes c2 ON c2.id = sc2.cliente_id
       LEFT JOIN operaciones o2 ON o2.id = sc2.operacion_id
       WHERE pi.pedido_id = p.id) AS origenes,
    (SELECT json_agg(json_build_object('descripcion', pi.descripcion, 'cantidad', pi.cantidad) ORDER BY pi.orden)
       FROM pedido_items pi WHERE pi.pedido_id = p.id) AS items_resumen,
    (CASE WHEN p.operacion_id IS NOT NULL THEN ${sqlItemsTotal('p.operacion_id')} ELSE NULL END) AS items_total_op,
    (CASE WHEN p.operacion_id IS NOT NULL THEN ${sqlItemsCubiertos('p.operacion_id')} ELSE NULL END) AS items_cubiertos,
    (p.fecha_prometida IS NOT NULL AND p.fecha_prometida < CURRENT_DATE
      AND p.estado_logistica NOT IN ('borrador','recibida','cerrada','cancelada')) AS demorada,
    CASE WHEN p.fecha_prometida IS NOT NULL AND p.fecha_prometida < CURRENT_DATE
      THEN (CURRENT_DATE - p.fecha_prometida)::int ELSE 0 END AS dias_demora
  FROM pedidos p
  JOIN proveedores prov ON prov.id = p.proveedor_id
  LEFT JOIN operaciones o ON o.id = p.operacion_id
  LEFT JOIN clientes c ON c.id = o.cliente_id
  LEFT JOIN transportistas t ON t.id = p.transportista_id
  LEFT JOIN compras_solicitudes sc ON sc.id = p.solicitud_id
  LEFT JOIN compras_cotizaciones pc ON pc.id = p.cotizacion_id
`;

const ORDEN_ITEMS_SQL = `
  SELECT pi.*,
    CASE WHEN prod.id IS NOT NULL THEN json_build_object('id', prod.id, 'nombre', prod.nombre, 'codigo', prod.codigo) ELSE NULL END AS producto,
    prod.imagen_url AS producto_imagen_url,
    si.solicitud_id, sc.numero AS solicitud_numero, sc.obra, o.numero AS operacion_numero,
    CASE WHEN c.id IS NOT NULL THEN ${CLIENTE_JSON('c')} ELSE NULL END AS cliente
  FROM pedido_items pi
  LEFT JOIN catalogo_productos prod ON prod.id = pi.producto_id
  LEFT JOIN compras_solicitud_items si ON si.id = pi.solicitud_item_id
  LEFT JOIN compras_solicitudes sc ON sc.id = si.solicitud_id
  LEFT JOIN operaciones o ON o.id = sc.operacion_id
  LEFT JOIN clientes c ON c.id = sc.cliente_id
  WHERE pi.pedido_id = $1
  ORDER BY pi.orden
`;

/** Ítems de una OC + prorrateo del flete por monto neto (calculado, no se guarda). */
async function itemsDeOrden(pedidoId: string, costoEnvio: number) {
  const { rows } = await db.query(ORDEN_ITEMS_SQL, [pedidoId]);
  const items = rows as Row[];
  const netos = items.map(i => {
    const bruto = Number(i.cantidad) * Number(i.precio_unitario_neto);
    return bruto * (1 - Number(i.descuento_pct ?? 0) / 100);
  });
  const sumNeto = netos.reduce((a, b) => a + b, 0);
  return items.map((i, idx) => ({
    ...i,
    neto_linea: Math.round(netos[idx] * 100) / 100,
    iva_linea: Math.round(netos[idx] * Number(i.iva_pct ?? 0)) / 100,
    flete_prorrateado: sumNeto > 0 ? Math.round(Number(costoEnvio) * netos[idx] / sumNeto * 100) / 100 : 0,
  }));
}

function nombreCliente(c: Row | null | undefined): string {
  if (!c) return '';
  return c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
}

// ═════════════════════════════════════════════════════════════════════════════
// Tablero
// ═════════════════════════════════════════════════════════════════════════════

compras.get('/tablero', async (c) => {
  const [{ rows: [s] }, { rows: esperando }, { rows: preparar }] = await Promise.all([
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM compras_solicitudes WHERE estado IN ('abierta','en_cotizacion')) AS sc_abiertas,
        (SELECT COUNT(*)::int FROM compras_cotizaciones WHERE estado = 'abierta') AS pc_abiertas,
        (SELECT COUNT(*)::int FROM compras_cotizacion_proveedores cp JOIN compras_cotizaciones pc ON pc.id = cp.cotizacion_id
           WHERE pc.estado = 'abierta' AND cp.estado = 'enviada') AS pc_esperando,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado_logistica NOT IN ('borrador','recibida','cerrada','cancelada')) AS oc_en_curso,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado_logistica = 'borrador') AS oc_borrador,
        (SELECT COUNT(*)::int FROM pedidos WHERE fecha_prometida < CURRENT_DATE
           AND estado_logistica NOT IN ('borrador','recibida','cerrada','cancelada')) AS oc_demoradas,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado_logistica NOT IN ('recibida','cerrada','cancelada')) AS oc_activas,
        (SELECT COALESCE(SUM(total), 0)::numeric FROM pedidos WHERE estado_logistica NOT IN ('recibida','cerrada','cancelada')) AS valor_en_curso
    `),
    db.query(`
      SELECT p.id, p.numero, p.fecha_prometida, p.fecha_entrega_est, p.estado_logistica,
        json_build_object('nombre', prov.nombre, 'telefono', prov.telefono) AS proveedor,
        CASE WHEN o.id IS NOT NULL THEN json_build_object('numero', o.numero, 'cliente', ${CLIENTE_JSON('cl')}) ELSE NULL END AS operacion
      FROM pedidos p
      JOIN proveedores prov ON prov.id = p.proveedor_id
      LEFT JOIN operaciones o ON o.id = p.operacion_id
      LEFT JOIN clientes cl ON cl.id = o.cliente_id
      WHERE p.estado = 'enviado'
      ORDER BY COALESCE(p.fecha_prometida, p.fecha_entrega_est) ASC NULLS LAST, p.created_at ASC
      LIMIT 10
    `),
    db.query(`
      SELECT p.id, p.numero, p.fecha_recepcion,
        json_build_object('nombre', prov.nombre) AS proveedor,
        CASE WHEN o.id IS NOT NULL THEN json_build_object('id', o.id, 'numero', o.numero, 'cliente', ${CLIENTE_JSON('cl')}) ELSE NULL END AS operacion
      FROM pedidos p
      JOIN proveedores prov ON prov.id = p.proveedor_id
      LEFT JOIN operaciones o ON o.id = p.operacion_id
      LEFT JOIN clientes cl ON cl.id = o.cliente_id
      WHERE p.estado = 'recibido' AND p.es_stock_propio = false
        AND (p.operacion_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM remitos r WHERE r.operacion_id = p.operacion_id AND r.estado IN ('emitido','entregado')))
      ORDER BY p.fecha_recepcion DESC NULLS LAST
      LIMIT 10
    `),
  ]);
  return c.json({
    stats: { ...s, valor_en_curso: parseFloat(s.valor_en_curso) },
    esperando_recepcion: esperando,
    para_preparar: preparar,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Adjuntos (imágenes → webp, PDFs tal cual) — antes de cualquier /:id
// ═════════════════════════════════════════════════════════════════════════════

compras.post('/adjuntos', async (c) => {
  const body = await c.req.formData();
  const file = (body.get('archivo') ?? body.get('imagen')) as File | null;
  if (!file || !file.size) return c.json({ error: 'No se recibió el archivo' }, 400);
  if (file.size > 20 * 1024 * 1024) return c.json({ error: 'El archivo supera los 20 MB' }, 413);

  const dir = './uploads/compras';
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '') || buf.subarray(0, 4).toString() === '%PDF';

  if (esPdf) {
    const filename = `${randomUUID()}.pdf`;
    await writeFile(`${dir}/${filename}`, buf);
    return c.json({ url: `/uploads/compras/${filename}`, nombre: file.name || filename, tipo: 'pdf' });
  }

  // Sin chequeo previo de MIME: sharp es la validación real (ver visitasTecnicas.ts).
  let optimizado: Buffer;
  try {
    optimizado = await sharp(buf)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    console.error('[compras] Error procesando adjunto:', err instanceof Error ? err.message : err);
    return c.json({ error: 'No se pudo procesar el archivo. Se aceptan imágenes y PDF.' }, 422);
  }
  const filename = `${randomUUID()}.webp`;
  await writeFile(`${dir}/${filename}`, optimizado);
  return c.json({ url: `/uploads/compras/${filename}`, nombre: file.name || filename, tipo: 'imagen' });
});

// ═════════════════════════════════════════════════════════════════════════════
// Solicitudes de compra
// ═════════════════════════════════════════════════════════════════════════════

// GET /solicitudes/pendientes-desde-operaciones — operaciones cobradas con ítems sin cubrir
compras.get('/solicitudes/pendientes-desde-operaciones', async (c) => {
  const { rows } = await db.query(`
    SELECT o.id, o.numero, o.proveedor_id, o.precio_total, o.fecha_entrega_estimada,
      ${CLIENTE_JSON('c')} AS cliente,
      (SELECT nombre FROM proveedores WHERE id = o.proveedor_id) AS proveedor_nombre,
      ${sqlItemsTotal('o.id')} AS items_total,
      ${sqlItemsPendientes('o.id')} AS items_pendientes,
      (SELECT COUNT(*)::int FROM compras_solicitudes sc WHERE sc.operacion_id = o.id AND sc.estado IN ('abierta','en_cotizacion')) AS solicitudes_abiertas
    FROM operaciones o
    LEFT JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado IN ('aprobado', 'en_produccion', 'listo')
      AND ${sqlItemsPendientes('o.id')} > 0
    ORDER BY o.created_at DESC
    LIMIT 100
  `);
  return c.json(rows);
});

// GET /solicitudes/items-pendientes?proveedor_id= — para consolidar varias SC en una OC
compras.get('/solicitudes/items-pendientes', async (c) => {
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const params: unknown[] = [];
  let where = `WHERE i.estado IN ('pendiente','en_cotizacion') AND sc.estado IN ('abierta','en_cotizacion')`;
  if (proveedorId) { params.push(proveedorId); where += ` AND (sc.proveedor_sugerido_id = $1 OR sc.proveedor_sugerido_id IS NULL)`; }
  const { rows } = await db.query(`
    SELECT i.id, i.descripcion, i.cantidad, i.unidad, i.especificaciones, i.costo_referencia, i.proveedor_sku, i.estado,
      i.producto_id, prod.nombre AS producto_nombre,
      sc.id AS solicitud_id, sc.numero AS solicitud_numero, sc.obra, sc.fecha_necesaria, sc.origen, sc.tipo_producto,
      sc.proveedor_sugerido_id, prov.nombre AS proveedor_sugerido_nombre,
      CASE WHEN c.id IS NOT NULL THEN ${CLIENTE_JSON('c')} ELSE NULL END AS cliente,
      o.numero AS operacion_numero
    FROM compras_solicitud_items i
    JOIN compras_solicitudes sc ON sc.id = i.solicitud_id
    LEFT JOIN catalogo_productos prod ON prod.id = i.producto_id
    LEFT JOIN proveedores prov ON prov.id = sc.proveedor_sugerido_id
    LEFT JOIN clientes c ON c.id = sc.cliente_id
    LEFT JOIN operaciones o ON o.id = sc.operacion_id
    ${where}
    ORDER BY sc.fecha_necesaria ASC NULLS LAST, sc.created_at ASC, i.orden
  `, params);
  return c.json(rows);
});

// GET /solicitudes/preparar?operacion_id=|visita_tecnica_id=|producto_id=&cantidad= — ítems autocompletados
compras.get('/solicitudes/preparar', async (c) => {
  const q = c.req.query();
  const items = await armarItemDesde(db, {
    operacion_id: q.operacion_id || null,
    visita_tecnica_id: q.visita_tecnica_id || null,
    producto_id: q.producto_id || null,
    pedido_item_id: q.pedido_item_id || null,
    cantidad: q.cantidad ? Number(q.cantidad) : undefined,
  });
  let cabecera: Row = {};
  if (q.operacion_id) {
    const { rows: [o] } = await db.query(
      `SELECT o.id, o.numero, o.cliente_id, o.proveedor_id, o.fecha_entrega_estimada, ${CLIENTE_JSON('c')} AS cliente
       FROM operaciones o LEFT JOIN clientes c ON c.id = o.cliente_id WHERE o.id = $1`, [q.operacion_id]);
    if (o) cabecera = { cliente_id: o.cliente_id, cliente: o.cliente, operacion: { id: o.id, numero: o.numero }, proveedor_sugerido_id: o.proveedor_id, fecha_necesaria: o.fecha_entrega_estimada };
  } else if (q.visita_tecnica_id) {
    const { rows: [v] } = await db.query(
      `SELECT vt.id, vt.numero, vt.cliente_id, ${CLIENTE_JSON('c')} AS cliente
       FROM visitas_tecnicas vt LEFT JOIN clientes c ON c.id = vt.cliente_id WHERE vt.id = $1`, [q.visita_tecnica_id]);
    if (v) cabecera = { cliente_id: v.cliente_id, cliente: v.cliente, visita_tecnica: { id: v.id, numero: v.numero } };
  }
  const sugerido = items.find(i => i.proveedor_sugerido_id)?.proveedor_sugerido_id ?? null;
  return c.json({ ...cabecera, proveedor_sugerido_id: cabecera.proveedor_sugerido_id ?? sugerido, tipo_producto: items[0]?.tipo_producto ?? 'abertura_medida', items });
});

// GET /solicitudes — lista con filtros
compras.get('/solicitudes', async (c) => {
  const estado = c.req.query('estado') ?? '';
  const search = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (estado === 'activas') where += ` AND sc.estado IN ('abierta','en_cotizacion')`;
  else if (estado && estado !== 'todas') { params.push(estado); where += ` AND sc.estado = $${params.length}`; }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (sc.numero ILIKE $${params.length} OR sc.obra ILIKE $${params.length} OR c.nombre ILIKE $${params.length}
      OR c.apellido ILIKE $${params.length} OR c.razon_social ILIKE $${params.length} OR o.numero ILIKE $${params.length})`;
  }
  const { rows } = await db.query(`${SOLICITUD_SQL} ${where} ORDER BY sc.created_at DESC LIMIT 300`, params);
  return c.json(rows);
});

// POST /solicitudes — crear SC con ítems
compras.post('/solicitudes', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, SolicitudCompraSchema);
  if (b instanceof Response) return b;

  const sc = await enTransaccion(async (client) => {
    // Costo de referencia y SKU del origen (el form manda solo lo editable)
    const drafts = await armarItemDesde(client, { operacion_id: b.operacion_id, visita_tecnica_id: b.visita_tecnica_id });
    const refPorOpItem = new Map(drafts.filter(d => d.operacion_item_id).map(d => [d.operacion_item_id, d]));
    const refPorVtItem = new Map(drafts.filter(d => d.visita_tecnica_item_id).map(d => [d.visita_tecnica_item_id, d]));

    let clienteId = b.cliente_id ?? null;
    if (!clienteId && b.operacion_id) {
      const { rows: [o] } = await client.query(`SELECT cliente_id FROM operaciones WHERE id = $1`, [b.operacion_id]);
      clienteId = o?.cliente_id ?? null;
    }
    if (!clienteId && b.visita_tecnica_id) {
      const { rows: [v] } = await client.query(`SELECT cliente_id FROM visitas_tecnicas WHERE id = $1`, [b.visita_tecnica_id]);
      clienteId = v?.cliente_id ?? null;
    }

    const numero = await nextNumeroCompra(client, 'SC');
    const { rows: [row] } = await client.query(`
      INSERT INTO compras_solicitudes
        (numero, origen, operacion_id, visita_tecnica_id, cliente_id, obra, tipo_producto, fecha_necesaria,
         observaciones, adjuntos, proveedor_sugerido_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      numero, b.origen, b.operacion_id ?? null, b.visita_tecnica_id ?? null, clienteId, b.obra ?? null,
      b.tipo_producto, b.fecha_necesaria ?? null, b.observaciones ?? null, JSON.stringify(b.adjuntos ?? []),
      b.proveedor_sugerido_id ?? null, user?.id ?? null,
    ]);

    for (const [idx, it] of b.items.entries()) {
      const ref = (it.operacion_item_id && refPorOpItem.get(it.operacion_item_id))
        || (it.visita_tecnica_item_id && refPorVtItem.get(it.visita_tecnica_item_id)) || null;
      let costoRef = ref?.costo_referencia ?? null;
      let sku = ref?.proveedor_sku ?? null;
      if (!ref && it.producto_id) {
        const { rows: [p] } = await client.query(`SELECT costo_base, proveedor_sku FROM catalogo_productos WHERE id = $1`, [it.producto_id]);
        costoRef = Number(p?.costo_base) || null; sku = p?.proveedor_sku ?? null;
      }
      await client.query(`
        INSERT INTO compras_solicitud_items
          (solicitud_id, orden, operacion_item_id, visita_tecnica_item_id, producto_id, descripcion, cantidad, unidad,
           especificaciones, adjuntos, observaciones, costo_referencia, proveedor_sku)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        row.id, idx, it.operacion_item_id ?? null, it.visita_tecnica_item_id ?? null, it.producto_id ?? null,
        it.descripcion, it.cantidad, it.unidad ?? 'u', JSON.stringify(it.especificaciones ?? {}),
        JSON.stringify(it.adjuntos ?? []), it.observaciones ?? null, costoRef, sku,
      ]);
    }
    return row;
  });

  registrarActividad(c, { entidad: 'compra', entidad_id: sc.id, entidad_numero: sc.numero, accion: 'crear_solicitud',
    detalle: `Solicitud de compra (${b.origen}) con ${b.items.length} ítem${b.items.length === 1 ? '' : 's'}` });
  return c.json({ id: sc.id, numero: sc.numero }, 201);
});

// GET /solicitudes/:id
compras.get('/solicitudes/:id', async (c) => {
  const { id } = c.req.param();
  const [{ rows: [sc] }, { rows: items }] = await Promise.all([
    db.query(`${SOLICITUD_SQL} WHERE sc.id = $1`, [id]),
    db.query(`${SOLICITUD_ITEMS_SQL} WHERE i.solicitud_id = $1 ORDER BY i.orden`, [id]),
  ]);
  if (!sc) return c.json({ error: 'Solicitud no encontrada' }, 404);
  return c.json({ ...sc, items });
});

// PUT /solicitudes/:id — editar (solo abierta; sus ítems son todos pendientes/cancelados)
compras.put('/solicitudes/:id', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, SolicitudCompraSchema);
  if (b instanceof Response) return b;

  try {
    const sc = await enTransaccion(async (client) => {
      const { rows: [actual] } = await client.query(`SELECT estado, numero FROM compras_solicitudes WHERE id = $1 FOR UPDATE`, [id]);
      if (!actual) throw new ErrorNegocio(404, 'Solicitud no encontrada');
      if (actual.estado !== 'abierta') throw new ErrorNegocio(409, 'Solo se puede editar una solicitud abierta');

      await client.query(`
        UPDATE compras_solicitudes SET origen=$2, operacion_id=$3, visita_tecnica_id=$4, cliente_id=$5, obra=$6,
          tipo_producto=$7, fecha_necesaria=$8, observaciones=$9, adjuntos=$10, proveedor_sugerido_id=$11, updated_at=now()
        WHERE id = $1
      `, [id, b.origen, b.operacion_id ?? null, b.visita_tecnica_id ?? null, b.cliente_id ?? null, b.obra ?? null,
        b.tipo_producto, b.fecha_necesaria ?? null, b.observaciones ?? null, JSON.stringify(b.adjuntos ?? []),
        b.proveedor_sugerido_id ?? null]);

      const { rows: viejos } = await client.query(`SELECT id, costo_referencia, proveedor_sku FROM compras_solicitud_items WHERE solicitud_id = $1`, [id]);
      const refViejos = new Map((viejos as Row[]).map(v => [v.id, v]));
      await client.query(`DELETE FROM compras_solicitud_items WHERE solicitud_id = $1`, [id]);
      for (const [idx, it] of b.items.entries()) {
        const v = (it as Row).id ? refViejos.get((it as Row).id) : null;
        await client.query(`
          INSERT INTO compras_solicitud_items
            (solicitud_id, orden, operacion_item_id, visita_tecnica_item_id, producto_id, descripcion, cantidad, unidad,
             especificaciones, adjuntos, observaciones, costo_referencia, proveedor_sku)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [id, idx, it.operacion_item_id ?? null, it.visita_tecnica_item_id ?? null, it.producto_id ?? null,
          it.descripcion, it.cantidad, it.unidad ?? 'u', JSON.stringify(it.especificaciones ?? {}),
          JSON.stringify(it.adjuntos ?? []), it.observaciones ?? null, v?.costo_referencia ?? null, v?.proveedor_sku ?? null]);
      }
      return actual;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: sc.numero, accion: 'editar', detalle: 'Solicitud editada' });
    const { rows: [row] } = await db.query(`${SOLICITUD_SQL} WHERE sc.id = $1`, [id]);
    return c.json(row);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// PATCH /solicitudes/:id/estado — cancelar / cerrar / reabrir
compras.patch('/solicitudes/:id/estado', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, SolicitudEstadoSchema);
  if (b instanceof Response) return b;

  try {
    const numero = await enTransaccion(async (client) => {
      const { rows: [sc] } = await client.query(`SELECT * FROM compras_solicitudes WHERE id = $1 FOR UPDATE`, [id]);
      if (!sc) throw new ErrorNegocio(404, 'Solicitud no encontrada');
      if (b.estado === 'cancelada') {
        const { rows: [oc] } = await client.query(`
          SELECT p.numero FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
          JOIN compras_solicitud_items si ON si.id = pi.solicitud_item_id
          WHERE si.solicitud_id = $1 AND p.estado <> 'cancelado' LIMIT 1`, [id]);
        if (oc) throw new ErrorNegocio(409, `La solicitud tiene ítems en la orden ${oc.numero}. Cancelá la orden primero.`);
        await client.query(`UPDATE compras_cotizaciones SET estado = 'cancelada', motivo_cierre = COALESCE($2, 'Solicitud cancelada'), updated_at = now()
          WHERE solicitud_id = $1 AND estado = 'abierta'`, [id, b.motivo ?? null]);
        await client.query(`UPDATE compras_solicitud_items SET estado = 'cancelado' WHERE solicitud_id = $1 AND estado <> 'comprado'`, [id]);
        await client.query(`UPDATE compras_solicitudes SET estado = 'cancelada', observaciones = CASE WHEN $2::text IS NULL THEN observaciones
          ELSE COALESCE(observaciones || E'\n', '') || 'Cancelada: ' || $2 END, updated_at = now() WHERE id = $1`, [id, b.motivo ?? null]);
      } else if (b.estado === 'cerrada') {
        await client.query(`UPDATE compras_solicitudes SET estado = 'cerrada', updated_at = now() WHERE id = $1`, [id]);
      } else {
        if (sc.estado === 'cancelada') {
          await client.query(`UPDATE compras_solicitud_items SET estado = 'pendiente' WHERE solicitud_id = $1 AND estado = 'cancelado'`, [id]);
        }
        await client.query(`UPDATE compras_solicitudes SET estado = 'abierta', updated_at = now() WHERE id = $1`, [id]);
        await recalcularEstadoSolicitud(client, id);
      }
      return sc.numero as string;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: numero, accion: b.estado === 'cancelada' ? 'cancelar' : 'cambio_estado',
      detalle: `Solicitud → ${b.estado}${b.motivo ? ` (${b.motivo})` : ''}` });
    const { rows: [row] } = await db.query(`${SOLICITUD_SQL} WHERE sc.id = $1`, [id]);
    return c.json(row);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// Cotizaciones
// ═════════════════════════════════════════════════════════════════════════════

compras.get('/cotizaciones', async (c) => {
  const estado = c.req.query('estado') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (estado && estado !== 'todas') { params.push(estado); where += ` AND pc.estado = $1`; }
  const { rows } = await db.query(`${COTIZACION_SQL} ${where} ORDER BY pc.created_at DESC LIMIT 300`, params);
  return c.json(rows);
});

// POST /cotizaciones — crea la PC + una fila por proveedor invitado
compras.post('/cotizaciones', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, CotizacionCrearSchema);
  if (b instanceof Response) return b;

  try {
    const pc = await enTransaccion(async (client) => {
      const { rows: [sc] } = await client.query(`SELECT * FROM compras_solicitudes WHERE id = $1 FOR UPDATE`, [b.solicitud_id]);
      if (!sc) throw new ErrorNegocio(404, 'Solicitud no encontrada');
      if (!['abierta', 'en_cotizacion'].includes(sc.estado)) throw new ErrorNegocio(409, `La solicitud está ${sc.estado}`);

      const { rows: items } = await client.query(
        `SELECT id, cantidad, estado FROM compras_solicitud_items WHERE solicitud_id = $1 AND id = ANY($2::uuid[])`,
        [b.solicitud_id, b.item_ids]);
      if (items.length !== b.item_ids.length) throw new ErrorNegocio(422, 'Hay ítems que no pertenecen a la solicitud');
      const comprado = (items as Row[]).find(i => i.estado === 'comprado' || i.estado === 'cancelado');
      if (comprado) throw new ErrorNegocio(409, 'Hay ítems ya comprados o cancelados en la selección');

      const numero = await nextNumeroCompra(client, 'PC');
      const { rows: [row] } = await client.query(`
        INSERT INTO compras_cotizaciones (numero, solicitud_id, fecha_limite, observaciones, created_by)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [numero, b.solicitud_id, b.fecha_limite ?? null, b.observaciones ?? null, user?.id ?? null]);

      for (const it of items as Row[]) {
        await client.query(`INSERT INTO compras_cotizacion_items (cotizacion_id, solicitud_item_id, cantidad) VALUES ($1,$2,$3)`,
          [row.id, it.id, it.cantidad]);
      }
      for (const pid of new Set(b.proveedor_ids)) {
        await client.query(`INSERT INTO compras_cotizacion_proveedores (cotizacion_id, proveedor_id) VALUES ($1,$2)`, [row.id, pid]);
      }
      await client.query(`UPDATE compras_solicitud_items SET estado = 'en_cotizacion' WHERE id = ANY($1::uuid[]) AND estado = 'pendiente'`, [b.item_ids]);
      await recalcularEstadoSolicitud(client, b.solicitud_id);
      return row;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: pc.id, entidad_numero: pc.numero, accion: 'pedir_cotizacion',
      detalle: `${b.proveedor_ids.length} proveedor${b.proveedor_ids.length === 1 ? '' : 'es'} · ${b.item_ids.length} ítem${b.item_ids.length === 1 ? '' : 's'}` });
    return c.json({ id: pc.id, numero: pc.numero }, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

/** Detalle completo de una PC: cabecera + ítems (de la SC) + proveedores con sus respuestas. */
async function cargarCotizacion(id: string) {
  const [{ rows: [pc] }, { rows: items }, { rows: provs }] = await Promise.all([
    db.query(`${COTIZACION_SQL} WHERE pc.id = $1`, [id]),
    db.query(`
      SELECT i.*, ci.cantidad AS cantidad_cotizada, prod.nombre AS producto_nombre, prod.imagen_url AS producto_imagen_url
      FROM compras_cotizacion_items ci
      JOIN compras_solicitud_items i ON i.id = ci.solicitud_item_id
      LEFT JOIN catalogo_productos prod ON prod.id = i.producto_id
      WHERE ci.cotizacion_id = $1 ORDER BY i.orden`, [id]),
    db.query(`
      SELECT cp.*, ${PROVEEDOR_JSON('prov')} AS proveedor,
        (SELECT COALESCE(json_agg(ri.* ORDER BY ri.solicitud_item_id), '[]'::json) FROM compras_cotizacion_respuesta_items ri
           WHERE ri.cotizacion_proveedor_id = cp.id) AS items
      FROM compras_cotizacion_proveedores cp
      JOIN proveedores prov ON prov.id = cp.proveedor_id
      WHERE cp.cotizacion_id = $1 ORDER BY prov.nombre`, [id]),
  ]);
  if (!pc) return null;
  return { ...pc, items, proveedores: provs };
}

compras.get('/cotizaciones/:id', async (c) => {
  const pc = await cargarCotizacion(c.req.param('id'));
  if (!pc) return c.json({ error: 'Cotización no encontrada' }, 404);
  return c.json(pc);
});

/** Arma los datos del PDF de una PC para un proveedor. */
async function pdfDeCotizacion(id: string, proveedorId: string): Promise<{ pdf: Buffer; pc: Row; prov: Row; empresa: Row } | null> {
  const pc = await cargarCotizacion(id);
  if (!pc) return null;
  const cp = (pc.proveedores as Row[]).find(p => p.proveedor_id === proveedorId);
  if (!cp) return null;
  const empresa = await empresaActual();
  const items: CompraItemPDF[] = (pc.items as Row[]).map(i => ({
    descripcion: i.descripcion,
    especificaciones: resumenEspecificaciones(i.especificaciones) || null,
    cantidad: Number(i.cantidad_cotizada ?? i.cantidad),
    unidad: i.unidad,
    proveedor_sku: i.proveedor_sku,
  }));
  const data: CompraPDF = {
    tipo: 'cotizacion', numero: pc.numero, fecha: pc.created_at,
    proveedor: cp.proveedor, items, fecha_clave: pc.fecha_limite,
    observaciones: pc.observaciones,
    referencias: [pc.solicitud?.numero, pc.solicitud?.obra ? `Obra: ${pc.solicitud.obra}` : null].filter(Boolean) as string[],
  };
  const pdf = await generarPDFCompra(data, empresa);
  return { pdf, pc, prov: cp.proveedor, empresa };
}

compras.get('/cotizaciones/:id/pdf', async (c) => {
  const { id } = c.req.param();
  const proveedorId = c.req.query('proveedor_id') ?? '';
  if (!proveedorId) return c.json({ error: 'proveedor_id requerido' }, 400);
  const r = await pdfDeCotizacion(id, proveedorId);
  if (!r) return c.json({ error: 'Cotización o proveedor no encontrado' }, 404);
  return c.body(new Uint8Array(r.pdf), 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${r.pc.numero}-${String(r.prov.nombre).replace(/[^\w-]+/g, '_')}.pdf"`,
  });
});

/** Mensaje al proveedor desde `mensajes_plantilla` (con fallback) y el detalle de ítems. */
async function mensajeCompra(clave: 'compra_cotizacion' | 'compra_orden', vars: Record<string, string>, fallback: string) {
  const { rows: [tpl] } = await db.query(`SELECT contenido FROM mensajes_plantilla WHERE clave = $1`, [clave]);
  let texto: string = tpl?.contenido || fallback;
  for (const [k, v] of Object.entries(vars)) texto = texto.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  return texto;
}

function detalleItemsTexto(items: Row[], cantKey = 'cantidad') {
  return items.map(i => {
    const cant = Number(i[cantKey]);
    const cantStr = Number.isInteger(cant) ? String(cant) : cant.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    const espec = resumenEspecificaciones(i.especificaciones);
    return `• ${i.descripcion} — Cant: ${cantStr}${i.unidad && i.unidad !== 'u' ? ` ${i.unidad}` : ''}${espec ? ` (${espec})` : ''}`;
  }).join('\n');
}

async function mensajeCotizacion(pc: Row, empresa: Row) {
  const fechaLim = pc.fecha_limite ? `\n📅 Necesitamos la respuesta antes del ${fmtFechaAR(pc.fecha_limite)}.` : '';
  return mensajeCompra('compra_cotizacion', {
    numero: pc.numero, detalle: detalleItemsTexto(pc.items, 'cantidad_cotizada'), fecha_limite: fechaLim,
  }, `Hola! Te pedimos cotización *{{numero}}* de ${empresa.nombre}.\n\n{{detalle}}\n\nAdjuntamos el detalle en PDF.{{fecha_limite}}\n\nQuedamos atentos. ¡Gracias!`);
}

async function mensajeOrden(oc: Row, empresa: Row) {
  const fechaProm = oc.fecha_prometida ? `\n📅 Entrega prometida: ${fmtFechaAR(oc.fecha_prometida)}` : '';
  return mensajeCompra('compra_orden', {
    numero: oc.numero, detalle: detalleItemsTexto(oc.items), total: fmtMonto(Number(oc.total)), fecha_prometida: fechaProm,
  }, `Hola! Te enviamos la orden de compra *{{numero}}* de ${empresa.nombre}.\n\n{{detalle}}\n\nTotal: *{{total}}*{{fecha_prometida}}\n\nAdjuntamos la orden en PDF. Por favor confirmanos recepción, precio y plazo. ¡Gracias!`);
}

/** Envía un PDF por el medio indicado. Devuelve el error de negocio si no se pudo. */
async function despachar(medio: 'whatsapp' | 'email' | 'manual', prov: Row, pdf: Buffer, nombre: string, mensaje: string, asunto: string, empresa: Row) {
  if (medio === 'manual') return;
  if (medio === 'whatsapp') {
    if (!prov.telefono) throw new ErrorNegocio(422, 'El proveedor no tiene teléfono registrado');
    const r = await enviarWhatsappPdf(prov.telefono, pdf, nombre, mensaje);
    if (!r.ok) throw new ErrorNegocio(r.status as 422, r.error);
    return;
  }
  if (!prov.email) throw new ErrorNegocio(422, 'El proveedor no tiene email registrado');
  if (!emailDisponible()) throw new ErrorNegocio(422, 'El envío por email no está configurado (SMTP). Usá WhatsApp o marcá como enviada manualmente.');
  await sendCompra({ to: prov.email, asunto, mensaje, pdf, pdfNombre: nombre, empresaNombre: empresa.nombre, empresaTelefono: empresa.telefono });
}

// GET /cotizaciones/:id/mensaje — texto que recibiría el proveedor (para previsualizar / editar antes de enviar)
compras.get('/cotizaciones/:id/mensaje', async (c) => {
  const pc = await cargarCotizacion(c.req.param('id'));
  if (!pc) return c.json({ error: 'Cotización no encontrada' }, 404);
  return c.json({ mensaje: await mensajeCotizacion(pc, await empresaActual()) });
});

// POST /cotizaciones/:id/enviar {proveedor_id, medio, contacto?, mensaje?}
compras.post('/cotizaciones/:id/enviar', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, EnviarCompraSchema);
  if (b instanceof Response) return b;
  if (!b.proveedor_id) return c.json({ error: 'proveedor_id requerido' }, 400);

  try {
    const r = await pdfDeCotizacion(id, b.proveedor_id);
    if (!r) throw new ErrorNegocio(404, 'Cotización o proveedor no encontrado');
    if (r.pc.estado !== 'abierta') throw new ErrorNegocio(409, `La cotización está ${r.pc.estado}`);

    const mensaje = b.mensaje || await mensajeCotizacion(r.pc, r.empresa);
    const nombre = `${r.pc.numero}.pdf`;
    await despachar(b.medio, r.prov, r.pdf, nombre, mensaje, `Pedido de cotización ${r.pc.numero} — ${r.empresa.nombre}`, r.empresa);

    await db.query(`
      UPDATE compras_cotizacion_proveedores SET enviada_at = now(), enviada_medio = $3, contacto = COALESCE($4, contacto),
        estado = CASE WHEN estado = 'pendiente' THEN 'enviada' ELSE estado END
      WHERE cotizacion_id = $1 AND proveedor_id = $2
    `, [id, b.proveedor_id, b.medio, b.contacto ?? null]);
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: r.pc.numero, accion: 'enviar',
      detalle: `Cotización enviada a ${r.prov.nombre} por ${b.medio}` });
    return c.json({ enviado: true, mensaje, cotizacion: await cargarCotizacion(id) });
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// PUT /cotizaciones/:id/proveedores/:pid/respuesta — cargar la respuesta del proveedor
compras.put('/cotizaciones/:id/proveedores/:pid/respuesta', async (c) => {
  const { id, pid } = c.req.param();
  const b = await validateBody(c, CotizacionRespuestaSchema);
  if (b instanceof Response) return b;

  try {
    await enTransaccion(async (client) => {
      const { rows: [cp] } = await client.query(
        `SELECT cp.*, pc.estado AS pc_estado FROM compras_cotizacion_proveedores cp JOIN compras_cotizaciones pc ON pc.id = cp.cotizacion_id
         WHERE cp.cotizacion_id = $1 AND cp.proveedor_id = $2 FOR UPDATE OF cp`, [id, pid]);
      if (!cp) throw new ErrorNegocio(404, 'Proveedor no invitado a esta cotización');
      if (cp.pc_estado !== 'abierta') throw new ErrorNegocio(409, `La cotización está ${cp.pc_estado}`);

      if (b.sin_respuesta) {
        await client.query(`UPDATE compras_cotizacion_proveedores SET estado = 'sin_respuesta', observaciones = COALESCE($3, observaciones) WHERE id = $1 AND cotizacion_id = $2`,
          [cp.id, id, b.observaciones ?? null]);
        return;
      }

      await client.query(`DELETE FROM compras_cotizacion_respuesta_items WHERE cotizacion_proveedor_id = $1`, [cp.id]);
      let tot;
      if (b.items && b.items.length) {
        const { rows: cant } = await client.query(
          `SELECT solicitud_item_id, cantidad FROM compras_cotizacion_items WHERE cotizacion_id = $1`, [id]);
        const cantPorItem = new Map((cant as Row[]).map(r => [r.solicitud_item_id, Number(r.cantidad)]));
        for (const it of b.items) {
          if (!cantPorItem.has(it.solicitud_item_id)) throw new ErrorNegocio(422, 'Hay precios de ítems que no están en la cotización');
          await client.query(`
            INSERT INTO compras_cotizacion_respuesta_items
              (cotizacion_proveedor_id, solicitud_item_id, precio_unitario_neto, descuento_pct, iva_pct, plazo_dias, disponibilidad, observaciones)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [cp.id, it.solicitud_item_id, it.precio_unitario_neto, it.descuento_pct ?? 0, it.iva_pct ?? 21,
            it.plazo_dias ?? null, it.disponibilidad ?? null, it.observaciones ?? null]);
        }
        // La cabecera se recalcula sola desde los precios por ítem
        tot = calcularTotales(b.items.map(it => ({ ...it, cantidad: cantPorItem.get(it.solicitud_item_id) ?? 0 })), b.flete ?? 0);
      } else {
        const neto = Number(b.subtotal_neto ?? 0);
        const desc = Number(b.descuento_monto ?? 0);
        const iva  = b.iva_monto !== undefined ? Number(b.iva_monto) : Math.round((neto - desc) * Number(b.iva_pct ?? 21)) / 100;
        const flete = Number(b.flete ?? 0);
        tot = { subtotal_neto: neto, descuento_monto: desc, iva_monto: Math.round(iva * 100) / 100, flete, total: Math.round((neto - desc + iva + flete) * 100) / 100 };
      }

      await client.query(`
        UPDATE compras_cotizacion_proveedores SET
          subtotal_neto=$3, descuento_monto=$4, iva_pct=$5, iva_monto=$6, flete=$7, total=$8, plazo_dias=$9, disponibilidad=$10,
          forma_pago=$11, validez_hasta=$12, observaciones=$13, archivo_url=COALESCE($14, archivo_url),
          adjuntos=COALESCE($15::jsonb, adjuntos), respondida_at=now(),
          estado = CASE WHEN estado IN ('pendiente','enviada','sin_respuesta') THEN 'respondida' ELSE estado END
        WHERE id = $1 AND cotizacion_id = $2
      `, [cp.id, id, tot.subtotal_neto, tot.descuento_monto, b.iva_pct ?? 21, tot.iva_monto, tot.flete, tot.total,
        b.plazo_dias ?? null, b.disponibilidad ?? null, b.forma_pago ?? null, b.validez_hasta ?? null,
        b.observaciones ?? null, b.archivo_url ?? null, b.adjuntos ? JSON.stringify(b.adjuntos) : null]);
    });
    const pc = await cargarCotizacion(id);
    const cp = (pc?.proveedores as Row[] | undefined)?.find(p => p.proveedor_id === pid);
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: pc?.numero, accion: 'responder_cotizacion',
      detalle: b.sin_respuesta ? `${cp?.proveedor?.nombre ?? 'Proveedor'}: sin respuesta` : `${cp?.proveedor?.nombre ?? 'Proveedor'}: total ${fmtMonto(Number(cp?.total ?? 0))}` });
    return c.json(pc);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// GET /cotizaciones/:id/comparativa
compras.get('/cotizaciones/:id/comparativa', async (c) => {
  const pc = await cargarCotizacion(c.req.param('id'));
  if (!pc) return c.json({ error: 'Cotización no encontrada' }, 404);
  const cantTotal = (pc.items as Row[]).reduce((a, i) => a + Number(i.cantidad_cotizada ?? i.cantidad), 0);
  // Respondieron: incluye a los descartados tras adjudicar, para que la comparativa quede como historia
  const filas = (pc.proveedores as Row[])
    .filter(p => ['respondida', 'seleccionada'].includes(p.estado) || (p.estado === 'descartada' && p.respondida_at))
    .map(p => ({
      cotizacion_proveedor_id: p.id,
      proveedor: p.proveedor,
      estado: p.estado,
      total: Number(p.total), subtotal_neto: Number(p.subtotal_neto), descuento_monto: Number(p.descuento_monto),
      iva_monto: Number(p.iva_monto), flete: Number(p.flete),
      plazo_dias: p.plazo_dias, disponibilidad: p.disponibilidad, forma_pago: p.forma_pago, validez_hasta: p.validez_hasta,
      observaciones: p.observaciones, archivo_url: p.archivo_url,
      precio_unitario_promedio: cantTotal > 0 ? Math.round(Number(p.subtotal_neto) / cantTotal * 100) / 100 : null,
      con_precios_por_item: (p.items as Row[]).length > 0,
      items: p.items,
    }));
  const mejor = (k: 'total' | 'subtotal_neto' | 'flete' | 'plazo_dias', menor = true) => {
    const cands = filas.filter(f => f[k] !== null && f[k] !== undefined);
    if (!cands.length) return null;
    return cands.reduce((m, f) => (menor ? Number(f[k]) < Number(m[k]) : Number(f[k]) > Number(m[k])) ? f : m).proveedor.id;
  };
  const validezCands = filas.filter(f => f.validez_hasta);
  const mejorValidez = validezCands.length
    ? validezCands.reduce((m, f) => new Date(f.validez_hasta) > new Date(m.validez_hasta) ? f : m).proveedor.id : null;
  return c.json({
    cotizacion: { id: pc.id, numero: pc.numero, estado: pc.estado, solicitud: pc.solicitud, items: pc.items },
    proveedores: filas,
    mejor: { total: mejor('total'), neto: mejor('subtotal_neto'), flete: mejor('flete'), plazo: mejor('plazo_dias'), validez: mejorValidez },
    pendientes: (pc.proveedores as Row[]).filter(p => ['pendiente', 'enviada'].includes(p.estado)).map(p => p.proveedor),
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Creación de OC (compartida por adjudicar / directa / consolidar)
// ═════════════════════════════════════════════════════════════════════════════

interface ItemOC {
  solicitud_item_id: string;
  cantidad?: number;
  precio_unitario_neto?: number;
  descuento_pct?: number;
  iva_pct?: number;
  proveedor_sku?: string | null;
}

async function crearOrden(client: PoolClient, p: {
  proveedor_id: string;
  solicitud_id: string | null;
  cotizacion_id?: string | null;
  cotizacion_proveedor_id?: string | null;
  costo_envio: number;
  forma_pago?: string | null;
  contacto_proveedor?: string | null;
  fecha_prometida?: string | null;
  notas?: string | null;
  adjuntos?: string[];
  items: ItemOC[];
  created_by: string | null;
}): Promise<Row> {
  const ids = p.items.map(i => i.solicitud_item_id);
  const { rows: siRows } = await client.query(`
    SELECT si.*, sc.operacion_id, sc.origen, sc.estado AS sc_estado
    FROM compras_solicitud_items si JOIN compras_solicitudes sc ON sc.id = si.solicitud_id
    WHERE si.id = ANY($1::uuid[]) FOR UPDATE OF si
  `, [ids]);
  if (siRows.length !== new Set(ids).size) throw new ErrorNegocio(422, 'Hay ítems de solicitud inexistentes');
  const si = siRows as Row[];
  const malo = si.find(i => i.estado === 'comprado' || i.estado === 'cancelado');
  if (malo) throw new ErrorNegocio(409, `El ítem "${malo.descripcion}" ya está ${malo.estado}`);

  const solicitudes = [...new Set(si.map(i => i.solicitud_id as string))];
  const esConsolidada = solicitudes.length > 1;
  const operaciones = [...new Set(si.map(i => i.operacion_id).filter(Boolean))];
  // Una OC de una sola SC hereda su operación (kanban / cobertura); consolidada → sin operación
  const operacionId = !esConsolidada && operaciones.length === 1 ? (operaciones[0] as string) : null;
  const esStockPropio = !operacionId && si.every(i => i.origen === 'reposicion_stock' || i.origen === 'faltante');

  // Mismo control que POST /pedidos: un ítem de operación no puede estar en dos OC activas
  for (const it of si) {
    if (!it.operacion_item_id) continue;
    const { rows: dup } = await client.query(
      `SELECT p2.numero FROM pedido_items pi2 JOIN pedidos p2 ON p2.id = pi2.pedido_id
       WHERE pi2.operacion_item_id = $1 AND p2.estado <> 'cancelado' AND pi2.es_reposicion = false LIMIT 1`, [it.operacion_item_id]);
    if (dup.length) throw new ErrorNegocio(409, `El ítem "${it.descripcion}" ya está en la orden ${dup[0].numero}`);
  }

  const numero = await nextNumeroCompra(client, 'OC');
  const { rows: [oc] } = await client.query(`
    INSERT INTO pedidos
      (numero, proveedor_id, operacion_id, es_stock_propio, estado, estado_logistica, fecha_pedido, fecha_entrega_est,
       fecha_prometida, costo_envio, notas, created_by, solicitud_id, cotizacion_id, cotizacion_proveedor_id,
       es_consolidada, forma_pago, contacto_proveedor, adjuntos)
    VALUES ($1,$2,$3,$4,'pendiente','borrador',CURRENT_DATE,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *
  `, [
    numero, p.proveedor_id, operacionId, esStockPropio, p.fecha_prometida ?? null, p.costo_envio, p.notas ?? null,
    p.created_by, esConsolidada ? null : p.solicitud_id ?? solicitudes[0], p.cotizacion_id ?? null,
    p.cotizacion_proveedor_id ?? null, esConsolidada, p.forma_pago ?? null, p.contacto_proveedor ?? null,
    JSON.stringify(p.adjuntos ?? []),
  ]);

  const porId = new Map(si.map(i => [i.id, i]));
  for (const [idx, it] of p.items.entries()) {
    const s = porId.get(it.solicitud_item_id)!;
    const cant = it.cantidad ?? Number(s.cantidad);
    const neto = it.precio_unitario_neto ?? Number(s.costo_referencia ?? 0);
    await client.query(`
      INSERT INTO pedido_items
        (pedido_id, operacion_item_id, producto_id, descripcion, cantidad, costo_unitario, orden, es_reposicion,
         solicitud_item_id, especificaciones, unidad, proveedor_sku, precio_unitario_neto, descuento_pct, iva_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10,$11,$6,$12,$13)
    `, [
      oc.id, s.operacion_item_id ?? null, s.producto_id ?? null, s.descripcion, cant, neto, idx,
      s.id, JSON.stringify(s.especificaciones ?? {}), s.unidad ?? 'u', it.proveedor_sku ?? s.proveedor_sku ?? null,
      it.descuento_pct ?? 0, it.iva_pct ?? 21,
    ]);
  }
  await recalcularTotalesOC(client, oc.id);
  await client.query(`UPDATE compras_solicitud_items SET estado = 'comprado' WHERE id = ANY($1::uuid[])`, [ids]);
  for (const sid of solicitudes) await recalcularEstadoSolicitud(client, sid);
  return oc;
}

// POST /cotizaciones/:id/adjudicar {proveedor_id} → crea la OC con los precios cotizados
compras.post('/cotizaciones/:id/adjudicar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, CotizacionAdjudicarSchema);
  if (b instanceof Response) return b;

  try {
    const { oc, pc, prov } = await enTransaccion(async (client) => {
      const { rows: [pc] } = await client.query(`SELECT * FROM compras_cotizaciones WHERE id = $1 FOR UPDATE`, [id]);
      if (!pc) throw new ErrorNegocio(404, 'Cotización no encontrada');
      if (pc.estado !== 'abierta') throw new ErrorNegocio(409, `La cotización está ${pc.estado}`);
      const { rows: [cp] } = await client.query(
        `SELECT cp.*, prov.nombre AS proveedor_nombre FROM compras_cotizacion_proveedores cp JOIN proveedores prov ON prov.id = cp.proveedor_id
         WHERE cp.cotizacion_id = $1 AND cp.proveedor_id = $2`, [id, b.proveedor_id]);
      if (!cp) throw new ErrorNegocio(404, 'El proveedor no está en esta cotización');
      if (!['respondida', 'seleccionada'].includes(cp.estado)) throw new ErrorNegocio(409, 'Ese proveedor todavía no respondió la cotización');

      const [{ rows: ci }, { rows: ri }] = await Promise.all([
        client.query(`SELECT ci.solicitud_item_id, ci.cantidad, si.costo_referencia FROM compras_cotizacion_items ci
          JOIN compras_solicitud_items si ON si.id = ci.solicitud_item_id WHERE ci.cotizacion_id = $1`, [id]),
        client.query(`SELECT * FROM compras_cotizacion_respuesta_items WHERE cotizacion_proveedor_id = $1`, [cp.id]),
      ]);
      const respPorItem = new Map((ri as Row[]).map(r => [r.solicitud_item_id, r]));

      let items: ItemOC[];
      if (respPorItem.size) {
        items = (ci as Row[]).map(i => {
          const r = respPorItem.get(i.solicitud_item_id);
          return { solicitud_item_id: i.solicitud_item_id, cantidad: Number(i.cantidad),
            precio_unitario_neto: Number(r?.precio_unitario_neto ?? 0), descuento_pct: Number(r?.descuento_pct ?? 0), iva_pct: Number(r?.iva_pct ?? 21) };
        });
      } else {
        // Un solo total: se prorratea el neto por cantidad × costo de referencia (o por cantidad si no hay referencia)
        const neto = Number(cp.subtotal_neto);
        const pesos = (ci as Row[]).map(i => Number(i.cantidad) * (Number(i.costo_referencia) || 1));
        const sumPesos = pesos.reduce((a, b) => a + b, 0) || 1;
        const descPct = neto > 0 ? Math.round(Number(cp.descuento_monto) / neto * 10000) / 100 : 0;
        items = (ci as Row[]).map((i, idx) => ({
          solicitud_item_id: i.solicitud_item_id, cantidad: Number(i.cantidad),
          precio_unitario_neto: Math.round(neto * pesos[idx] / sumPesos / Number(i.cantidad) * 100) / 100,
          descuento_pct: descPct, iva_pct: Number(cp.iva_pct ?? 21),
        }));
      }

      const fechaPrometida = b.fecha_prometida
        ?? (cp.plazo_dias != null ? new Date(Date.now() + Number(cp.plazo_dias) * 86_400_000).toISOString().slice(0, 10) : null);
      const adjuntos = [cp.archivo_url, ...((cp.adjuntos as string[]) ?? [])].filter(Boolean) as string[];

      const oc = await crearOrden(client, {
        proveedor_id: b.proveedor_id, solicitud_id: pc.solicitud_id, cotizacion_id: id, cotizacion_proveedor_id: cp.id,
        costo_envio: Number(cp.flete ?? 0), forma_pago: cp.forma_pago, fecha_prometida: fechaPrometida,
        notas: b.notas ?? null, adjuntos, items, created_by: user?.id ?? null,
      });
      await client.query(`UPDATE compras_cotizacion_proveedores SET estado = 'seleccionada' WHERE id = $1`, [cp.id]);
      await client.query(`UPDATE compras_cotizacion_proveedores SET estado = 'descartada' WHERE cotizacion_id = $1 AND id <> $2 AND estado IN ('respondida','pendiente','enviada','sin_respuesta')`, [id, cp.id]);
      await client.query(`UPDATE compras_cotizaciones SET estado = 'adjudicada', adjudicada_a_id = $2, updated_at = now() WHERE id = $1`, [id, cp.id]);
      return { oc, pc, prov: cp };
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: oc.id, entidad_numero: oc.numero, accion: 'adjudicar',
      detalle: `${pc.numero} adjudicada a ${prov.proveedor_nombre} → ${oc.numero} (${fmtMonto(Number(oc.total))})` });
    return c.json({ id: oc.id, numero: oc.numero }, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// POST /cotizaciones/:id/cerrar {motivo} → no_concretada; los ítems vuelven a pendiente
compras.post('/cotizaciones/:id/cerrar', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, CotizacionCerrarSchema);
  if (b instanceof Response) return b;
  try {
    const pc = await enTransaccion(async (client) => {
      const { rows: [pc] } = await client.query(`SELECT * FROM compras_cotizaciones WHERE id = $1 FOR UPDATE`, [id]);
      if (!pc) throw new ErrorNegocio(404, 'Cotización no encontrada');
      if (pc.estado !== 'abierta') throw new ErrorNegocio(409, `La cotización ya está ${pc.estado}`);
      await client.query(`UPDATE compras_cotizaciones SET estado = 'no_concretada', motivo_cierre = $2, updated_at = now() WHERE id = $1`, [id, b.motivo]);
      await client.query(`
        UPDATE compras_solicitud_items si SET estado = 'pendiente'
        FROM compras_cotizacion_items ci WHERE ci.solicitud_item_id = si.id AND ci.cotizacion_id = $1 AND si.estado = 'en_cotizacion'
          AND NOT EXISTS (SELECT 1 FROM compras_cotizacion_items ci2 JOIN compras_cotizaciones pc2 ON pc2.id = ci2.cotizacion_id
                          WHERE ci2.solicitud_item_id = si.id AND pc2.estado = 'abierta' AND pc2.id <> $1)`, [id]);
      await recalcularEstadoSolicitud(client, pc.solicitud_id);
      return pc;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: pc.numero, accion: 'cerrar_cotizacion', detalle: b.motivo });
    return c.json(await cargarCotizacion(id));
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// Órdenes de compra
// ═════════════════════════════════════════════════════════════════════════════

compras.get('/ordenes', async (c) => {
  const grupo = c.req.query('estado') ?? '';
  const search = c.req.query('search') ?? '';
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (grupo === 'borrador')       where += ` AND p.estado_logistica = 'borrador'`;
  else if (grupo === 'en_curso')  where += ` AND p.estado_logistica NOT IN ('borrador','recibida','cerrada','cancelada')`;
  else if (grupo === 'demoradas') where += ` AND p.fecha_prometida < CURRENT_DATE AND p.estado_logistica NOT IN ('borrador','recibida','cerrada','cancelada')`;
  else if (grupo === 'recibidas') where += ` AND p.estado_logistica IN ('recibida','cerrada')`;
  else if (grupo === 'canceladas') where += ` AND p.estado_logistica = 'cancelada'`;
  else if (grupo === 'activas')   where += ` AND p.estado_logistica NOT IN ('recibida','cerrada','cancelada')`;
  if (proveedorId) { params.push(proveedorId); where += ` AND p.proveedor_id = $${params.length}`; }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (p.numero ILIKE $${params.length} OR prov.nombre ILIKE $${params.length} OR o.numero ILIKE $${params.length}
      OR c.nombre ILIKE $${params.length} OR c.apellido ILIKE $${params.length} OR c.razon_social ILIKE $${params.length})`;
  }
  const { rows } = await db.query(`${ORDEN_SQL} ${where} ORDER BY p.created_at DESC LIMIT 300`, params);
  return c.json(rows);
});

// POST /ordenes/directa — proveedor ya definido, sin cotización
compras.post('/ordenes/directa', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, OrdenDirectaSchema);
  if (b instanceof Response) return b;
  try {
    const oc = await enTransaccion(async (client) => {
      const { rows: [sc] } = await client.query(`SELECT id, estado FROM compras_solicitudes WHERE id = $1 FOR UPDATE`, [b.solicitud_id]);
      if (!sc) throw new ErrorNegocio(404, 'Solicitud no encontrada');
      if (!['abierta', 'en_cotizacion'].includes(sc.estado)) throw new ErrorNegocio(409, `La solicitud está ${sc.estado}`);
      const { rows: chk } = await client.query(`SELECT id FROM compras_solicitud_items WHERE solicitud_id = $1 AND id = ANY($2::uuid[])`,
        [b.solicitud_id, b.items.map(i => i.solicitud_item_id)]);
      if (chk.length !== b.items.length) throw new ErrorNegocio(422, 'Hay ítems que no pertenecen a la solicitud');
      return crearOrden(client, { ...b, solicitud_id: b.solicitud_id, created_by: user?.id ?? null });
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: oc.id, entidad_numero: oc.numero, accion: 'crear_oc',
      detalle: `Compra directa · ${b.items.length} ítem${b.items.length === 1 ? '' : 's'} · ${fmtMonto(Number(oc.total))}` });
    return c.json({ id: oc.id, numero: oc.numero }, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// POST /ordenes/consolidar — ítems de varias SC al mismo proveedor
compras.post('/ordenes/consolidar', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, OrdenConsolidarSchema);
  if (b instanceof Response) return b;
  try {
    const oc = await enTransaccion(client => crearOrden(client, { ...b, solicitud_id: null, created_by: user?.id ?? null }));
    registrarActividad(c, { entidad: 'compra', entidad_id: oc.id, entidad_numero: oc.numero, accion: 'crear_oc',
      detalle: `OC ${oc.es_consolidada ? 'consolidada' : ''} · ${b.items.length} ítem${b.items.length === 1 ? '' : 's'} · ${fmtMonto(Number(oc.total))}` });
    return c.json({ id: oc.id, numero: oc.numero }, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

async function cargarOrden(id: string) {
  const { rows: [oc] } = await db.query(`${ORDEN_SQL} WHERE p.id = $1`, [id]);
  if (!oc) return null;
  const items = await itemsDeOrden(id, Number(oc.costo_envio));
  return { ...oc, items };
}

compras.get('/ordenes/:id', async (c) => {
  const oc = await cargarOrden(c.req.param('id'));
  if (!oc) return c.json({ error: 'Orden no encontrada' }, 404);
  return c.json(oc);
});

// PUT /ordenes/:id — editar cabecera y precios (solo borrador)
compras.put('/ordenes/:id', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, OrdenEditarSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [oc] } = await client.query(`SELECT estado_logistica, numero FROM pedidos WHERE id = $1 FOR UPDATE`, [id]);
      if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
      if (oc.estado_logistica !== 'borrador') throw new ErrorNegocio(409, 'Solo se puede editar una orden en borrador');
      await client.query(`
        UPDATE pedidos SET
          costo_envio = COALESCE($2, costo_envio), forma_pago = COALESCE($3, forma_pago),
          contacto_proveedor = COALESCE($4, contacto_proveedor),
          fecha_prometida = CASE WHEN $5::text IS NULL THEN fecha_prometida ELSE $5::date END,
          fecha_entrega_est = CASE WHEN $5::text IS NULL THEN fecha_entrega_est ELSE $5::date END,
          notas = COALESCE($6, notas), adjuntos = COALESCE($7::jsonb, adjuntos), updated_at = now()
        WHERE id = $1
      `, [id, b.costo_envio ?? null, b.forma_pago ?? null, b.contacto_proveedor ?? null, b.fecha_prometida ?? null,
        b.notas ?? null, b.adjuntos ? JSON.stringify(b.adjuntos) : null]);
      for (const it of b.items ?? []) {
        await client.query(`
          UPDATE pedido_items SET
            cantidad = COALESCE($3, cantidad),
            precio_unitario_neto = COALESCE($4, precio_unitario_neto), costo_unitario = COALESCE($4, costo_unitario),
            descuento_pct = COALESCE($5, descuento_pct), iva_pct = COALESCE($6, iva_pct), proveedor_sku = COALESCE($7, proveedor_sku)
          WHERE id = $1 AND pedido_id = $2
        `, [it.id, id, it.cantidad ?? null, it.precio_unitario_neto ?? null, it.descuento_pct ?? null, it.iva_pct ?? null, it.proveedor_sku ?? null]);
      }
      await recalcularTotalesOC(client, id);
      registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc.numero, accion: 'editar', detalle: 'Orden de compra editada' });
    });
    return c.json(await cargarOrden(id));
  } catch (err) { return manejarErrorNegocio(c, err); }
});

async function pdfDeOrden(id: string) {
  const oc = await cargarOrden(id);
  if (!oc) return null;
  const empresa = await empresaActual();
  const items: CompraItemPDF[] = (oc.items as Row[]).map(i => ({
    descripcion: i.descripcion,
    especificaciones: resumenEspecificaciones(i.especificaciones) || null,
    cantidad: Number(i.cantidad), unidad: i.unidad ?? 'u',
    referencia: oc.es_consolidada ? [nombreCliente(i.cliente), i.obra, i.operacion_numero].filter(Boolean).join(' · ') || null : null,
    proveedor_sku: i.proveedor_sku,
    precio_unitario_neto: Number(i.precio_unitario_neto), descuento_pct: Number(i.descuento_pct ?? 0), iva_pct: Number(i.iva_pct ?? 0),
  }));
  const refs = [
    oc.solicitud?.numero, oc.cotizacion?.numero,
    oc.operacion?.numero ? `${oc.operacion.numero.replace(/^OP-/, 'PRO-')} · ${nombreCliente(oc.operacion.cliente)}` : null,
    oc.solicitud?.obra ? `Obra: ${oc.solicitud.obra}` : null,
  ].filter(Boolean) as string[];
  const data: CompraPDF = {
    tipo: 'orden', numero: oc.numero, fecha: oc.fecha_pedido,
    proveedor: { ...oc.proveedor, contacto: oc.contacto_proveedor || oc.proveedor.contacto },
    items, fecha_clave: oc.fecha_prometida ?? oc.fecha_entrega_est, forma_pago: oc.forma_pago, observaciones: oc.notas,
    referencias: refs,
    totales: { subtotal_neto: Number(oc.subtotal_neto), descuento_monto: Number(oc.descuento_monto), iva_monto: Number(oc.iva_monto),
      flete: Number(oc.costo_envio), total: Number(oc.total) },
  };
  return { pdf: await generarPDFCompra(data, empresa), oc, empresa };
}

compras.get('/ordenes/:id/pdf', async (c) => {
  const r = await pdfDeOrden(c.req.param('id'));
  if (!r) return c.json({ error: 'Orden no encontrada' }, 404);
  return c.body(new Uint8Array(r.pdf), 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${r.oc.numero}.pdf"`,
  });
});

compras.get('/ordenes/:id/mensaje', async (c) => {
  const oc = await cargarOrden(c.req.param('id'));
  if (!oc) return c.json({ error: 'Orden no encontrada' }, 404);
  return c.json({ mensaje: await mensajeOrden(oc, await empresaActual()) });
});

// POST /ordenes/:id/enviar {medio, contacto?, mensaje?} → PDF al proveedor + logística 'enviada'
compras.post('/ordenes/:id/enviar', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, EnviarCompraSchema);
  if (b instanceof Response) return b;
  try {
    const r = await pdfDeOrden(id);
    if (!r) throw new ErrorNegocio(404, 'Orden no encontrada');
    if (['cancelada', 'recibida', 'cerrada'].includes(r.oc.estado_logistica)) throw new ErrorNegocio(409, `La orden está ${r.oc.estado_logistica}`);

    const mensaje = b.mensaje || await mensajeOrden(r.oc, r.empresa);
    await despachar(b.medio, r.oc.proveedor, r.pdf, `${r.oc.numero}.pdf`, mensaje, `Orden de compra ${r.oc.numero} — ${r.empresa.nombre}`, r.empresa);

    await enTransaccion(async (client) => {
      await client.query(`
        UPDATE pedidos SET enviada_at = now(), enviada_medio = $2, contacto_proveedor = COALESCE($3, contacto_proveedor),
          estado_logistica = CASE WHEN estado_logistica = 'borrador' THEN 'enviada' ELSE estado_logistica END, updated_at = now()
        WHERE id = $1`, [id, b.medio, b.contacto ?? null]);
      await sincronizarEstadoLegacy(client, id);
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: r.oc.numero, accion: 'enviar',
      detalle: `Orden enviada a ${r.oc.proveedor.nombre} por ${b.medio}` });
    return c.json({ enviado: true, mensaje, orden: await cargarOrden(id) });
  } catch (err) { return manejarErrorNegocio(c, err); }
});

export default compras;
