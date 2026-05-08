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

operaciones.get('/tablero', async (c) => {
  const lunes = new Date();
  const dow = lunes.getDay() === 0 ? 6 : lunes.getDay() - 1;
  lunes.setDate(lunes.getDate() - dow);
  lunes.setHours(0, 0, 0, 0);

  const [statsRow, kanbanRows, proximasRows, detalleRows] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado NOT IN ('entregado','cancelado'))::int                                                       AS total,
        COALESCE(SUM(precio_total) FILTER (WHERE estado NOT IN ('entregado','cancelado')), 0)::numeric                            AS valor_total,
        COUNT(*) FILTER (WHERE estado = 'en_produccion')::int                                                                     AS en_produccion,
        COALESCE(SUM(precio_total) FILTER (WHERE estado = 'en_produccion'), 0)::numeric                                           AS valor_produccion,
        COUNT(*) FILTER (WHERE estado = 'listo')::int                                                                             AS listos,
        COALESCE(SUM(precio_total) FILTER (WHERE estado = 'listo'), 0)::numeric                                                   AS valor_listos,
        COUNT(*) FILTER (WHERE estado NOT IN ('entregado','cancelado') AND fecha_entrega_estimada < CURRENT_DATE)::int             AS atrasadas,
        COALESCE(SUM(precio_total) FILTER (WHERE estado NOT IN ('entregado','cancelado') AND fecha_entrega_estimada < CURRENT_DATE), 0)::numeric AS valor_atrasadas,
        COUNT(*) FILTER (WHERE estado = 'entregado' AND updated_at >= $1)::int                                                    AS entregadas_semana,
        COALESCE(SUM(precio_total) FILTER (WHERE estado = 'entregado' AND updated_at >= $1), 0)::numeric                          AS valor_entregadas_semana
      FROM operaciones
    `, [lunes.toISOString()]),

    db.query(`
      SELECT o.id, o.numero, o.estado, o.tipo, o.precio_total::numeric, o.margen,
        o.created_at, o.fecha_entrega_estimada, o.tiempo_entrega, o.updated_at,
        EXTRACT(DAY FROM now() - o.updated_at)::int AS dias_en_estado,
        json_build_object('id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono) AS cliente,
        (SELECT oi.descripcion FROM operacion_items oi WHERE oi.operacion_id = o.id ORDER BY oi.orden LIMIT 1) AS primer_item,
        (SELECT CONCAT(oi.medida_ancho::text, 'x', oi.medida_alto::text)
          FROM operacion_items oi
          WHERE oi.operacion_id = o.id AND oi.medida_ancho IS NOT NULL AND oi.medida_alto IS NOT NULL
          ORDER BY oi.orden LIMIT 1) AS medidas
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado IN ('aprobado','en_produccion','listo','entregado','cancelado')
      ORDER BY
        CASE o.estado WHEN 'aprobado' THEN 1 WHEN 'en_produccion' THEN 2 WHEN 'listo' THEN 3 WHEN 'entregado' THEN 4 ELSE 5 END,
        CASE WHEN o.fecha_entrega_estimada < CURRENT_DATE AND o.estado NOT IN ('entregado','cancelado') THEN 0 ELSE 1 END,
        o.fecha_entrega_estimada ASC NULLS LAST,
        o.created_at ASC
    `),

    db.query(`
      SELECT o.id, o.numero, o.precio_total::numeric, o.estado, o.fecha_entrega_estimada,
        json_build_object('nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado NOT IN ('entregado','cancelado')
        AND o.fecha_entrega_estimada IS NOT NULL
        AND o.fecha_entrega_estimada >= CURRENT_DATE
        AND o.fecha_entrega_estimada <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY o.fecha_entrega_estimada ASC
      LIMIT 20
    `),

    db.query(`
      SELECT o.id, o.numero, o.estado, o.tipo, o.precio_total::numeric, o.margen,
        o.created_at, o.fecha_entrega_estimada, o.updated_at,
        EXTRACT(DAY FROM now() - o.updated_at)::int AS dias_en_estado,
        json_build_object('id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono) AS cliente,
        (SELECT oi.descripcion FROM operacion_items oi WHERE oi.operacion_id = o.id ORDER BY oi.orden LIMIT 1) AS primer_item,
        (SELECT CONCAT(oi.medida_ancho::text, 'x', oi.medida_alto::text)
          FROM operacion_items oi
          WHERE oi.operacion_id = o.id AND oi.medida_ancho IS NOT NULL AND oi.medida_alto IS NOT NULL
          ORDER BY oi.orden LIMIT 1) AS medidas
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado NOT IN ('cancelado')
      ORDER BY
        CASE WHEN o.fecha_entrega_estimada < CURRENT_DATE AND o.estado NOT IN ('entregado','cancelado') THEN 0 ELSE 1 END,
        o.fecha_entrega_estimada ASC NULLS LAST,
        o.created_at DESC
      LIMIT 100
    `),
  ]);

  const s = statsRow.rows[0];
  const ops = kanbanRows.rows;

  return c.json({
    stats: {
      total:                  s.total,
      valor_total:            parseFloat(s.valor_total),
      en_produccion:          s.en_produccion,
      valor_produccion:       parseFloat(s.valor_produccion),
      listos:                 s.listos,
      valor_listos:           parseFloat(s.valor_listos),
      atrasadas:              s.atrasadas,
      valor_atrasadas:        parseFloat(s.valor_atrasadas),
      entregadas_semana:      s.entregadas_semana,
      valor_entregadas_semana: parseFloat(s.valor_entregadas_semana),
    },
    kanban: {
      confirmado:    ops.filter(o => o.estado === 'aprobado'),
      en_produccion: ops.filter(o => o.estado === 'en_produccion'),
      listo:         ops.filter(o => o.estado === 'listo'),
      entregado:     ops.filter(o => o.estado === 'entregado'),
      cancelado:     ops.filter(o => o.estado === 'cancelado'),
    },
    proximas: proximasRows.rows,
    detalle:  detalleRows.rows,
  });
});

operaciones.get('/ventas-panel', async (c) => {
  const [statsRow, listRows, seguimientoRows] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE o.estado IN ('presupuesto','enviado'))::int AS total_activos,
        COALESCE(SUM(o.precio_total) FILTER (WHERE o.estado IN ('presupuesto','enviado')), 0)::numeric AS importe_total,
        COUNT(*) FILTER (
          WHERE o.estado = 'enviado'
            AND COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 3
        )::int AS sin_respuesta_count,
        COALESCE(SUM(o.precio_total) FILTER (
          WHERE o.estado = 'enviado'
            AND COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 3
        ), 0)::numeric AS sin_respuesta_monto,
        COUNT(*) FILTER (
          WHERE o.estado IN ('presupuesto','enviado') AND o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE
        )::int AS vencidos_count,
        COALESCE(SUM(o.precio_total) FILTER (
          WHERE o.estado IN ('presupuesto','enviado') AND o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE
        ), 0)::numeric AS vencidos_monto,
        COALESCE(ROUND(
          100.0 * COUNT(*) FILTER (WHERE o.estado = 'aprobado' AND o.created_at >= now() - INTERVAL '30 days') /
          NULLIF(COUNT(*) FILTER (WHERE o.estado IN ('aprobado','cancelado','rechazado') AND o.created_at >= now() - INTERVAL '30 days'), 0)
        , 0), 0)::int AS tasa_cierre_pct
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
    `),

    db.query(`
      SELECT
        o.id, o.numero, o.tipo, o.estado, o.precio_total::numeric,
        o.created_at, o.fecha_validez, o.aprobado_online_at,
        EXTRACT(DAY FROM now() - o.fecha_validez)::int                         AS dias_vencido,
        EXTRACT(DAY FROM o.fecha_validez - now())::int                         AS dias_hasta_vencimiento,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999)::int     AS dias_sin_respuesta,
        (SELECT i.tipo FROM interacciones i WHERE i.cliente_id = c.id ORDER BY i.created_at DESC LIMIT 1) AS ultimo_contacto_canal,
        json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono, 'email', c.email
        ) AS cliente,
        CASE
          WHEN o.estado IN ('aprobado','cancelado','rechazado') THEN 'baja'
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE THEN 'alta'
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez <= CURRENT_DATE + 3 THEN 'alta'
          WHEN COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 7 THEN 'alta'
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez <= CURRENT_DATE + 7 THEN 'media'
          WHEN COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 3 THEN 'media'
          ELSE 'baja'
        END AS prioridad
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado IN ('presupuesto','enviado','aprobado','cancelado','rechazado')
      ORDER BY
        CASE WHEN o.estado IN ('presupuesto','enviado') THEN 0 ELSE 1 END,
        CASE
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE THEN 0
          WHEN COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 7 THEN 1
          ELSE 2
        END,
        o.precio_total DESC
      LIMIT 200
    `),

    db.query(`
      SELECT
        o.id, o.numero, o.precio_total::numeric, o.estado, o.fecha_validez,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999)::int AS dias_sin_respuesta,
        (SELECT i.tipo FROM interacciones i WHERE i.cliente_id = c.id ORDER BY i.created_at DESC LIMIT 1) AS ultimo_contacto_canal,
        json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono
        ) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado IN ('presupuesto','enviado')
        AND COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 2
      ORDER BY
        CASE WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE THEN 0 ELSE 1 END,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) DESC,
        o.precio_total DESC
      LIMIT 5
    `),
  ]);

  const s = statsRow.rows[0];
  const lista = listRows.rows;
  const sinRespuestaMonto = parseFloat(s.sin_respuesta_monto);
  const vencidosMonto     = parseFloat(s.vencidos_monto);

  const activos  = lista.filter(r => ['presupuesto','enviado'].includes(r.estado));
  const probAlta = activos.filter(r => r.prioridad === 'baja').length;
  const probMedia = activos.filter(r => r.prioridad === 'media').length;
  const probBaja  = activos.filter(r => r.prioridad === 'alta').length;

  return c.json({
    stats: {
      total_activos:       s.total_activos,
      importe_total:       parseFloat(s.importe_total),
      sin_respuesta_count: s.sin_respuesta_count,
      sin_respuesta_monto: sinRespuestaMonto,
      vencidos_count:      s.vencidos_count,
      vencidos_monto:      vencidosMonto,
      tasa_cierre_pct:     s.tasa_cierre_pct,
      en_riesgo_total:     sinRespuestaMonto + vencidosMonto,
    },
    presupuestos: lista.map(r => ({ ...r, precio_total: parseFloat(r.precio_total) })),
    seguimiento_sugerido: seguimientoRows.rows.map(r => ({ ...r, precio_total: parseFloat(r.precio_total) })),
    prob_cierre: { alta: probAlta, media: probMedia, baja: probBaja },
  });
});

