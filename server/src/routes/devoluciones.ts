import { Hono } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { DevolucionSchema } from '../lib/schemas.js';
import { registrarActividad } from '../lib/actividad.js';
import { prepararDevolucion, crearDevolucion, anularDevolucion, DevolucionError } from '../lib/devoluciones.js';
import { crearCambio } from '../lib/cambios.js';
import { VentaError } from '../lib/ventaRapida.js';
import { cerrarCompromisosSiSaldado } from './recibos.js';

const devoluciones = new Hono();

const NOMBRE_CLIENTE = `CASE WHEN c.tipo_persona = 'juridica' THEN COALESCE(c.razon_social, c.nombre)
                              ELSE NULLIF(TRIM(COALESCE(c.apellido, '') || ' ' || COALESCE(c.nombre, '')), '') END`;

const soloLectura = (rol: string | undefined) => rol === 'consulta';

// Había ítems facturados y todavía no se emitió una nota de crédito sobre esa operación después de la
// devolución. Es un aviso, no un bloqueo: la nota la hace una persona en Facturación (nunca sale sola).
const NC_PENDIENTE = `(d.requiere_nc AND d.estado = 'emitida' AND NOT EXISTS (
  SELECT 1 FROM comprobantes cn
   WHERE cn.operacion_id = d.operacion_id AND cn.tipo_doc = 'nota_credito'
     AND cn.estado IN ('autorizado', 'contingencia', 'emitiendo', 'incierto') AND cn.created_at >= d.created_at))`;

// GET /preparar?remito_id=|operacion_id= — qué se puede devolver y cuánto, antes de confirmar.
devoluciones.get('/preparar', async (c) => {
  const remito_id = c.req.query('remito_id') || null;
  const operacion_id = c.req.query('operacion_id') || null;
  try {
    return c.json(await prepararDevolucion(db, { remito_id, operacion_id }));
  } catch (err) {
    if (err instanceof DevolucionError) return c.json({ error: err.message }, err.status);
    throw err;
  }
});

// GET / — listado
devoluciones.get('/', async (c) => {
  const estado = c.req.query('estado') ?? '';
  const clienteId = c.req.query('cliente_id') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE true';
  if (estado)    { params.push(estado);    where += ` AND d.estado = $${params.length}`; }
  if (clienteId) { params.push(clienteId); where += ` AND d.cliente_id = $${params.length}`; }
  const { rows } = await db.query(`
    SELECT d.id, d.numero, d.fecha, d.estado, d.motivo, d.valor_total, d.aplicado_a_saldo, d.reintegro_monto,
           d.credito_monto, d.requiere_nc, d.created_at,
           ${NOMBRE_CLIENTE} AS cliente_nombre, c.id AS cliente_id,
           o.numero AS operacion_numero, rm.numero AS remito_numero, u.nombre AS creado_por,
           oc.numero AS cambio_numero, oc.id AS cambio_operacion_id,
           ${NC_PENDIENTE} AS nc_pendiente,
           -- Parte del crédito de esta devolución que ya se gastó (en un cambio o en un recibo)
           (SELECT COALESCE(-SUM(m.monto), 0)::numeric FROM cliente_saldo_favor_movimientos m
             WHERE m.devolucion_id = d.id AND m.tipo = 'consumo_recibo') AS credito_usado,
           (SELECT COALESCE(SUM(di.cantidad), 0)::int FROM devolucion_items di WHERE di.devolucion_id = d.id) AS unidades,
           (SELECT COALESCE(SUM(di.cantidad) FILTER (WHERE di.destino = 'no_reingresa'), 0)::int
              FROM devolucion_items di WHERE di.devolucion_id = d.id) AS unidades_perdidas
    FROM devoluciones d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN operaciones o ON o.id = d.operacion_id
    LEFT JOIN operaciones oc ON oc.id = d.operacion_cambio_id
    LEFT JOIN remitos rm ON rm.id = d.remito_id
    LEFT JOIN usuarios u ON u.id = d.created_by
    ${where}
    ORDER BY d.created_at DESC
    LIMIT 300
  `, params);
  return c.json(rows);
});

