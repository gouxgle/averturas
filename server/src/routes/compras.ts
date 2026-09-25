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
  OrdenEditarSchema, EnviarCompraSchema, ConfirmacionOrdenSchema, EstadoLogisticaSchema,
  SeguimientoSchema, RecepcionSchema, IncidenciaEditarSchema, IncidenciaReclamarSchema,
  IncidenciaRespuestaSchema, DocumentoCompraSchema, FacturaCompraSchema, PagoProveedorSchema,
  AplicarPagoSchema, NotaProveedorSchema, CerrarOrdenSchema,
} from '../lib/schemas.js';
import {
  nextNumeroCompra, armarItemDesde, calcularTotales, recalcularTotalesOC, sincronizarEstadoLegacy,
  recalcularEstadoSolicitud, empresaActual, resumenEspecificaciones,
  TRANSICIONES_LOGISTICA, LOGISTICA_TERMINAL, LOGISTICA_LABEL, registrarSeguimiento, crearRecepcion,
  recalcularEstadoCalidad, recalcularRecepcionOC, revertirStockDeRecepciones, marcarOperacionListoSiCorresponde,
  registrarDoc, registrarDocs, recalcularEstadoDocs, asentarMovimiento, saldoDeOC,
  recalcularEstadoFinanzas, checklistCierre, actualizarCierreTotal,
  ErrorRecepcion, type EstadoLogistica,
} from '../lib/compras.js';
import { sqlItemsTotal, sqlItemsPendientes, sqlItemsCubiertos } from '../lib/coverage.js';
import { registrarActividad } from '../lib/actividad.js';
import { generarPDFCompra, generarPDFEstadoCuentaProveedor, type CompraPDF, type CompraItemPDF, type EstadoCuentaProveedorPDF } from '../lib/pdf.js';
import { enviarWhatsappPdf, enviarWhatsapp, enviarImagenWhatsapp } from '../lib/whatsapp.js';
import { sendCompra, sendReclamo, emailDisponible } from '../email.js';
import { hoyAR } from '../lib/fechas.js';

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
  // crearRecepcion() vive en lib/ y tiene su propio tipo de error de negocio
  if (err instanceof ErrorRecepcion) return c.json({ error: err.message }, err.status);
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
        (SELECT COALESCE(SUM(total), 0)::numeric FROM pedidos WHERE estado_logistica NOT IN ('recibida','cerrada','cancelada')) AS valor_en_curso,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado_logistica IN ('enviada','confirmada','en_preparacion','en_fabricacion','terminado','listo_despacho','en_transito','demorado','recibida_parcial')) AS oc_por_recibir,
        (SELECT COUNT(*)::int FROM compras_incidencias WHERE estado NOT IN ('resuelta','rechazada')) AS reclamos_abiertos,
        (SELECT COUNT(*)::int FROM compras_incidencias WHERE estado = 'abierta') AS reclamos_sin_reclamar,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado_finanzas IN ('pendiente','pago_parcial')) AS oc_a_pagar,
        (SELECT COALESCE(SUM(GREATEST(s.saldo, 0)), 0)::numeric FROM proveedor_saldos s) AS deuda_proveedores
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
    stats: { ...s, valor_en_curso: parseFloat(s.valor_en_curso), deuda_proveedores: parseFloat(s.deuda_proveedores) },
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
async function mensajeCompra(clave: 'compra_cotizacion' | 'compra_orden' | 'compra_reclamo', vars: Record<string, string>, fallback: string) {
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
        ?? (cp.plazo_dias != null ? hoyAR(new Date(Date.now() + Number(cp.plazo_dias) * 86_400_000)) : null);
      const adjuntos = [cp.archivo_url, ...((cp.adjuntos as string[]) ?? [])].filter(Boolean) as string[];

      const oc = await crearOrden(client, {
        proveedor_id: b.proveedor_id, solicitud_id: pc.solicitud_id, cotizacion_id: id, cotizacion_proveedor_id: cp.id,
        costo_envio: Number(cp.flete ?? 0), forma_pago: cp.forma_pago, fecha_prometida: fechaPrometida,
        notas: b.notas ?? null, adjuntos, items, created_by: user?.id ?? null,
      });
      await client.query(`UPDATE compras_cotizacion_proveedores SET estado = 'seleccionada' WHERE id = $1`, [cp.id]);
      await client.query(`UPDATE compras_cotizacion_proveedores SET estado = 'descartada' WHERE cotizacion_id = $1 AND id <> $2 AND estado IN ('respondida','pendiente','enviada','sin_respuesta')`, [id, cp.id]);
      await client.query(`UPDATE compras_cotizaciones SET estado = 'adjudicada', adjudicada_a_id = $2, updated_at = now() WHERE id = $1`, [id, cp.id]);
      // La cotización que ganó queda archivada en la carpeta de la OC
      await registrarDocs(client, adjuntos, {
        pedido_id: oc.id, tipo: 'cotizacion', nombre: `Cotización ${pc.numero} — ${cp.proveedor_nombre}`,
        numero: pc.numero, monto: Number(cp.total), origen_id: cp.id, created_by: user?.id ?? null,
      });
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

    // El PDF que se mandó queda guardado: la carpeta de la compra tiene el documento real,
    // no uno regenerado después con otros precios.
    const dirOC = './uploads/compras';
    await mkdir(dirOC, { recursive: true });
    const archivoOC = `${r.oc.numero}.pdf`;
    await writeFile(`${dirOC}/${archivoOC}`, r.pdf);
    const urlOC = `/uploads/compras/${archivoOC}`;

    await enTransaccion(async (client) => {
      await client.query(`
        UPDATE pedidos SET enviada_at = now(), enviada_medio = $2, contacto_proveedor = COALESCE($3, contacto_proveedor),
          estado_logistica = CASE WHEN estado_logistica = 'borrador' THEN 'enviada' ELSE estado_logistica END, updated_at = now()
        WHERE id = $1`, [id, b.medio, b.contacto ?? null]);
      await sincronizarEstadoLegacy(client, id);
      await registrarDoc(client, {
        pedido_id: id, tipo: 'orden_compra', url: urlOC, nombre: `Orden de compra ${r.oc.numero}`,
        numero: r.oc.numero, fecha: null, monto: Number(r.oc.total), created_by: c.get('user')?.id ?? null,
      });
      await registrarSeguimiento(client, {
        pedido_id: id, tipo: 'envio', estado_logistica_nuevo: 'enviada',
        observaciones: `Enviada a ${r.oc.proveedor.nombre} por ${b.medio === 'manual' ? 'otro medio' : b.medio}`,
        created_by: c.get('user')?.id ?? null,
      });
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: r.oc.numero, accion: 'enviar',
      detalle: `Orden enviada a ${r.oc.proveedor.nombre} por ${b.medio}` });
    return c.json({ enviado: true, mensaje, orden: await cargarOrden(id) });
  } catch (err) { return manejarErrorNegocio(c, err); }
});


// ═════════════════════════════════════════════════════════════════════════════
// Etapa 2 — confirmación, seguimiento, recepción por ítem, reclamos
// ═════════════════════════════════════════════════════════════════════════════

const SEGUIMIENTOS_SQL = `
  SELECT sg.*, u.nombre AS usuario_nombre
  FROM compras_seguimientos sg
  LEFT JOIN usuarios u ON u.id = sg.created_by
  WHERE sg.pedido_id = $1
  ORDER BY sg.created_at DESC
`;

