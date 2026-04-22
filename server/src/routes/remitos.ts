import { Hono } from 'hono';
import { db } from '../db.js';

const remitos = new Hono();

async function nextNumero(): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS n FROM remitos WHERE numero LIKE $1`,
    [`R-${ym}-%`]
  );
  const n = parseInt((rows[0] as { n: string }).n) + 1;
  return `R-${ym}-${String(n).padStart(4, '0')}`;
}

const WITH_CLIENTE = `
  SELECT r.*,
    json_build_object(
      'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
      'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
      'telefono', c.telefono, 'direccion', c.direccion
    ) AS cliente,
    CASE WHEN o.id IS NOT NULL
      THEN json_build_object('id', o.id, 'numero', o.numero, 'tipo', o.tipo)
      ELSE NULL END AS operacion
  FROM remitos r
  JOIN  clientes   c ON c.id = r.cliente_id
  LEFT JOIN operaciones o ON o.id = r.operacion_id
`;

// GET / — lista
remitos.get('/', async (c) => {
  const estado = c.req.query('estado') ?? '';
  const search = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (estado && estado !== 'todos') {
    params.push(estado);
    where += ` AND r.estado = $${params.length}`;
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (r.numero ILIKE $${params.length} OR c.nombre ILIKE $${params.length} OR c.apellido ILIKE $${params.length} OR c.razon_social ILIKE $${params.length})`;
  }

  const { rows } = await db.query(`
    ${WITH_CLIENTE}
    ${where}
    ORDER BY r.created_at DESC
    LIMIT 200
  `, params);

  return c.json(rows);
});

// GET /conteos — para header/filtros
remitos.get('/conteos', async (c) => {
  const { rows } = await db.query(`
    SELECT estado, COUNT(*)::int AS n FROM remitos GROUP BY estado
  `);
  const conteos: Record<string, number> = { borrador: 0, emitido: 0, entregado: 0, cancelado: 0 };
  for (const r of rows as { estado: string; n: number }[]) conteos[r.estado] = r.n;
  return c.json(conteos);
});

// GET /:id — detalle con items
remitos.get('/:id', async (c) => {
  const { id } = c.req.param();
  const [{ rows: [remito] }, { rows: items }] = await Promise.all([
    db.query(`${WITH_CLIENTE} WHERE r.id = $1`, [id]),
    db.query(`
      SELECT ri.*,
        json_build_object(
          'id', p.id, 'nombre', p.nombre, 'codigo', p.codigo,
          'tipo', p.tipo, 'imagen_url', p.imagen_url
        ) AS producto
      FROM remito_items ri
      LEFT JOIN catalogo_productos p ON p.id = ri.producto_id
      WHERE ri.remito_id = $1
      ORDER BY ri.id
    `, [id]),
  ]);
  if (!remito) return c.json({ error: 'Remito no encontrado' }, 404);
  return c.json({ ...remito, items });
});

// POST / — crear en borrador
remitos.post('/', async (c) => {
  const user = c.get('user');
  const b    = await c.req.json();

  if (!b.cliente_id)               return c.json({ error: 'cliente_id requerido' }, 400);
  if (!b.items?.length)            return c.json({ error: 'items requeridos' }, 400);
  if (!b.medio_envio)              return c.json({ error: 'medio_envio requerido' }, 400);

  const numero = await nextNumero();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [remito] } = await client.query(`
      INSERT INTO remitos
        (numero, cliente_id, operacion_id, medio_envio, transportista, nro_seguimiento,
         direccion_entrega, fecha_emision, fecha_entrega_est, notas, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      numero,
      b.cliente_id,
      b.operacion_id   || null,
      b.medio_envio,
      b.transportista  || null,
      b.nro_seguimiento|| null,
      b.direccion_entrega || null,
      b.fecha_emision  || new Date().toISOString().split('T')[0],
      b.fecha_entrega_est || null,
      b.notas          || null,
      user?.id         || null,
    ]);

    for (const item of b.items) {
      await client.query(`
        INSERT INTO remito_items
          (remito_id, producto_id, descripcion, cantidad, precio_unitario, estado_producto, notas_item)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        remito.id,
        item.producto_id     || null,
        item.descripcion,
        item.cantidad        || 1,
        item.precio_unitario != null ? parseFloat(item.precio_unitario) : null,
        item.estado_producto || 'nuevo',
        item.notas_item      || null,
      ]);
    }

    await client.query('COMMIT');
    return c.json(remito, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PUT /:id — actualizar (solo borrador)
remitos.put('/:id', async (c) => {
  const { id } = c.req.param();
  const b      = await c.req.json();

  const { rows: [actual] } = await db.query(`SELECT estado FROM remitos WHERE id=$1`, [id]);
  if (!actual)                    return c.json({ error: 'Remito no encontrado' }, 404);
  if (actual.estado !== 'borrador') return c.json({ error: 'Solo se puede editar un remito en borrador' }, 409);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE remitos SET
        cliente_id        = $1, operacion_id      = $2,
        medio_envio       = $3, transportista      = $4,
        nro_seguimiento   = $5, direccion_entrega  = $6,
        fecha_emision     = $7, fecha_entrega_est  = $8,
        notas             = $9, updated_at         = now()
      WHERE id = $10
    `, [
      b.cliente_id,
      b.operacion_id   || null,
      b.medio_envio,
      b.transportista  || null,
      b.nro_seguimiento|| null,
      b.direccion_entrega || null,
      b.fecha_emision  || new Date().toISOString().split('T')[0],
      b.fecha_entrega_est || null,
      b.notas          || null,
      id,
    ]);

    // Reemplazar items
    await client.query(`DELETE FROM remito_items WHERE remito_id=$1`, [id]);
    for (const item of b.items ?? []) {
      await client.query(`
        INSERT INTO remito_items
          (remito_id, producto_id, descripcion, cantidad, precio_unitario, estado_producto, notas_item)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        id,
        item.producto_id     || null,
        item.descripcion,
        item.cantidad        || 1,
        item.precio_unitario != null ? parseFloat(item.precio_unitario) : null,
        item.estado_producto || 'nuevo',
        item.notas_item      || null,
      ]);
    }

    await client.query('COMMIT');
    const { rows: [updated] } = await db.query(`${WITH_CLIENTE} WHERE r.id = $1`, [id]);
    return c.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id/estado — transición de estado + movimientos de stock
