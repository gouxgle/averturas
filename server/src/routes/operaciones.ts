import { Hono } from 'hono';
import { db } from '../db.js';

const operaciones = new Hono();

operaciones.get('/', async (c) => {
  const estado     = c.req.query('estado');
  const estados    = c.req.query('estados');    // comma-separated
  const search     = c.req.query('search')     ?? '';
  const cliente_id = c.req.query('cliente_id') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (estados) {
    const list = estados.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) {
      params.push(list);
      where += ` AND o.estado = ANY($${params.length}::estado_operacion[])`;
    }
  } else if (estado && estado !== 'todos') {
    params.push(estado);
    where += ` AND o.estado = $${params.length}`;
  }

  if (search.trim()) {
    params.push(`%${search}%`);
    where += ` AND o.numero ILIKE $${params.length}`;
  }

  if (cliente_id) {
    params.push(cliente_id);
    where += ` AND o.cliente_id = $${params.length}`;
  }

  const { rows } = await db.query(`
    SELECT o.*,
      json_build_object(
        'id', c.id, 'nombre', c.nombre,
        'apellido', c.apellido, 'telefono', c.telefono
      ) AS cliente
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT 100
  `, params);

  return c.json(rows);
});

operaciones.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [{ rows: [op] }, { rows: items }, { rows: historial }] = await Promise.all([
    db.query(`
      SELECT o.*,
        json_build_object(
          'id', c.id, 'nombre', c.nombre,
          'apellido', c.apellido, 'telefono', c.telefono
        ) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.id = $1
    `, [id]),
    db.query(`
      SELECT oi.*,
        oi.medida_ancho AS ancho,
        oi.medida_alto  AS alto,
        (oi.precio_unitario + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion ELSE 0 END) * oi.cantidad AS precio_total
      FROM operacion_items oi
      WHERE oi.operacion_id = $1
      ORDER BY oi.orden
    `, [id]),
    db.query(`
      SELECT * FROM estados_historial
      WHERE operacion_id = $1
      ORDER BY created_at DESC
    `, [id]),
  ]);

  if (!op) return c.json({ error: 'Operación no encontrada' }, 404);
  return c.json({ ...op, items, historial });
});

operaciones.post('/', async (c) => {
  const user = c.get('user');
  const b    = await c.req.json();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [op] } = await client.query(`
      INSERT INTO operaciones
        (tipo, estado, cliente_id, vendedor_id, proveedor_id,
         incluye_instalacion, notas, notas_internas, fecha_validez, created_by,
         tipo_proyecto, forma_pago, tiempo_entrega)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      b.tipo ?? 'a_medida_proveedor',
      b.estado ?? 'presupuesto',
      b.cliente_id,
      user.id,
      b.proveedor_id || null,
      b.items?.some((i: any) => i.incluye_instalacion) ?? false,
      b.notas || null,
      b.notas_internas || null,
      b.fecha_validez || null,
      user.id,
      b.tipo_proyecto || null,
      b.forma_pago || null,
      b.tiempo_entrega ? parseInt(b.tiempo_entrega) : null,
    ]);

    if (b.items?.length) {
      for (const [idx, item] of b.items.entries()) {
        await client.query(`
          INSERT INTO operacion_items
            (operacion_id, orden, tipo_abertura_id, sistema_id, descripcion,
             medida_ancho, medida_alto, cantidad, costo_unitario, precio_unitario,
             incluye_instalacion, costo_instalacion, precio_instalacion,
             vidrio, premarco, origen, color, accesorios)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        `, [
          op.id,
          idx,
          item.tipo_abertura_id || null,
          item.sistema_id || null,
          item.descripcion || '',
          item.medida_ancho ? parseFloat(item.medida_ancho) : null,
          item.medida_alto  ? parseFloat(item.medida_alto)  : null,
          item.cantidad ?? 1,
          item.costo_unitario ?? 0,
          item.precio_unitario ?? 0,
          item.incluye_instalacion ?? false,
          item.costo_instalacion ?? 0,
          item.precio_instalacion ?? 0,
          item.vidrio || null,
          item.premarco ?? false,
          item.origen || null,
          item.color || null,
          item.accesorios ?? [],
        ]);
      }
    }

    await client.query('COMMIT');
    return c.json(op, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

operaciones.patch('/:id/estado', async (c) => {
  const { id } = c.req.param();
  const { estado } = await c.req.json<{ estado: string }>();

  const { rows: [row] } = await db.query(`
    UPDATE operaciones SET estado = $1 WHERE id = $2
    RETURNING id, numero, estado
  `, [estado, id]);

  if (!row) return c.json({ error: 'Operación no encontrada' }, 404);
  return c.json(row);
});

export default operaciones;