const RECEPCIONES_SQL = `
  SELECT r.*, t.nombre AS transportista_nombre, u.nombre AS usuario_nombre,
    (SELECT COALESCE(json_agg(json_build_object(
        'id', ri.id, 'pedido_item_id', ri.pedido_item_id, 'descripcion', pi.descripcion,
        'unidad', pi.unidad, 'cantidad_pedida', pi.cantidad,
        'cantidad_recibida', ri.cantidad_recibida, 'cantidad_conforme', ri.cantidad_conforme,
        'cantidad_problema', ri.cantidad_problema, 'no_recibido', ri.no_recibido,
        'observaciones', ri.observaciones,
        'incidencia', (SELECT json_build_object('id', inc.id, 'numero', inc.numero, 'estado', inc.estado)
                         FROM compras_incidencias inc WHERE inc.recepcion_item_id = ri.id LIMIT 1)
      ) ORDER BY pi.orden), '[]'::json)
     FROM compras_recepcion_items ri JOIN pedido_items pi ON pi.id = ri.pedido_item_id
     WHERE ri.recepcion_id = r.id) AS items
  FROM compras_recepciones r
  LEFT JOIN transportistas t ON t.id = r.transportista_id
  LEFT JOIN usuarios u ON u.id = r.created_by
`;

const INCIDENCIA_SQL = `
  SELECT inc.*,
    pi.descripcion AS item_descripcion, pi.unidad AS item_unidad, pi.cantidad AS item_cantidad,
    pi.especificaciones AS item_especificaciones,
    json_build_object('id', p.id, 'numero', p.numero, 'estado_logistica', p.estado_logistica,
      'fecha_pedido', p.fecha_pedido) AS orden,
    ${PROVEEDOR_JSON('prov')} AS proveedor,
    CASE WHEN o.id IS NOT NULL THEN json_build_object('id', o.id, 'numero', o.numero, 'cliente', ${CLIENTE_JSON('c')}) ELSE NULL END AS operacion,
    CASE WHEN rep.id IS NOT NULL THEN json_build_object('id', rep.id, 'descripcion', rep.descripcion,
      'cantidad', rep.cantidad, 'estado_item', rep.estado_item, 'cantidad_conforme', rep.cantidad_conforme) ELSE NULL END AS reposicion,
    u.nombre AS usuario_nombre
  FROM compras_incidencias inc
  JOIN pedidos p ON p.id = inc.pedido_id
  JOIN proveedores prov ON prov.id = p.proveedor_id
  JOIN pedido_items pi ON pi.id = inc.pedido_item_id
  LEFT JOIN pedido_items rep ON rep.id = inc.reposicion_pedido_item_id
  LEFT JOIN operaciones o ON o.id = p.operacion_id
  LEFT JOIN clientes c ON c.id = o.cliente_id
  LEFT JOIN usuarios u ON u.id = inc.created_by
`;

const INCIDENCIA_TIPO_LABEL: Record<string, string> = {
  producto_faltante: 'Producto faltante', medida_incorrecta: 'Medida incorrecta',
  color_incorrecto: 'Color incorrecto', vidrio_roto: 'Vidrio roto', vidrio_rayado: 'Vidrio rayado',
  perfil_golpeado: 'Perfil golpeado', perfil_rayado: 'Perfil rayado',
  herraje_faltante: 'Herraje faltante', herraje_incorrecto: 'Herraje incorrecto',
  producto_incompleto: 'Producto incompleto', error_fabricacion: 'Error de fabricación', otro: 'Otro',
};

/** Soluciones que implican que el proveedor manda mercadería de nuevo. */
const SOLUCION_CON_MERCADERIA = ['reposicion_total', 'reposicion_parcial', 'cambio_vidrio', 'envio_herraje'];

// ── Confirmación del proveedor ────────────────────────────────────────────────

compras.post('/ordenes/:id/confirmacion', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, ConfirmacionOrdenSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [oc] } = await client.query(`SELECT * FROM pedidos WHERE id = $1 FOR UPDATE`, [id]);
      if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
      if (oc.estado_logistica === 'borrador') throw new ErrorNegocio(409, 'Enviá la orden antes de registrar la confirmación');
      if (LOGISTICA_TERMINAL.includes(oc.estado_logistica)) throw new ErrorNegocio(409, `La orden está ${LOGISTICA_LABEL[oc.estado_logistica as EstadoLogistica].toLowerCase()}`);

      await client.query(`
        UPDATE pedidos SET
          confirmacion_recepcion_at = CASE WHEN $2 THEN now() ELSE confirmacion_recepcion_at END,
          confirmacion_precio = $3, confirmacion_caracteristicas = $4,
          fecha_prometida = COALESCE($5::date, fecha_prometida),
          fecha_entrega_est = COALESCE($5::date, fecha_entrega_est),
          contacto_proveedor = COALESCE($6, contacto_proveedor),
          -- Una fecha nueva vuelve a habilitar el aviso de demora
          demora_notif_leida = CASE WHEN $5::text IS NOT NULL THEN false ELSE demora_notif_leida END,
          estado_logistica = CASE WHEN estado_logistica IN ('enviada','demorado') THEN 'confirmada' ELSE estado_logistica END,
          updated_at = now()
        WHERE id = $1
      `, [id, b.confirmacion_recepcion, b.confirmacion_precio, b.confirmacion_caracteristicas,
        b.fecha_prometida ?? null, b.contacto ?? null]);
      await sincronizarEstadoLegacy(client, id);
      await registrarSeguimiento(client, {
        pedido_id: id, tipo: 'confirmacion', estado_logistica_nuevo: 'confirmada',
        nueva_fecha_prometida: b.fecha_prometida ?? null,
        observaciones: [
          b.confirmacion_recepcion ? 'confirmó recepción' : null,
          b.confirmacion_precio ? 'precio ok' : null,
          b.confirmacion_caracteristicas ? 'características ok' : null,
          b.observaciones ?? null,
        ].filter(Boolean).join(' · ') || null,
        created_by: user?.id ?? null,
      });
      registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc.numero, accion: 'confirmar',
        detalle: `Confirmación del proveedor${b.fecha_prometida ? ` · entrega ${fmtFechaAR(b.fecha_prometida)}` : ''}` });
    });
    return c.json(await cargarOrden(id));
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Estado de logística ───────────────────────────────────────────────────────

compras.patch('/ordenes/:id/estado-logistica', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, EstadoLogisticaSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [oc] } = await client.query(`SELECT * FROM pedidos WHERE id = $1 FOR UPDATE`, [id]);
      if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
      const actual = oc.estado_logistica as EstadoLogistica;
      if (actual === b.estado_logistica) return;
      if (['recibida_parcial', 'recibida'].includes(b.estado_logistica)) {
        throw new ErrorNegocio(409, 'El estado de recepción lo decide la recepción de mercadería, no se elige a mano');
      }
      if (!TRANSICIONES_LOGISTICA[actual]?.includes(b.estado_logistica as EstadoLogistica)) {
        throw new ErrorNegocio(409, `No se puede pasar de "${LOGISTICA_LABEL[actual]}" a "${LOGISTICA_LABEL[b.estado_logistica as EstadoLogistica]}"`);
      }
      await client.query(`UPDATE pedidos SET estado_logistica = $2, updated_at = now() WHERE id = $1`, [id, b.estado_logistica]);
      await sincronizarEstadoLegacy(client, id);
      // Cancelar una OC que ya recibió mercadería devuelve ese stock (mov. `devolucion`)
      if (b.estado_logistica === 'cancelada') {
        await revertirStockDeRecepciones(client, id, user?.id ?? null);
      }
      await registrarSeguimiento(client, {
        pedido_id: id, tipo: 'estado', estado_logistica_nuevo: b.estado_logistica,
        observaciones: b.observaciones ?? null, created_by: user?.id ?? null,
      });
      registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc.numero, accion: 'cambio_estado',
        detalle: `Logística: ${LOGISTICA_LABEL[actual]} → ${LOGISTICA_LABEL[b.estado_logistica as EstadoLogistica]}` });
    });
    return c.json(await cargarOrden(id));
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Seguimiento (bitácora) ────────────────────────────────────────────────────