// GET /remitos-devolvibles?cliente_id=&q= — remitos emitidos o entregados que todavía tienen algo para devolver
// (para elegir de cuál se devuelve, también desde la ficha del cliente). Busca en el servidor: el tablero de
// remitos solo trae los últimos 300. ANTES de /:id.
devoluciones.get('/remitos-devolvibles', async (c) => {
  const clienteId = c.req.query('cliente_id') || '';
  const q = (c.req.query('q') || '').trim();
  const params: unknown[] = [];
  let where = `WHERE rm.estado IN ('emitido', 'entregado')`;
  if (clienteId) { params.push(clienteId); where += ` AND rm.cliente_id = $${params.length}`; }
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (rm.numero ILIKE $${params.length} OR o.numero ILIKE $${params.length} OR ${NOMBRE_CLIENTE} ILIKE $${params.length}
                    OR EXISTS (SELECT 1 FROM remito_items rq WHERE rq.remito_id = rm.id AND rq.descripcion ILIKE $${params.length}))`;
  }
  const { rows } = await db.query(`
    SELECT rm.id, rm.numero, rm.estado, rm.fecha_emision, rm.fecha_entrega_real, c.id AS cliente_id, ${NOMBRE_CLIENTE} AS cliente_nombre,
           o.numero AS operacion_numero,
           (SELECT json_agg(json_build_object('descripcion', ri.descripcion, 'cantidad', ri.cantidad) ORDER BY ri.id)
              FROM remito_items ri WHERE ri.remito_id = rm.id) AS items_resumen
    FROM remitos rm
    JOIN clientes c ON c.id = rm.cliente_id
    LEFT JOIN operaciones o ON o.id = rm.operacion_id
    ${where}
      AND EXISTS (
        SELECT 1 FROM remito_items ri
        LEFT JOIN operacion_items oi ON oi.id = ri.operacion_item_id
        WHERE ri.remito_id = rm.id AND COALESCE(oi.tipo_item, '') <> 'servicio'
          AND ri.cantidad > COALESCE((SELECT SUM(di.cantidad) FROM devolucion_items di
                JOIN devoluciones d ON d.id = di.devolucion_id AND d.estado = 'emitida' WHERE di.remito_item_id = ri.id), 0))
    ORDER BY rm.created_at DESC
    LIMIT 40
  `, params);
  return c.json(rows);
});

// GET /:id — detalle con ítems
devoluciones.get('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [d] } = await db.query(`
    SELECT d.*, ${NOMBRE_CLIENTE} AS cliente_nombre, c.telefono AS cliente_telefono,
           o.numero AS operacion_numero, rm.numero AS remito_numero, u.nombre AS creado_por,
           oc.numero AS cambio_numero, oc.id AS cambio_operacion_id, oc.precio_total AS cambio_total,
           ${NC_PENDIENTE} AS nc_pendiente,
           (SELECT COALESCE(-SUM(m.monto), 0)::numeric FROM cliente_saldo_favor_movimientos m
             WHERE m.devolucion_id = d.id AND m.tipo = 'consumo_recibo') AS credito_usado
    FROM devoluciones d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN operaciones o ON o.id = d.operacion_id
    LEFT JOIN operaciones oc ON oc.id = d.operacion_cambio_id
    LEFT JOIN remitos rm ON rm.id = d.remito_id
    LEFT JOIN usuarios u ON u.id = d.created_by
    WHERE d.id = $1
  `, [id]);
  if (!d) return c.json({ error: 'Devolución no encontrada' }, 404);
  const { rows: items } = await db.query(`SELECT * FROM devolucion_items WHERE devolucion_id = $1 ORDER BY descripcion, id`, [id]);
  const { rows: reintegros } = await db.query(
    `SELECT id, numero, monto, forma_pago, referencia, estado FROM reintegros WHERE devolucion_id = $1 ORDER BY created_at`, [id]);
  return c.json({ ...d, items, reintegros });
});

// GET /:id/facturas — facturas vigentes de la operación (o del remito) de la devolución: a cuál hacerle la nota de crédito
devoluciones.get('/:id/facturas', async (c) => {
  const { id } = c.req.param();
  const { rows } = await db.query(`
    SELECT cf.id, cf.clase, cf.punto_venta, cf.numero, cf.fecha, cf.imp_total, cf.estado
    FROM devoluciones d
    JOIN comprobantes cf ON (cf.operacion_id = d.operacion_id OR (d.remito_id IS NOT NULL AND cf.remito_id = d.remito_id))
    WHERE d.id = $1 AND cf.tipo_doc = 'factura' AND cf.estado IN ('autorizado', 'contingencia')
    ORDER BY cf.fecha, cf.numero
  `, [id]);
  return c.json(rows);
});

// POST /:id/anular — solo admin. Revierte stock y saldo a favor; 409 con el motivo si algo ya se usó.
devoluciones.post('/:id/anular', async (c) => {
  const user = c.get('user') as { id: string; rol: string };
  if (user?.rol !== 'admin') return c.json({ error: 'Solo un administrador puede anular una devolución' }, 403);
  const { id } = c.req.param();
  const b = await c.req.json().catch(() => ({}));
  const motivo = typeof b?.motivo_anulacion === 'string' ? b.motivo_anulacion.trim() : '';
  if (motivo.length < 3) return c.json({ error: 'Contá por qué se anula la devolución' }, 400);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const d = await anularDevolucion(client, id, motivo, user.id);
    await client.query('COMMIT');
    registrarActividad(c, {
      entidad: 'devolucion', entidad_id: d.id, entidad_numero: d.numero, accion: 'anular',
      detalle: `Devolución anulada: ${motivo}` + (d.compromisos_reabiertos > 0 ? ` · ${d.compromisos_reabiertos} compromiso(s) de pago reabierto(s)` : ''),
    });
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof DevolucionError || err instanceof VentaError) return c.json({ error: err.message }, err.status);
    throw err;
  } finally {
    client.release();
  }
});

// POST / — registrar una devolución (todo o nada: stock, saldo a favor y numeración en una transacción)
devoluciones.post('/', async (c) => {
  const user = c.get('user') as { id: string; rol: string };
  if (soloLectura(user?.rol)) return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  const b = await validateBody(c, DevolucionSchema);
  if (b instanceof Response) return b;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const quien = { id: user?.id ?? null, rol: user?.rol ?? '' };
    // Con `cambio` la devolución y la venta del producto nuevo son una sola operación (todo o nada)
    const cambio = b.cambio ? await crearCambio(client, { ...b, cambio: { items: b.cambio.items, pago_diferencia: b.cambio.pago_diferencia } }, quien) : null;
    const dev = cambio ? cambio.devolucion : await crearDevolucion(client, b, quien);
    await client.query('COMMIT');

    // Si la devolución dejó la operación sin deuda, los compromisos de pago pendientes ya no corresponden.
    // (y se anota cuáles cerró, para reabrirlos si la devolución se anula)
    if (dev.operacion_id) {
      const cerrados = await cerrarCompromisosSiSaldado(dev.operacion_id).catch(() => [] as string[]);
      if (cerrados.length) await db.query(`UPDATE devoluciones SET compromisos_cerrados = $2 WHERE id = $1`, [dev.id, cerrados]).catch(() => {});
    }

    registrarActividad(c, {
      entidad: 'devolucion', entidad_id: dev.id, entidad_numero: dev.numero, accion: 'crear',
      detalle: `Devolución por $ ${dev.valor_total.toLocaleString('es-AR')}` +
        (dev.credito_monto > 0 ? ` · $ ${dev.credito_monto.toLocaleString('es-AR')} a favor del cliente` : '') +
        (dev.reintegro_monto > 0 ? ` · $ ${dev.reintegro_monto.toLocaleString('es-AR')} devueltos en ${b.reintegro?.forma_pago} (${dev.reintegro_numero})` : '') +
        (dev.requiere_nc ? ' · hay ítems facturados: falta la nota de crédito' : ''),
      meta: { ...dev },
    });
    if (cambio) {
      registrarActividad(c, {
        entidad: 'devolucion', entidad_id: dev.id, entidad_numero: dev.numero, accion: 'cambiar',
        detalle: `Cambio de producto: ${cambio.operacion.numero} por $ ${cambio.operacion.total.toLocaleString('es-AR')}, remito ${cambio.remito.numero}` +
          (cambio.pagado_con_saldo_favor > 0 ? ` · $ ${cambio.pagado_con_saldo_favor.toLocaleString('es-AR')} con saldo a favor` : '') +
          (cambio.diferencia_cobrada > 0 ? ` · $ ${cambio.diferencia_cobrada.toLocaleString('es-AR')} cobrados de diferencia` : '') +
          (cambio.diferencia_pendiente > 0 ? ` · $ ${cambio.diferencia_pendiente.toLocaleString('es-AR')} pendientes de cobro` : ''),
        meta: { operacion: cambio.operacion, remito: cambio.remito },
      });
    }
    return c.json(cambio ? { ...dev, cambio: { operacion: cambio.operacion, remito: cambio.remito, pagado_con_saldo_favor: cambio.pagado_con_saldo_favor,
      diferencia_cobrada: cambio.diferencia_cobrada, diferencia_pendiente: cambio.diferencia_pendiente, recibos: cambio.recibos } } : dev, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof DevolucionError || err instanceof VentaError) return c.json({ error: err.message }, err.status);
    throw err;
  } finally {
    client.release();
  }
});

export default devoluciones;
