import { Hono } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { DevolucionSchema } from '../lib/schemas.js';
import { registrarActividad } from '../lib/actividad.js';
import { prepararDevolucion, crearDevolucion, DevolucionError } from '../lib/devoluciones.js';
import { cerrarCompromisosSiSaldado } from './recibos.js';

const devoluciones = new Hono();

const NOMBRE_CLIENTE = `CASE WHEN c.tipo_persona = 'juridica' THEN COALESCE(c.razon_social, c.nombre)
                              ELSE NULLIF(TRIM(COALESCE(c.apellido, '') || ' ' || COALESCE(c.nombre, '')), '') END`;

const soloLectura = (rol: string | undefined) => rol === 'consulta';

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
           (SELECT COALESCE(SUM(di.cantidad), 0)::int FROM devolucion_items di WHERE di.devolucion_id = d.id) AS unidades,
           (SELECT COALESCE(SUM(di.cantidad) FILTER (WHERE di.destino = 'no_reingresa'), 0)::int
              FROM devolucion_items di WHERE di.devolucion_id = d.id) AS unidades_perdidas
    FROM devoluciones d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN operaciones o ON o.id = d.operacion_id
    LEFT JOIN remitos rm ON rm.id = d.remito_id
    LEFT JOIN usuarios u ON u.id = d.created_by
    ${where}
    ORDER BY d.created_at DESC
    LIMIT 300
  `, params);
  return c.json(rows);
});

// GET /:id — detalle con ítems
devoluciones.get('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [d] } = await db.query(`
    SELECT d.*, ${NOMBRE_CLIENTE} AS cliente_nombre, c.telefono AS cliente_telefono,
           o.numero AS operacion_numero, rm.numero AS remito_numero, u.nombre AS creado_por
    FROM devoluciones d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN operaciones o ON o.id = d.operacion_id
    LEFT JOIN remitos rm ON rm.id = d.remito_id
    LEFT JOIN usuarios u ON u.id = d.created_by
    WHERE d.id = $1
  `, [id]);
  if (!d) return c.json({ error: 'Devolución no encontrada' }, 404);
  const { rows: items } = await db.query(`SELECT * FROM devolucion_items WHERE devolucion_id = $1 ORDER BY descripcion, id`, [id]);
  return c.json({ ...d, items });
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
    const dev = await crearDevolucion(client, b, { id: user?.id ?? null, rol: user?.rol ?? '' });
    await client.query('COMMIT');

    // Si la devolución dejó la operación sin deuda, los compromisos de pago pendientes ya no corresponden.
    if (dev.operacion_id) await cerrarCompromisosSiSaldado(dev.operacion_id).catch(() => {});

    registrarActividad(c, {
      entidad: 'devolucion', entidad_id: dev.id, entidad_numero: dev.numero, accion: 'crear',
      detalle: `Devolución por $ ${dev.valor_total.toLocaleString('es-AR')}` +
        (dev.credito_monto > 0 ? ` · $ ${dev.credito_monto.toLocaleString('es-AR')} a favor del cliente` : '') +
        (dev.requiere_nc ? ' · hay ítems facturados: falta la nota de crédito' : ''),
      meta: { ...dev },
    });
    return c.json(dev, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof DevolucionError) return c.json({ error: err.message }, err.status);
    throw err;
  } finally {
    client.release();
  }
});

export default devoluciones;