compras.get('/ordenes/:id/seguimientos', async (c) => {
  const { rows } = await db.query(SEGUIMIENTOS_SQL, [c.req.param('id')]);
  return c.json(rows);
});

compras.post('/ordenes/:id/seguimientos', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, SeguimientoSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [oc] } = await client.query(`SELECT numero, estado_logistica FROM pedidos WHERE id = $1 FOR UPDATE`, [id]);
      if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
      await registrarSeguimiento(client, {
        pedido_id: id, tipo: b.tipo, respuesta_proveedor: b.respuesta_proveedor ?? null,
        nueva_fecha_prometida: b.nueva_fecha_prometida ?? null, observaciones: b.observaciones ?? null,
        created_by: user?.id ?? null,
      });
      // Una fecha nueva saca la OC de "demorado" y vuelve a habilitar el aviso
      if (b.nueva_fecha_prometida) {
        await client.query(`
          UPDATE pedidos SET fecha_prometida = $2::date, fecha_entrega_est = $2::date, demora_notif_leida = false,
            estado_logistica = CASE WHEN estado_logistica = 'demorado' THEN 'confirmada' ELSE estado_logistica END,
            updated_at = now()
          WHERE id = $1`, [id, b.nueva_fecha_prometida]);
        await sincronizarEstadoLegacy(client, id);
      }
      registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc.numero, accion: 'seguimiento',
        detalle: b.respuesta_proveedor ?? b.observaciones ?? 'Contacto con el proveedor' });
    });
    const [{ rows: seg }, orden] = await Promise.all([db.query(SEGUIMIENTOS_SQL, [id]), cargarOrden(id)]);
    return c.json({ seguimientos: seg, orden });
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Recepciones ───────────────────────────────────────────────────────────────

// GET /recepciones — todas las entregas (pestaña Recepciones), con su OC y cliente
compras.get('/recepciones', async (c) => {
  const search = c.req.query('search') ?? '';
  const soloParciales = c.req.query('parciales') === 'true';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (soloParciales) where += ` AND p.estado_logistica = 'recibida_parcial'`;
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (p.numero ILIKE $${params.length} OR prov.nombre ILIKE $${params.length}
      OR r.remito_proveedor_nro ILIKE $${params.length} OR o.numero ILIKE $${params.length}
      OR c.nombre ILIKE $${params.length} OR c.apellido ILIKE $${params.length} OR c.razon_social ILIKE $${params.length})`;
  }
  const { rows } = await db.query(`
    SELECT r.*, t.nombre AS transportista_nombre, u.nombre AS usuario_nombre,
      json_build_object('id', p.id, 'numero', p.numero, 'estado_logistica', p.estado_logistica) AS orden,
      ${PROVEEDOR_JSON('prov')} AS proveedor,
      CASE WHEN o.id IS NOT NULL THEN json_build_object('id', o.id, 'numero', o.numero, 'cliente', ${CLIENTE_JSON('c')}) ELSE NULL END AS operacion,
      (SELECT COALESCE(json_agg(json_build_object(
          'id', ri.id, 'pedido_item_id', ri.pedido_item_id, 'descripcion', pi.descripcion,
          'unidad', pi.unidad, 'cantidad_pedida', pi.cantidad,
          'cantidad_recibida', ri.cantidad_recibida, 'cantidad_conforme', ri.cantidad_conforme,
          'cantidad_problema', ri.cantidad_problema, 'no_recibido', ri.no_recibido,
          'observaciones', ri.observaciones,
          'incidencia', (SELECT json_build_object('id', inc.id, 'numero', inc.numero, 'estado', inc.estado)
                           FROM compras_incidencias inc WHERE inc.recepcion_item_id = ri.id LIMIT 1)
        ) ORDER BY pi.orden), '[]'::json)
       FROM compras_recepcion_items ri JOIN pedido_items pi ON pi.id = ri.pedido_item_id
       WHERE ri.recepcion_id = r.id) AS items
    FROM compras_recepciones r
    JOIN pedidos p ON p.id = r.pedido_id
    JOIN proveedores prov ON prov.id = p.proveedor_id
    LEFT JOIN transportistas t ON t.id = r.transportista_id
    LEFT JOIN usuarios u ON u.id = r.created_by
    LEFT JOIN operaciones o ON o.id = p.operacion_id
    LEFT JOIN clientes c ON c.id = o.cliente_id
    ${where}
    ORDER BY r.fecha DESC, r.created_at DESC
    LIMIT 300
  `, params);
  return c.json(rows);
});

compras.get('/ordenes/:id/recepciones', async (c) => {
  const { rows } = await db.query(`${RECEPCIONES_SQL} WHERE r.pedido_id = $1 ORDER BY r.numero_secuencia`, [c.req.param('id')]);
  return c.json(rows);
});

compras.post('/ordenes/:id/recepciones', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, RecepcionSchema);
  if (b instanceof Response) return b;
  try {
    const r = await enTransaccion(client => crearRecepcion(client, id, b, user?.id ?? null));
    const { rows: [oc] } = await db.query(`SELECT numero FROM pedidos WHERE id = $1`, [id]);
    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc?.numero, accion: 'recibir',
      detalle: `Entrega ${r.numero_secuencia} · ${LOGISTICA_LABEL[r.estado_logistica]}` +
        (r.incidencias.length ? ` · ${r.incidencias.length} reclamo${r.incidencias.length === 1 ? '' : 's'} abierto${r.incidencias.length === 1 ? '' : 's'}` : '') });
    return c.json({ ...r, orden: await cargarOrden(id) }, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Incidencias / reclamos ────────────────────────────────────────────────────

compras.get('/incidencias', async (c) => {
  const estado = c.req.query('estado') ?? '';
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const pedidoId = c.req.query('pedido_id') ?? '';
  const search = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (estado === 'abiertas')      where += ` AND inc.estado NOT IN ('resuelta','rechazada')`;
  else if (estado === 'cerradas') where += ` AND inc.estado IN ('resuelta','rechazada')`;
  else if (estado && estado !== 'todas') { params.push(estado); where += ` AND inc.estado = $${params.length}`; }
  if (proveedorId) { params.push(proveedorId); where += ` AND p.proveedor_id = $${params.length}`; }
  if (pedidoId)    { params.push(pedidoId);    where += ` AND inc.pedido_id = $${params.length}`; }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (inc.numero ILIKE $${params.length} OR p.numero ILIKE $${params.length}
      OR prov.nombre ILIKE $${params.length} OR pi.descripcion ILIKE $${params.length})`;
  }
  const { rows } = await db.query(`${INCIDENCIA_SQL} ${where} ORDER BY inc.created_at DESC LIMIT 300`, params);
  return c.json(rows);
});

compras.get('/incidencias/:id', async (c) => {
  const { rows: [inc] } = await db.query(`${INCIDENCIA_SQL} WHERE inc.id = $1`, [c.req.param('id')]);
  if (!inc) return c.json({ error: 'Reclamo no encontrado' }, 404);
  return c.json(inc);
});

compras.put('/incidencias/:id', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, IncidenciaEditarSchema);
  if (b instanceof Response) return b;
  const { rows: [inc] } = await db.query(`SELECT * FROM compras_incidencias WHERE id = $1`, [id]);
  if (!inc) return c.json({ error: 'Reclamo no encontrado' }, 404);
  if (['resuelta', 'rechazada'].includes(inc.estado)) return c.json({ error: 'El reclamo ya está cerrado' }, 409);
  await db.query(`
    UPDATE compras_incidencias SET tipo = COALESCE($2, tipo), cantidad_afectada = COALESCE($3, cantidad_afectada),
      descripcion = COALESCE($4, descripcion), adjuntos = COALESCE($5::jsonb, adjuntos), updated_at = now()
    WHERE id = $1
  `, [id, b.tipo ?? null, b.cantidad_afectada ?? null, b.descripcion ?? null, b.adjuntos ? JSON.stringify(b.adjuntos) : null]);
  const { rows: [row] } = await db.query(`${INCIDENCIA_SQL} WHERE inc.id = $1`, [id]);
  return c.json(row);
});