// POST /:id/generar-link — crea o regenera token de aprobación pública
operaciones.post('/:id/generar-link', async (c) => {
  const { id } = c.req.param();
  const { rows: [op] } = await db.query(
    `SELECT id, estado FROM operaciones WHERE id = $1`, [id]
  );
  if (!op) return c.json({ error: 'No encontrado' }, 404);

  // Generar token UUID (crypto.randomUUID disponible en Node 19+, fallback manual)
  const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  await db.query(
    `UPDATE operaciones SET token_acceso = $1, token_acceso_at = now() WHERE id = $2`,
    [token, id]
  );

  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return c.json({ token, url: `${appUrl}/p/${token}` });
});

operaciones.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [{ rows: [op] }, { rows: items }, { rows: historial }] = await Promise.all([
    db.query(`
      SELECT o.*,
        json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono, 'email', c.email,
          'direccion', c.direccion, 'localidad', c.localidad,
          'documento_nro', c.documento_nro
        ) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.id = $1
    `, [id]),
    db.query(`
      SELECT oi.*,
        oi.medida_ancho AS ancho,
        oi.medida_alto  AS alto,
        (oi.precio_unitario + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion ELSE 0 END) * oi.cantidad AS precio_total,
        ta.nombre AS tipo_abertura_nombre,
        s.nombre  AS sistema_nombre,
        cp.atributos AS producto_atributos,
        cp.nombre    AS producto_nombre
      FROM operacion_items oi
      LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
      LEFT JOIN sistemas s ON s.id = oi.sistema_id
      LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
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
         tipo_proyecto, forma_pago, tiempo_entrega, forma_envio, costo_envio)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
      b.forma_envio ?? 'retiro_local',
      b.costo_envio ?? 0,
    ]);

    if (b.items?.length) {
      for (const [idx, item] of b.items.entries()) {
        await client.query(`
          INSERT INTO operacion_items
            (operacion_id, orden, tipo_abertura_id, sistema_id, descripcion,
             medida_ancho, medida_alto, cantidad, costo_unitario, precio_unitario,
             incluye_instalacion, costo_instalacion, precio_instalacion,
             vidrio, premarco, origen, color, accesorios, producto_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
          item.producto_id || null,
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

operaciones.put('/:id', async (c) => {
  const { id } = c.req.param();
  const b = await c.req.json();

  const { rows: [existing] } = await db.query(
    'SELECT estado FROM operaciones WHERE id=$1', [id]
  );
  if (!existing) return c.json({ error: 'No encontrada' }, 404);
  if (existing.estado === 'aprobado') {
    return c.json({ error: 'No se puede editar un presupuesto aprobado' }, 409);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [op] } = await client.query(`
      UPDATE operaciones SET
        tipo              = $1,
        tipo_proyecto     = $2,
        forma_pago        = $3,
        tiempo_entrega    = $4,
        notas             = $5,
        notas_internas    = $6,
        fecha_validez     = $7,
        forma_envio       = $8,
        costo_envio       = $9,
        incluye_instalacion = $10,
        updated_at        = now()
      WHERE id = $11
      RETURNING *
    `, [
      b.tipo ?? 'a_medida_proveedor',
      b.tipo_proyecto || null,
      b.forma_pago || null,
      b.tiempo_entrega ? parseInt(b.tiempo_entrega) : null,
      b.notas || null,
      b.notas_internas || null,
      b.fecha_validez || null,
      b.forma_envio ?? 'retiro_local',
      b.costo_envio ?? 0,
      b.items?.some((i: any) => i.incluye_instalacion) ?? false,
      id,
    ]);

    await client.query('DELETE FROM operacion_items WHERE operacion_id=$1', [id]);

    if (b.items?.length) {
      for (const [idx, item] of b.items.entries()) {
        await client.query(`
          INSERT INTO operacion_items
            (operacion_id, orden, tipo_abertura_id, sistema_id, descripcion,
             medida_ancho, medida_alto, cantidad, costo_unitario, precio_unitario,
             incluye_instalacion, costo_instalacion, precio_instalacion,
             vidrio, premarco, origen, color, accesorios, producto_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        `, [
          id, idx,
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
          item.producto_id || null,
        ]);
      }
    }

    await client.query('COMMIT');
    return c.json(op);
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
