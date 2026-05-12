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

// GET /tablero — datos completos para la agenda logística
remitos.get('/tablero', async (c) => {
  const primerDiaMes = new Date();
  primerDiaMes.setDate(1);
  primerDiaMes.setHours(0, 0, 0, 0);

  const [statsRow, listRows, hoyRows, atrasadasRows, metodosRows, metricasRow] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE r.estado IN ('borrador','emitido'))::int AS pendientes,
        COUNT(*) FILTER (WHERE r.fecha_entrega_est = CURRENT_DATE AND r.estado NOT IN ('entregado','cancelado'))::int AS para_hoy,
        COUNT(*) FILTER (WHERE r.fecha_entrega_est < CURRENT_DATE AND r.estado NOT IN ('entregado','cancelado'))::int AS atrasados,
        COUNT(*) FILTER (WHERE r.estado = 'entregado' AND r.updated_at >= $1)::int AS entregados_mes,
        COALESCE(SUM(ri_sum.total) FILTER (WHERE r.estado IN ('borrador','emitido')), 0)::numeric AS valor_pendiente
      FROM remitos r
      LEFT JOIN LATERAL (
        SELECT SUM(ri.precio_unitario * ri.cantidad) AS total
        FROM remito_items ri WHERE ri.remito_id = r.id
      ) ri_sum ON true
    `, [primerDiaMes.toISOString()]),

    db.query(`
      SELECT r.id, r.numero, r.estado, r.medio_envio, r.transportista,
        r.nro_seguimiento, r.direccion_entrega, r.fecha_emision,
        r.fecha_entrega_est, r.fecha_entrega_real, r.notas, r.stock_descontado,
        json_build_object('id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono) AS cliente,
        CASE WHEN o.id IS NOT NULL
          THEN json_build_object('id', o.id, 'numero', o.numero)
          ELSE NULL END AS operacion,
        COALESCE(ri_sum.total, 0)::numeric AS valor_total,
        ri_agg.items_resumen
      FROM remitos r
      JOIN clientes c ON c.id = r.cliente_id
      LEFT JOIN operaciones o ON o.id = r.operacion_id
      LEFT JOIN LATERAL (
        SELECT SUM(ri.precio_unitario * ri.cantidad) AS total
        FROM remito_items ri WHERE ri.remito_id = r.id
      ) ri_sum ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object('descripcion', ri.descripcion, 'cantidad', ri.cantidad)
          ORDER BY ri.id
        ) AS items_resumen
        FROM remito_items ri WHERE ri.remito_id = r.id
      ) ri_agg ON true
      ORDER BY
        CASE WHEN r.fecha_entrega_est < CURRENT_DATE AND r.estado NOT IN ('entregado','cancelado') THEN 0 ELSE 1 END,
        CASE WHEN r.fecha_entrega_est = CURRENT_DATE AND r.estado NOT IN ('entregado','cancelado') THEN 0 ELSE 1 END,
        r.fecha_entrega_est ASC NULLS LAST,
        r.created_at DESC
      LIMIT 300
    `),

    db.query(`
      SELECT r.id, r.numero, r.fecha_entrega_est,
        json_build_object('nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona) AS cliente,
        COALESCE((SELECT SUM(ri.precio_unitario * ri.cantidad) FROM remito_items ri WHERE ri.remito_id = r.id), 0)::numeric AS valor_total
      FROM remitos r JOIN clientes c ON c.id = r.cliente_id
      WHERE r.fecha_entrega_est = CURRENT_DATE AND r.estado NOT IN ('entregado','cancelado')
      ORDER BY r.created_at ASC LIMIT 10
    `),

    db.query(`
      SELECT r.id, r.numero, r.fecha_entrega_est,
        json_build_object('nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona) AS cliente,
        COALESCE((SELECT SUM(ri.precio_unitario * ri.cantidad) FROM remito_items ri WHERE ri.remito_id = r.id), 0)::numeric AS valor_total
      FROM remitos r JOIN clientes c ON c.id = r.cliente_id
      WHERE r.fecha_entrega_est < CURRENT_DATE AND r.estado NOT IN ('entregado','cancelado')
      ORDER BY r.fecha_entrega_est ASC LIMIT 10
    `),

    db.query(`
      SELECT medio_envio, COUNT(*)::int AS n
      FROM remitos
      WHERE created_at >= NOW() - INTERVAL '3 months'
      GROUP BY medio_envio ORDER BY n DESC
    `),

    db.query(`
      SELECT
        ROUND(COALESCE(AVG(EXTRACT(DAY FROM (r.fecha_entrega_real::timestamp - r.fecha_emision::timestamp))), 0)::numeric, 1) AS tiempo_promedio,
        COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE r.fecha_entrega_real::date <= r.fecha_entrega_est) /
          NULLIF(COUNT(*) FILTER (WHERE r.fecha_entrega_real IS NOT NULL AND r.fecha_entrega_est IS NOT NULL), 0)), 0)::int AS pct_a_tiempo,
        COALESCE((
          SELECT SUM(ri_sum.total) FROM (
            SELECT (SELECT SUM(ri.precio_unitario * ri.cantidad) FROM remito_items ri WHERE ri.remito_id = r2.id) AS total
            FROM remitos r2 WHERE r2.estado = 'entregado' AND r2.updated_at >= $1
          ) ri_sum
        ), 0)::numeric AS valor_entregado_mes,
        COUNT(*) FILTER (WHERE r.estado = 'entregado' AND r.updated_at >= $1)::int AS entregados_mes
      FROM remitos r WHERE r.estado = 'entregado'
    `, [primerDiaMes.toISOString()]),
  ]);

  const s = statsRow.rows[0];
  const m = metricasRow.rows[0];
  const totalMetodos = metodosRows.rows.reduce((acc: number, r: { n: number }) => acc + r.n, 0) || 1;

  return c.json({
    stats: {
      pendientes:      s.pendientes,
      para_hoy:        s.para_hoy,
      atrasados:       s.atrasados,
      entregados_mes:  s.entregados_mes,
      valor_pendiente: parseFloat(s.valor_pendiente),
    },
    remitos:            listRows.rows,
    entregas_hoy:       hoyRows.rows,
    entregas_atrasadas: atrasadasRows.rows,
    metodos_envio:      metodosRows.rows.map((r: { medio_envio: string; n: number }) => ({
      medio_envio: r.medio_envio,
      n: r.n,
      pct: Math.round((r.n / totalMetodos) * 100),
    })),
    metricas: {
      tiempo_promedio:     parseFloat(m.tiempo_promedio),
      pct_a_tiempo:        m.pct_a_tiempo,
      valor_entregado_mes: parseFloat(m.valor_entregado_mes),
      entregados_mes:      m.entregados_mes,
    },
  });
});

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

// POST /:id/generar-link — genera token de confirmación digital
remitos.post('/:id/generar-link', async (c) => {
  const { id } = c.req.param();
  const { rows: [rem] } = await db.query(
    `SELECT id, numero, cliente_id FROM remitos WHERE id = $1`, [id]
  );
  if (!rem) return c.json({ error: 'No encontrado' }, 404);

  const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  await db.query(
    `UPDATE remitos SET token_acceso = $1, token_acceso_at = now() WHERE id = $2`,
    [token, id]
  );
  return c.json({ url: `${appUrl}/r/${token}` });
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

    // borrador → emitido: cancelar reservas previas + descontar stock
    if (estadoActual === 'borrador' && nuevoEstado === 'emitido' && !remito.stock_descontado) {
      const items = (remito.items as { producto_id: string | null; cantidad: number }[])
        .filter(i => i.producto_id);

      // Cancelar reservas existentes para esta operación (netear a cero)
      if (remito.operacion_id) {
        const { rows: reservas } = await client.query(`
          SELECT producto_id, SUM(cantidad) AS total
          FROM stock_movimientos
          WHERE operacion_id = $1 AND tipo = 'reserva'
          GROUP BY producto_id
          HAVING SUM(cantidad) < 0
        `, [remito.operacion_id]);

        for (const r of reservas) {
          await client.query(`
            INSERT INTO stock_movimientos
              (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
            VALUES ($1, 'reserva', $2, 'Cancelación reserva por remito', $3, $4, $5)
          `, [r.producto_id, Math.abs(Number(r.total)), remito.operacion_id, remito.numero, user?.id || null]);
        }
      }

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

    // Al entregar: marcar la operación vinculada como entregada
    if (nuevoEstado === 'entregado' && remito.operacion_id) {
      await client.query(`
        UPDATE operaciones SET estado = 'entregado', updated_at = now()
        WHERE id = $1 AND estado NOT IN ('cancelado', 'entregado')
      `, [remito.operacion_id]);
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