/** Texto del reclamo (se previsualiza antes de mandarlo, igual que PC y OC). */
async function mensajeReclamo(inc: Row) {
  const detalle = [
    `Ítem: ${inc.item_descripcion}`,
    `Problema: ${INCIDENCIA_TIPO_LABEL[inc.tipo] ?? inc.tipo}`,
    `Cantidad afectada: ${Number(inc.cantidad_afectada)}`,
  ].join('\n');
  return mensajeCompra('compra_reclamo', {
    numero: inc.numero, numero_oc: inc.orden.numero, detalle, descripcion: inc.descripcion ?? '',
  }, `Hola! Te escribimos por un problema con la orden *{{numero_oc}}*.\n\nReclamo *{{numero}}*\n{{detalle}}\n\n{{descripcion}}\n\nPor favor confirmanos cómo lo resolvemos. ¡Gracias!`);
}

compras.get('/incidencias/:id/mensaje', async (c) => {
  const { rows: [inc] } = await db.query(`${INCIDENCIA_SQL} WHERE inc.id = $1`, [c.req.param('id')]);
  if (!inc) return c.json({ error: 'Reclamo no encontrado' }, 404);
  return c.json({ mensaje: await mensajeReclamo(inc) });
});

compras.post('/incidencias/:id/reclamar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, IncidenciaReclamarSchema);
  if (b instanceof Response) return b;
  try {
    const { rows: [inc] } = await db.query(`${INCIDENCIA_SQL} WHERE inc.id = $1`, [id]);
    if (!inc) throw new ErrorNegocio(404, 'Reclamo no encontrado');
    if (['resuelta', 'rechazada'].includes(inc.estado)) throw new ErrorNegocio(409, 'El reclamo ya está cerrado');

    const mensaje = b.mensaje || await mensajeReclamo(inc);
    if (b.medio === 'whatsapp') {
      if (!inc.proveedor.telefono) throw new ErrorNegocio(422, 'El proveedor no tiene teléfono registrado');
      const envio = await enviarWhatsapp(inc.proveedor.telefono, mensaje);
      if (!envio.ok) throw new ErrorNegocio(envio.status as 422, envio.error);
      // Las fotos van como mensajes aparte (Evolution manda una imagen por request)
      for (const url of (inc.adjuntos as string[] ?? [])) {
        if (/\.pdf($|\?)/i.test(url)) continue;
        await enviarImagenWhatsapp(inc.proveedor.telefono, url, `${inc.numero} — ${inc.item_descripcion}`).catch(() => {});
      }
    } else if (b.medio === 'email') {
      if (!inc.proveedor.email) throw new ErrorNegocio(422, 'El proveedor no tiene email registrado');
      if (!emailDisponible()) throw new ErrorNegocio(422, 'El envío por email no está configurado (SMTP). Usá WhatsApp o marcá como reclamado.');
      const empresa = await empresaActual();
      await sendReclamo({
        to: inc.proveedor.email, asunto: `Reclamo ${inc.numero} — orden ${inc.orden.numero}`,
        mensaje, fotos: (inc.adjuntos as string[] ?? []),
        empresaNombre: empresa.nombre, empresaTelefono: empresa.telefono,
      });
    }

    await enTransaccion(async (client) => {
      await client.query(`
        UPDATE compras_incidencias SET estado = CASE WHEN estado = 'abierta' THEN 'reclamada' ELSE estado END,
          reclamada_at = now(), reclamada_medio = $2, updated_at = now()
        WHERE id = $1`, [id, b.medio]);
      await registrarSeguimiento(client, {
        pedido_id: inc.pedido_id, tipo: 'reclamo',
        observaciones: `Reclamo ${inc.numero} enviado a ${inc.proveedor.nombre} por ${b.medio === 'manual' ? 'otro medio' : b.medio}`,
        created_by: user?.id ?? null,
      });
      await recalcularEstadoCalidad(client, inc.pedido_id);
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: inc.pedido_id, entidad_numero: inc.numero, accion: 'reclamar',
      detalle: `${INCIDENCIA_TIPO_LABEL[inc.tipo] ?? inc.tipo} — ${inc.item_descripcion}` });
    const { rows: [row] } = await db.query(`${INCIDENCIA_SQL} WHERE inc.id = $1`, [id]);
    return c.json({ enviado: b.medio !== 'manual', mensaje, incidencia: row });
  } catch (err) { return manejarErrorNegocio(c, err); }
});

compras.post('/incidencias/:id/respuesta', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, IncidenciaRespuestaSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [inc] } = await client.query(
        `SELECT inc.*, pi.descripcion AS item_descripcion, pi.producto_id, pi.operacion_item_id, pi.unidad,
           pi.especificaciones, pi.proveedor_sku
         FROM compras_incidencias inc JOIN pedido_items pi ON pi.id = inc.pedido_item_id
         WHERE inc.id = $1 FOR UPDATE OF inc`, [id]);
      if (!inc) throw new ErrorNegocio(404, 'Reclamo no encontrado');
      if (['resuelta', 'rechazada'].includes(inc.estado)) throw new ErrorNegocio(409, 'El reclamo ya está cerrado');

      let reposicionId: string | null = inc.reposicion_pedido_item_id;
      let estado: string;

      if (SOLUCION_CON_MERCADERIA.includes(b.solucion)) {
        if (!reposicionId) {
          // Ítem de reposición en la misma OC: cantidad afectada, precio 0 (no se paga de
          // nuevo) y marcado para que no cuente en la cobertura de la operación.
          const { rows: [ord] } = await client.query(
            `SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM pedido_items WHERE pedido_id = $1`, [inc.pedido_id]);
          const { rows: [rep] } = await client.query(`
            INSERT INTO pedido_items
              (pedido_id, producto_id, descripcion, cantidad, costo_unitario, orden, es_reposicion,
               especificaciones, unidad, proveedor_sku, precio_unitario_neto, descuento_pct, iva_pct, es_reposicion_reclamo)
            VALUES ($1,$2,$3,$4,0,$5,false,$6,$7,$8,0,0,0,true)
            RETURNING id
          `, [inc.pedido_id, inc.producto_id ?? null, `Reposición ${inc.numero} — ${inc.item_descripcion}`,
            inc.cantidad_afectada, ord.n, JSON.stringify(inc.especificaciones ?? {}), inc.unidad ?? 'u', inc.proveedor_sku ?? null]);
          reposicionId = rep.id;
        }
        estado = 'en_reposicion';
        // La OC vuelve a esperar mercadería
        await client.query(`
          UPDATE pedidos SET estado_logistica = CASE WHEN estado_logistica IN ('recibida','recibida_parcial')
            THEN 'recibida_parcial' ELSE estado_logistica END, updated_at = now() WHERE id = $1`, [inc.pedido_id]);
        await sincronizarEstadoLegacy(client, inc.pedido_id);
      } else if (b.solucion === 'rechazado') {
        estado = 'rechazada';
      } else {
        // descuento / nota de crédito / reparación / devolución: no hay mercadería en camino.
        // El asiento en la cuenta corriente llega en la etapa 3; acá queda el monto.
        estado = 'resuelta';
      }

      await client.query(`
        UPDATE compras_incidencias SET
          respuesta_proveedor = $2, respondida_at = now(), solucion = $3, solucion_detalle = $4,
          monto_descuento = $5, reposicion_pedido_item_id = $6, estado = $7,
          resuelta_at = CASE WHEN $7 IN ('resuelta','rechazada') THEN now() ELSE NULL END, updated_at = now()
        WHERE id = $1
      `, [id, b.respuesta_proveedor ?? null, b.solucion, b.solucion_detalle ?? null,
        b.monto_descuento ?? null, reposicionId, estado]);

      await recalcularEstadoCalidad(client, inc.pedido_id);
      // Un reclamo cerrado sin mercadería (descuento, nota de crédito, rechazo) también
      // salda la línea: la OC puede quedar completa aunque el ítem llegó con problema.
      if (estado === 'resuelta' || estado === 'rechazada') {
        const nuevo = await recalcularRecepcionOC(client, inc.pedido_id);
        if (nuevo) {
          await client.query(`UPDATE pedidos SET estado_logistica = $2, updated_at = now() WHERE id = $1
            AND estado_logistica IN ('recibida','recibida_parcial')`, [inc.pedido_id, nuevo]);
          await sincronizarEstadoLegacy(client, inc.pedido_id);
          if (nuevo === 'recibida') {
            const { rows: [p2] } = await client.query(`SELECT operacion_id FROM pedidos WHERE id = $1`, [inc.pedido_id]);
            await marcarOperacionListoSiCorresponde(client, p2?.operacion_id ?? null, inc.pedido_id);
          }
        }
      }
      await registrarSeguimiento(client, {
        pedido_id: inc.pedido_id, tipo: 'reclamo', respuesta_proveedor: b.respuesta_proveedor ?? null,
        observaciones: `Reclamo ${inc.numero}: ${b.solucion.replace(/_/g, ' ')}`, created_by: user?.id ?? null,
      });
      registrarActividad(c, { entidad: 'compra', entidad_id: inc.pedido_id, entidad_numero: inc.numero, accion: 'responder_reclamo',
        detalle: `${b.solucion.replace(/_/g, ' ')}${b.monto_descuento ? ` · ${fmtMonto(Number(b.monto_descuento))}` : ''}` });
    });
    const { rows: [row] } = await db.query(`${INCIDENCIA_SQL} WHERE inc.id = $1`, [id]);
    return c.json(row);
  } catch (err) { return manejarErrorNegocio(c, err); }
});


