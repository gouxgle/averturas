import { Hono } from 'hono';
import { db } from '../db.js';
import { registrarActividad } from '../lib/actividad.js';
import { anularReintegro, ReintegroError } from '../lib/reintegros.js';

const reintegros = new Hono();

const NOMBRE_CLIENTE = `CASE WHEN c.tipo_persona = 'juridica' THEN COALESCE(c.razon_social, c.nombre)
                              ELSE NULLIF(TRIM(COALESCE(c.apellido, '') || ' ' || COALESCE(c.nombre, '')), '') END`;

// GET / — listado (los reintegros son plata que salió de caja: lo ven todos los que usan el sistema)
reintegros.get('/', async (c) => {
  const estado = c.req.query('estado') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE true';
  if (estado) { params.push(estado); where += ` AND r.estado = $${params.length}`; }
  const { rows } = await db.query(`
    SELECT r.id, r.numero, r.fecha, r.monto, r.forma_pago, r.referencia, r.motivo, r.estado, r.motivo_anulacion,
           r.created_at, ${NOMBRE_CLIENTE} AS cliente_nombre, c.id AS cliente_id,
           d.numero AS devolucion_numero, d.id AS devolucion_id, u.nombre AS creado_por, ua.nombre AS anulado_por
    FROM reintegros r
    JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN devoluciones d ON d.id = r.devolucion_id
    LEFT JOIN usuarios u ON u.id = r.created_by
    LEFT JOIN usuarios ua ON ua.id = r.anulado_por
    ${where}
    ORDER BY r.created_at DESC
    LIMIT 300
  `, params);
  return c.json(rows);
});

// POST /:id/anular — solo admin: el dinero no salió, vuelve a quedar a favor del cliente.
reintegros.post('/:id/anular', async (c) => {
  const user = c.get('user') as { id: string; rol: string };
  if (user?.rol !== 'admin') return c.json({ error: 'Solo un administrador puede anular un reintegro' }, 403);
  const { id } = c.req.param();
  const b = await c.req.json().catch(() => ({}));
  const motivo = typeof b?.motivo_anulacion === 'string' ? b.motivo_anulacion.trim() : '';
  if (motivo.length < 3) return c.json({ error: 'Contá por qué se anula el reintegro' }, 400);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = await anularReintegro(client, id, motivo, user.id);
    await client.query('COMMIT');
    registrarActividad(c, {
      entidad: 'devolucion', entidad_id: r.devolucion_id ?? r.id, entidad_numero: r.numero, accion: 'anular',
      detalle: `Reintegro anulado: $ ${r.monto.toLocaleString('es-AR')} vuelve a quedar a favor del cliente — ${motivo}`,
    });
    return c.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ReintegroError) return c.json({ error: err.message }, err.status);
    throw err;
  } finally {
    client.release();
  }
});

export default reintegros;