remitos.patch('/:id/estado', async (c) => {
  const { id } = c.req.param();
  const user   = c.get('user');
  const { estado: nuevoEstado, fecha_entrega_real } = await c.req.json() as {
    estado: string; fecha_entrega_real?: string;
  };

  const TRANSICIONES: Record<string, string[]> = {
    borrador:   ['emitido', 'cancelado'],
    emitido:    ['entregado', 'cancelado'],
    entregado:  ['cancelado'],
    cancelado:  [],
  };

  const { rows: [remito] } = await db.query(
    `SELECT r.*, json_agg(json_build_object('producto_id', ri.producto_id, 'cantidad', ri.cantidad)) AS items
     FROM remitos r
     LEFT JOIN remito_items ri ON ri.remito_id = r.id
     WHERE r.id = $1
     GROUP BY r.id`, [id]
  );
  if (!remito) return c.json({ error: 'Remito no encontrado' }, 404);

  const estadoActual = remito.estado as string;
  if (!TRANSICIONES[estadoActual]?.includes(nuevoEstado)) {
    return c.json({ error: `No se puede pasar de ${estadoActual} a ${nuevoEstado}` }, 409);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // borrador → emitido: descontar stock
    if (estadoActual === 'borrador' && nuevoEstado === 'emitido' && !remito.stock_descontado) {
      const items = (remito.items as { producto_id: string | null; cantidad: number }[])
        .filter(i => i.producto_id);
      for (const item of items) {
        await client.query(`
          INSERT INTO stock_movimientos
            (producto_id, tipo, cantidad, motivo, referencia_nro, created_by)
          VALUES ($1, 'egreso_remito', $2, 'Remito emitido', $3, $4)
        `, [item.producto_id, -Math.abs(item.cantidad), remito.numero, user?.id || null]);
      }
      await client.query(`UPDATE remitos SET stock_descontado=true WHERE id=$1`, [id]);
    }

    // cancelado habiendo ya descontado: revertir stock
    if (nuevoEstado === 'cancelado' && remito.stock_descontado) {
      const items = (remito.items as { producto_id: string | null; cantidad: number }[])
        .filter(i => i.producto_id);
      for (const item of items) {
        await client.query(`
          INSERT INTO stock_movimientos
            (producto_id, tipo, cantidad, motivo, referencia_nro, created_by)
          VALUES ($1, 'devolucion', $2, 'Cancelación remito', $3, $4)
        `, [item.producto_id, Math.abs(item.cantidad), remito.numero, user?.id || null]);
      }
      await client.query(`UPDATE remitos SET stock_descontado=false WHERE id=$1`, [id]);
    }

    await client.query(`
      UPDATE remitos SET
        estado = $1,
        fecha_entrega_real = COALESCE($2::date, CASE WHEN $1='entregado' THEN CURRENT_DATE ELSE fecha_entrega_real END),
        updated_at = now()
      WHERE id = $3
    `, [nuevoEstado, fecha_entrega_real || null, id]);

    await client.query('COMMIT');
    const { rows: [updated] } = await db.query(`${WITH_CLIENTE} WHERE r.id = $1`, [id]);
    return c.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /:id — solo borrador
remitos.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [r] } = await db.query(`SELECT estado FROM remitos WHERE id=$1`, [id]);
  if (!r) return c.json({ error: 'Remito no encontrado' }, 404);
  if (r.estado !== 'borrador') return c.json({ error: 'Solo se puede eliminar un remito en borrador' }, 409);
  await db.query(`DELETE FROM remitos WHERE id=$1`, [id]);
  return c.json({ ok: true });
});

export default remitos;