// ═════════════════════════════════════════════════════════════════════════════
// Etapa 3 — documentos, facturas, cuenta corriente, pagos, cierre
// ═════════════════════════════════════════════════════════════════════════════

const DOC_TIPO_LABEL: Record<string, string> = {
  cotizacion: 'Cotización', orden_compra: 'Orden de compra', remito: 'Remito',
  factura: 'Factura', nota_credito: 'Nota de crédito', nota_debito: 'Nota de débito',
  comprobante_pago: 'Comprobante de pago', foto_incidencia: 'Foto de reclamo', otro: 'Otro',
};

// ── Documentos de la OC ───────────────────────────────────────────────────────

compras.get('/ordenes/:id/documentos', async (c) => {
  const { rows } = await db.query(`
    SELECT d.*, u.nombre AS usuario_nombre
    FROM compras_documentos d
    LEFT JOIN usuarios u ON u.id = d.created_by
    WHERE d.pedido_id = $1
    ORDER BY d.fecha DESC NULLS LAST, d.created_at DESC
  `, [c.req.param('id')]);
  return c.json(rows);
});

compras.post('/ordenes/:id/documentos', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, DocumentoCompraSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [oc] } = await client.query(`SELECT numero FROM pedidos WHERE id = $1`, [id]);
      if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
      await registrarDoc(client, { pedido_id: id, ...b, created_by: user?.id ?? null });
      await actualizarCierreTotal(client, id);
      registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc.numero, accion: 'adjuntar_documento',
        detalle: `${DOC_TIPO_LABEL[b.tipo] ?? b.tipo}${b.numero ? ` ${b.numero}` : ''}` });
    });
    const { rows } = await db.query(`SELECT * FROM compras_documentos WHERE pedido_id = $1 ORDER BY created_at DESC`, [id]);
    return c.json(rows, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

compras.delete('/ordenes/:id/documentos/:docId', async (c) => {
  const { id, docId } = c.req.param();
  await enTransaccion(async (client) => {
    await client.query(`DELETE FROM compras_documentos WHERE id = $1 AND pedido_id = $2`, [docId, id]);
    await recalcularEstadoDocs(client, id);
    await actualizarCierreTotal(client, id);
  });
  return c.json({ ok: true });
});

// ── Control económico ─────────────────────────────────────────────────────────

/** Cotizado / Orden / Facturado de una OC, con el detalle de cada factura. */
compras.get('/ordenes/:id/control-economico', async (c) => {
  const { id } = c.req.param();
  const [saldo, { rows: facturas }, { rows: pagos }, { rows: notas }] = await Promise.all([
    saldoDeOC(db, id),
    db.query(`SELECT f.*, u.nombre AS usuario_nombre FROM compras_facturas f
              LEFT JOIN usuarios u ON u.id = f.created_by WHERE f.pedido_id = $1 ORDER BY f.fecha, f.created_at`, [id]),
    db.query(`
      SELECT a.monto AS monto_aplicado, p.* FROM proveedor_pago_aplicaciones a
      JOIN proveedor_pagos p ON p.id = a.pago_id WHERE a.pedido_id = $1 ORDER BY p.fecha`, [id]),
    db.query(`SELECT * FROM proveedor_notas WHERE pedido_id = $1 ORDER BY fecha`, [id]),
  ]);
  const { rows: [oc] } = await db.query(
    `SELECT estado_finanzas, estado_docs, cerrada_totalmente_at, control_realizado_at FROM pedidos WHERE id = $1`, [id]);
  if (!oc) return c.json({ error: 'Orden no encontrada' }, 404);
  return c.json({ ...saldo, ...oc, facturas, pagos, notas });
});

compras.get('/ordenes/:id/cierre', async (c) => {
  const chk = await checklistCierre(db, c.req.param('id'));
  return c.json(chk);
});

/** Cierra la compra: marca el control hecho y pasa la logística a `cerrada`. */
compras.post('/ordenes/:id/cerrar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, CerrarOrdenSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [oc] } = await client.query(`SELECT * FROM pedidos WHERE id = $1 FOR UPDATE`, [id]);
      if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
      if (oc.estado_logistica === 'cerrada') throw new ErrorNegocio(409, 'La orden ya está cerrada');
      if (b.control_realizado) {
        await client.query(`UPDATE pedidos SET control_realizado_at = now(), control_realizado_by = $2 WHERE id = $1`, [id, user?.id ?? null]);
      }
      const chk = await checklistCierre(client, id);
      if (!chk.puede_cerrar) {
        const falta = chk.items.filter(i => !i.ok && ['mercaderia', 'reclamos', 'control'].includes(i.clave))
          .map(i => i.detalle ?? i.label).join('; ');
        throw new ErrorNegocio(409, `Todavía no se puede cerrar: ${falta}`);
      }
      await client.query(`UPDATE pedidos SET estado_logistica = 'cerrada', updated_at = now() WHERE id = $1`, [id]);
      await sincronizarEstadoLegacy(client, id);
      await actualizarCierreTotal(client, id);
      await registrarSeguimiento(client, {
        pedido_id: id, tipo: 'estado', estado_logistica_nuevo: 'cerrada',
        observaciones: b.observaciones ?? 'Compra cerrada', created_by: user?.id ?? null,
      });
      registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: oc.numero, accion: 'cerrar',
        detalle: 'Compra cerrada' });
    });
    return c.json(await cargarOrden(id));
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Facturas ──────────────────────────────────────────────────────────────────

compras.get('/facturas', async (c) => {
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const pedidoId = c.req.query('pedido_id') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (proveedorId) { params.push(proveedorId); where += ` AND f.proveedor_id = $${params.length}`; }
  if (pedidoId)    { params.push(pedidoId);    where += ` AND f.pedido_id = $${params.length}`; }
  const { rows } = await db.query(`
    SELECT f.*, ${PROVEEDOR_JSON('prov')} AS proveedor,
      CASE WHEN p.id IS NOT NULL THEN json_build_object('id', p.id, 'numero', p.numero) ELSE NULL END AS orden
    FROM compras_facturas f
    JOIN proveedores prov ON prov.id = f.proveedor_id
    LEFT JOIN pedidos p ON p.id = f.pedido_id
    ${where} ORDER BY f.fecha DESC, f.created_at DESC LIMIT 300
  `, params);
  return c.json(rows);
});

/**
 * Alta de factura. Si el total no coincide con el de la OC (más de un centavo), exige el
 * motivo: la diferencia entre lo pactado y lo facturado es justo lo que después nadie
 * recuerda. Asienta la compra en la cuenta corriente y refleja el PDF en la carpeta.
 */
compras.post('/facturas', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, FacturaCompraSchema);
  if (b instanceof Response) return b;
  try {
    const factura = await enTransaccion(async (client) => {
      let diferencia = 0;
      if (b.pedido_id) {
        const { rows: [oc] } = await client.query(`SELECT id, numero, proveedor_id, total FROM pedidos WHERE id = $1 FOR UPDATE`, [b.pedido_id]);
        if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
        if (oc.proveedor_id !== b.proveedor_id) throw new ErrorNegocio(422, 'La orden es de otro proveedor');
        const saldo = await saldoDeOC(client, b.pedido_id);
        // La diferencia se mide contra lo pactado, sumando lo ya facturado antes
        diferencia = Math.round((saldo.facturado + b.total - Number(oc.total)) * 100) / 100;
        if (Math.abs(diferencia) > 0.01 && !b.diferencia_motivo) {
          throw new ErrorNegocio(422, `La factura no coincide con la orden (${diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}). Indicá el motivo de la diferencia.`);
        }
      }

      const { rows: [f] } = await client.query(`
        INSERT INTO compras_facturas
          (proveedor_id, pedido_id, numero, fecha, subtotal_neto, iva_monto, total, url,
           diferencia_vs_oc, diferencia_motivo, diferencia_obs, created_by)
        VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [b.proveedor_id, b.pedido_id ?? null, b.numero, b.fecha ?? null, b.subtotal_neto, b.iva_monto,
        b.total, b.url ?? null, diferencia, b.diferencia_motivo ?? null, b.diferencia_obs ?? null, user?.id ?? null]).catch((err: unknown) => {
        if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
          throw new ErrorNegocio(409, `Ya hay una factura ${b.numero} cargada para este proveedor`);
        }
        throw err;
      });

      await asentarMovimiento(client, {
        proveedor_id: b.proveedor_id, tipo: 'compra', monto: b.total, fecha: b.fecha ?? null,
        pedido_id: b.pedido_id ?? null, factura_id: f.id,
        concepto: `Factura ${b.numero}`, created_by: user?.id ?? null,
      });

      if (b.pedido_id) {
        if (b.url) await registrarDoc(client, { pedido_id: b.pedido_id, tipo: 'factura', url: b.url,
          nombre: `Factura ${b.numero}`, numero: b.numero, fecha: b.fecha ?? null, monto: b.total,
          origen_id: f.id, created_by: user?.id ?? null });
        await recalcularEstadoDocs(client, b.pedido_id);
        await recalcularEstadoFinanzas(client, b.pedido_id);
        await actualizarCierreTotal(client, b.pedido_id);
      }
      return f;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: factura.pedido_id ?? factura.id, entidad_numero: `FC ${b.numero}`,
      accion: 'cargar_factura', detalle: `${fmtMonto(b.total)}${Math.abs(Number(factura.diferencia_vs_oc)) > 0.01 ? ` · diferencia ${fmtMonto(Number(factura.diferencia_vs_oc))} (${b.diferencia_motivo})` : ''}` });
    return c.json(factura, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

compras.delete('/facturas/:id', async (c) => {
  const { id } = c.req.param();
  try {
    const pedidoId = await enTransaccion(async (client) => {
      const { rows: [f] } = await client.query(`SELECT * FROM compras_facturas WHERE id = $1`, [id]);
      if (!f) throw new ErrorNegocio(404, 'Factura no encontrada');
      // El asiento se borra con la factura: la cuenta corriente no puede quedar con una
      // compra sin comprobante detrás.
      await client.query(`DELETE FROM proveedor_cc_movimientos WHERE factura_id = $1`, [id]);
      await client.query(`DELETE FROM compras_facturas WHERE id = $1`, [id]);
      if (f.pedido_id) {
        await recalcularEstadoDocs(client, f.pedido_id);
        await recalcularEstadoFinanzas(client, f.pedido_id);
        await actualizarCierreTotal(client, f.pedido_id);
      }
      return f.pedido_id as string | null;
    });
    return c.json({ ok: true, pedido_id: pedidoId });
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Pagos ─────────────────────────────────────────────────────────────────────

const PAGO_SQL = `
  SELECT p.*, ${PROVEEDOR_JSON('prov')} AS proveedor, u.nombre AS usuario_nombre,
    COALESCE((SELECT SUM(a.monto) FROM proveedor_pago_aplicaciones a WHERE a.pago_id = p.id), 0)::numeric AS aplicado,
    (p.importe - COALESCE((SELECT SUM(a.monto) FROM proveedor_pago_aplicaciones a WHERE a.pago_id = p.id), 0))::numeric AS sin_aplicar,
    (SELECT COALESCE(json_agg(json_build_object('pedido_id', a.pedido_id, 'numero', ped.numero, 'monto', a.monto)), '[]'::json)
       FROM proveedor_pago_aplicaciones a JOIN pedidos ped ON ped.id = a.pedido_id
       WHERE a.pago_id = p.id) AS aplicaciones
  FROM proveedor_pagos p
  JOIN proveedores prov ON prov.id = p.proveedor_id
  LEFT JOIN usuarios u ON u.id = p.created_by
`;

compras.get('/pagos', async (c) => {
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const soloConSaldo = c.req.query('con_saldo') === 'true';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (proveedorId) { params.push(proveedorId); where += ` AND p.proveedor_id = $${params.length}`; }
  if (soloConSaldo) where += ` AND p.importe > COALESCE((SELECT SUM(a.monto) FROM proveedor_pago_aplicaciones a WHERE a.pago_id = p.id), 0) + 0.01`;
  const { rows } = await db.query(`${PAGO_SQL} ${where} ORDER BY p.fecha DESC, p.created_at DESC LIMIT 300`, params);
  return c.json(rows);
});

/**
 * Registra un pago y lo aplica a una o varias OC. Lo que no se aplica queda como saldo a
 * favor (anticipo) y se puede aplicar después con `POST /pagos/:id/aplicar`.
 */
compras.post('/pagos', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, PagoProveedorSchema);
  if (b instanceof Response) return b;
  try {
    const pago = await enTransaccion(async (client) => {
      const { rows: [pg] } = await client.query(`
        INSERT INTO proveedor_pagos (proveedor_id, fecha, importe, medio, nro_operacion, comprobantes, observacion, created_by)
        VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8) RETURNING *
      `, [b.proveedor_id, b.fecha ?? null, b.importe, b.medio, b.nro_operacion ?? null,
        JSON.stringify(b.comprobantes ?? []), b.observacion ?? null, user?.id ?? null]);

      const aplicado = await aplicarPago(client, pg.id, b.proveedor_id, b.aplicaciones ?? [], b.comprobantes ?? [], user?.id ?? null);

      // Un solo asiento por el total del pago; el reparto entre OC vive en las aplicaciones
      await asentarMovimiento(client, {
        proveedor_id: b.proveedor_id, tipo: aplicado > 0 ? 'pago' : 'anticipo', monto: b.importe,
        fecha: b.fecha ?? null, pago_id: pg.id,
        pedido_id: (b.aplicaciones ?? []).length === 1 ? b.aplicaciones![0].pedido_id : null,
        concepto: aplicado > 0
          ? `Pago ${b.medio}${b.nro_operacion ? ` ${b.nro_operacion}` : ''}`
          : `Anticipo ${b.medio}${b.nro_operacion ? ` ${b.nro_operacion}` : ''}`,
        created_by: user?.id ?? null,
      });
      return pg;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: pago.id, entidad_numero: null, accion: 'pagar',
      detalle: `Pago a proveedor ${fmtMonto(b.importe)} (${b.medio})` });
    const { rows: [row] } = await db.query(`${PAGO_SQL} WHERE p.id = $1`, [pago.id]);
    return c.json(row, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

/** Aplica (o amplía la aplicación de) un pago existente: el saldo a favor se usa acá. */
compras.post('/pagos/:id/aplicar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, AplicarPagoSchema);
  if (b instanceof Response) return b;
  try {
    await enTransaccion(async (client) => {
      const { rows: [pg] } = await client.query(`
        SELECT p.*, COALESCE((SELECT SUM(a.monto) FROM proveedor_pago_aplicaciones a WHERE a.pago_id = p.id), 0)::numeric AS aplicado
        FROM proveedor_pagos p WHERE p.id = $1 FOR UPDATE`, [id]);
      if (!pg) throw new ErrorNegocio(404, 'Pago no encontrado');
      const disponible = Number(pg.importe) - Number(pg.aplicado);
      const aPlicar = b.aplicaciones.reduce((a, x) => a + x.monto, 0);
      if (aPlicar - disponible > 0.01) {
        throw new ErrorNegocio(422, `El pago tiene ${disponible.toFixed(2)} sin aplicar y estás aplicando ${aPlicar.toFixed(2)}`);
      }
      await aplicarPago(client, id, pg.proveedor_id, b.aplicaciones, (pg.comprobantes as string[]) ?? [], user?.id ?? null);
      // Si antes era anticipo y ahora se aplicó, el movimiento pasa a ser un pago
      await client.query(`UPDATE proveedor_cc_movimientos SET tipo = 'pago' WHERE pago_id = $1 AND tipo = 'anticipo'`, [id]);
    });
    const { rows: [row] } = await db.query(`${PAGO_SQL} WHERE p.id = $1`, [id]);
    return c.json(row);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

/** Reparte un pago entre OC, refleja los comprobantes y recalcula finanzas/cierre. */
async function aplicarPago(client: PoolClient, pagoId: string, proveedorId: string,
  aplicaciones: { pedido_id: string; monto: number }[], comprobantes: string[], userId: string | null): Promise<number> {
  let total = 0;
  for (const ap of aplicaciones) {
    const { rows: [oc] } = await client.query(`SELECT id, numero, proveedor_id FROM pedidos WHERE id = $1 FOR UPDATE`, [ap.pedido_id]);
    if (!oc) throw new ErrorNegocio(404, 'Orden no encontrada');
    if (oc.proveedor_id !== proveedorId) throw new ErrorNegocio(422, `La orden ${oc.numero} es de otro proveedor`);
    await client.query(`
      INSERT INTO proveedor_pago_aplicaciones (pago_id, pedido_id, monto) VALUES ($1,$2,$3)
      ON CONFLICT (pago_id, pedido_id) DO UPDATE SET monto = proveedor_pago_aplicaciones.monto + EXCLUDED.monto
    `, [pagoId, ap.pedido_id, ap.monto]);
    await registrarDocs(client, comprobantes, {
      pedido_id: ap.pedido_id, tipo: 'comprobante_pago', nombre: 'Comprobante de pago',
      monto: ap.monto, origen_id: pagoId, created_by: userId,
    });
    await recalcularEstadoFinanzas(client, ap.pedido_id);
    await actualizarCierreTotal(client, ap.pedido_id);
    total += ap.monto;
  }
  return total;
}

// ── Notas de crédito / débito ─────────────────────────────────────────────────

compras.post('/notas', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, NotaProveedorSchema);
  if (b instanceof Response) return b;
  try {
    const nota = await enTransaccion(async (client) => {
      const { rows: [n] } = await client.query(`
        INSERT INTO proveedor_notas (proveedor_id, tipo, pedido_id, incidencia_id, numero, fecha, monto, url, concepto, created_by)
        VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8,$9,$10) RETURNING *
      `, [b.proveedor_id, b.tipo, b.pedido_id ?? null, b.incidencia_id ?? null, b.numero ?? null,
        b.fecha ?? null, b.monto, b.url ?? null, b.concepto ?? null, user?.id ?? null]);

      await asentarMovimiento(client, {
        proveedor_id: b.proveedor_id, tipo: b.tipo === 'credito' ? 'credito' : 'debito', monto: b.monto,
        fecha: b.fecha ?? null, pedido_id: b.pedido_id ?? null, nota_id: n.id, incidencia_id: b.incidencia_id ?? null,
        concepto: `${b.tipo === 'credito' ? 'Nota de crédito' : 'Nota de débito'}${b.numero ? ` ${b.numero}` : ''}${b.concepto ? ` — ${b.concepto}` : ''}`,
        created_by: user?.id ?? null,
      });

      if (b.pedido_id) {
        if (b.url) await registrarDoc(client, { pedido_id: b.pedido_id, tipo: b.tipo === 'credito' ? 'nota_credito' : 'nota_debito',
          url: b.url, nombre: `${b.tipo === 'credito' ? 'Nota de crédito' : 'Nota de débito'}${b.numero ? ` ${b.numero}` : ''}`,
          numero: b.numero ?? null, fecha: b.fecha ?? null, monto: b.monto, origen_id: n.id, created_by: user?.id ?? null });
        await recalcularEstadoFinanzas(client, b.pedido_id);
        await actualizarCierreTotal(client, b.pedido_id);
      }

      // Una nota de crédito por un reclamo lo cierra: era la solución acordada
      if (b.incidencia_id && b.tipo === 'credito') {
        await client.query(`
          UPDATE compras_incidencias SET estado = 'resuelta', resuelta_at = now(), updated_at = now(),
            solucion = COALESCE(solucion, 'nota_credito'), monto_descuento = COALESCE(monto_descuento, $2)
          WHERE id = $1 AND estado NOT IN ('resuelta','rechazada')
        `, [b.incidencia_id, b.monto]);
        const { rows: [inc] } = await client.query(`SELECT pedido_id FROM compras_incidencias WHERE id = $1`, [b.incidencia_id]);
        if (inc?.pedido_id) {
          await recalcularEstadoCalidad(client, inc.pedido_id);
          await recalcularRecepcionOC(client, inc.pedido_id);
          await actualizarCierreTotal(client, inc.pedido_id);
        }
      }
      return n;
    });
    registrarActividad(c, { entidad: 'compra', entidad_id: nota.pedido_id ?? nota.id, entidad_numero: b.numero ?? null,
      accion: b.tipo === 'credito' ? 'nota_credito' : 'nota_debito', detalle: fmtMonto(b.monto) });
    return c.json(nota, 201);
  } catch (err) { return manejarErrorNegocio(c, err); }
});

// ── Estado de cuenta del proveedor ────────────────────────────────────────────

/** Saldo de todos los proveedores (vista `proveedor_saldos`, no `deuda_actual`). */
compras.get('/cuenta-corriente', async (c) => {
  const { rows } = await db.query(`
    SELECT prov.id, prov.nombre, prov.telefono, prov.email, prov.contacto, prov.color, prov.activo,
      s.saldo::numeric AS saldo,
      (SELECT MAX(m.fecha) FROM proveedor_cc_movimientos m WHERE m.proveedor_id = prov.id) AS ultimo_movimiento,
      (SELECT COUNT(*)::int FROM pedidos p WHERE p.proveedor_id = prov.id
         AND p.estado_finanzas IN ('pendiente','pago_parcial')) AS ordenes_impagas
    FROM proveedores prov
    JOIN proveedor_saldos s ON s.proveedor_id = prov.id
    WHERE prov.activo = true OR s.saldo <> 0
    ORDER BY s.saldo DESC, prov.nombre
  `);
  const totales = (rows as Row[]).reduce((acc, r) => {
    const saldo = Number(r.saldo);
    if (saldo > 0) acc.deuda += saldo; else acc.a_favor += -saldo;
    return acc;
  }, { deuda: 0, a_favor: 0 });
  return c.json({ proveedores: rows, totales });
});

async function estadoCuentaProveedor(proveedorId: string, desde: string | null, hasta: string | null, pedidoId: string | null) {
  const params: unknown[] = [proveedorId];
  let filtro = '';
  if (desde) { params.push(desde); filtro += ` AND m.fecha >= $${params.length}::date`; }
  if (hasta) { params.push(hasta); filtro += ` AND m.fecha <= $${params.length}::date`; }
  if (pedidoId) { params.push(pedidoId); filtro += ` AND m.pedido_id = $${params.length}`; }

  const [{ rows: [prov] }, { rows: [ini] }, { rows: movs }] = await Promise.all([
    db.query(`SELECT prov.*, s.saldo::numeric AS saldo FROM proveedores prov
              JOIN proveedor_saldos s ON s.proveedor_id = prov.id WHERE prov.id = $1`, [proveedorId]),
    desde
      ? db.query(`SELECT COALESCE(SUM(monto), 0)::numeric AS saldo FROM proveedor_cc_movimientos
                  WHERE proveedor_id = $1 AND fecha < $2::date`, [proveedorId, desde])
      : Promise.resolve({ rows: [{ saldo: 0 }] }),
    db.query(`
      SELECT m.*, ped.numero AS pedido_numero, f.numero AS factura_numero,
        pg.medio AS pago_medio, pg.nro_operacion, u.nombre AS usuario_nombre
      FROM proveedor_cc_movimientos m
      LEFT JOIN pedidos ped ON ped.id = m.pedido_id
      LEFT JOIN compras_facturas f ON f.id = m.factura_id
      LEFT JOIN proveedor_pagos pg ON pg.id = m.pago_id
      LEFT JOIN usuarios u ON u.id = m.created_by
      WHERE m.proveedor_id = $1 ${filtro}
      ORDER BY m.fecha, m.created_at
    `, params),
  ]);
  if (!prov) return null;

  let acum = Number(ini?.saldo ?? 0);
  const movimientos: Row[] = (movs as Row[]).map(m => {
    acum = Math.round((acum + Number(m.monto)) * 100) / 100;
    return { ...m, monto: Number(m.monto), saldo_acumulado: acum };
  });
  const suma = (tipos: string[]) => movimientos.filter(m => tipos.includes(String(m.tipo)))
    .reduce((a, m) => a + Math.abs(Number(m.monto)), 0);

  return {
    proveedor: { id: prov.id, nombre: prov.nombre, telefono: prov.telefono, email: prov.email,
      contacto: prov.contacto, cuit: prov.cuit, direccion: prov.direccion, localidad: prov.localidad, color: prov.color },
    saldo_inicial: Number(ini?.saldo ?? 0),
    movimientos,
    totales: {
      compras: suma(['compra']), debitos: suma(['debito']), pagos: suma(['pago']),
      creditos: suma(['credito']), anticipos: suma(['anticipo']),
      saldo_final: movimientos.length ? acum : Number(ini?.saldo ?? 0),
      saldo_actual: Number(prov.saldo),
    },
  };
}

async function pdfEstadoCuenta(id: string, desde: string | null, hasta: string | null) {
  const data = await estadoCuentaProveedor(id, desde, hasta, null);
  if (!data) return null;
  const empresa = await empresaActual();
  const pdfData: EstadoCuentaProveedorPDF = {
    proveedor: data.proveedor as EstadoCuentaProveedorPDF['proveedor'],
    periodo: { desde, hasta },
    saldo_inicial: data.saldo_inicial,
    movimientos: data.movimientos as unknown as EstadoCuentaProveedorPDF['movimientos'],
    totales: data.totales,
  };
  return { pdf: await generarPDFEstadoCuentaProveedor(pdfData, empresa), data, empresa };
}

compras.get('/proveedores/:id/estado-cuenta/pdf', async (c) => {
  const r = await pdfEstadoCuenta(c.req.param('id'), c.req.query('desde') ?? null, c.req.query('hasta') ?? null);
  if (!r) return c.json({ error: 'Proveedor no encontrado' }, 404);
  return c.body(new Uint8Array(r.pdf), 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="CuentaCorriente-${String(r.data.proveedor.nombre).replace(/[^\w-]+/g, '_')}.pdf"`,
  });
});

/** Le manda al proveedor su estado de cuenta en PDF por WhatsApp. */
compras.post('/proveedores/:id/estado-cuenta/enviar-whatsapp', async (c) => {
  const { id } = c.req.param();
  try {
    const r = await pdfEstadoCuenta(id, c.req.query('desde') ?? null, c.req.query('hasta') ?? null);
    if (!r) throw new ErrorNegocio(404, 'Proveedor no encontrado');
    if (!r.data.proveedor.telefono) throw new ErrorNegocio(422, 'El proveedor no tiene teléfono registrado');

    const saldo = r.data.totales.saldo_final;
    const caption = Math.abs(saldo) <= 0.01
      ? `Hola! Te mandamos el estado de cuenta al ${fmtFechaAR(new Date())}. La cuenta está al día. ¡Gracias!`
      : saldo > 0
        ? `Hola! Te mandamos el estado de cuenta al ${fmtFechaAR(new Date())}. Saldo pendiente: ${fmtMonto(saldo)}. Cualquier diferencia avisanos.`
        : `Hola! Te mandamos el estado de cuenta al ${fmtFechaAR(new Date())}. Tenemos ${fmtMonto(Math.abs(saldo))} a favor. Cualquier diferencia avisanos.`;

    const envio = await enviarWhatsappPdf(r.data.proveedor.telefono, r.pdf,
      `CuentaCorriente-${String(r.data.proveedor.nombre).replace(/[^\w-]+/g, '_')}.pdf`, caption);
    if (!envio.ok) throw new ErrorNegocio(envio.status as 422, envio.error);

    registrarActividad(c, { entidad: 'compra', entidad_id: id, entidad_numero: null, accion: 'enviar',
      detalle: `Estado de cuenta enviado a ${r.data.proveedor.nombre}` });
    return c.json({ enviado: true, numero: envio.numero, caption });
  } catch (err) { return manejarErrorNegocio(c, err); }
});

compras.get('/proveedores/:id/estado-cuenta', async (c) => {
  const { id } = c.req.param();
  const data = await estadoCuentaProveedor(id, c.req.query('desde') ?? null, c.req.query('hasta') ?? null, c.req.query('pedido_id') ?? null);
  if (!data) return c.json({ error: 'Proveedor no encontrado' }, 404);
  return c.json(data);
});

export default compras;
