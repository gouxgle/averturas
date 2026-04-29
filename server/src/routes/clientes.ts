import { Hono } from 'hono';
import { db } from '../db.js';

const clientes = new Hono();

clientes.get('/', async (c) => {
  const search = c.req.query('search') ?? '';
  const estado = c.req.query('estado') ?? '';
  const params: unknown[] = [];
  let where = `WHERE c.activo = true`;

  if (search.trim()) {
    params.push(`%${search}%`);
    const n = params.length;
    where += ` AND (c.nombre ILIKE $${n} OR c.apellido ILIKE $${n} OR c.razon_social ILIKE $${n} OR c.telefono ILIKE $${n} OR c.documento_nro ILIKE $${n})`;
  }
  if (estado.trim()) {
    params.push(estado);
    where += ` AND c.estado = $${params.length}`;
  }

  const { rows } = await db.query(`
    SELECT c.*,
      EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
      CASE WHEN cat.id IS NOT NULL
        THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
        ELSE NULL END AS categoria,
      CASE WHEN ref.id IS NOT NULL
        THEN json_build_object('id', ref.id, 'apellido', ref.apellido, 'nombre', ref.nombre, 'razon_social', ref.razon_social, 'tipo_persona', ref.tipo_persona)
        ELSE NULL END AS referido_por
    FROM clientes c
    LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
    LEFT JOIN clientes ref ON ref.id = c.referido_por_id
    ${where}
    ORDER BY c.ultima_interaccion DESC NULLS LAST, c.apellido ASC, c.nombre ASC
    LIMIT 200
  `, params);

  return c.json(rows);
});

// Debe estar ANTES de /:id — Hono matchea en orden de registro
clientes.get('/validar-dni', async (c) => {
  const dni = c.req.query('dni')?.trim();
  const excluirId = c.req.query('excluir_id');
  if (!dni) return c.json({ existe: false });
  let q = `SELECT id, nombre, apellido, razon_social FROM clientes WHERE documento_nro = $1`;
  const params: unknown[] = [dni];
  if (excluirId) { params.push(excluirId); q += ` AND id != $2`; }
  const { rows } = await db.query(q, params);
  return c.json({ existe: rows.length > 0, cliente: rows[0] ?? null });
});

// GET /:id/estado-cuenta — resumen financiero completo del cliente (ANTES de /:id)
clientes.get('/:id/estado-cuenta', async (c) => {
  const { id } = c.req.param();

  const [
    { rows: [cliente] },
    { rows: operaciones },
    { rows: recibos_all },
    { rows: remitos_all },
  ] = await Promise.all([
    db.query(`
      SELECT c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
        c.telefono, c.email, c.direccion, c.localidad, c.documento_nro
      FROM clientes c WHERE c.id = $1
    `, [id]),
    db.query(`
      SELECT o.id, o.numero, o.tipo, o.estado, o.precio_total, o.costo_total,
        o.created_at, o.fecha_validez, o.notas, o.forma_pago,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id, 'descripcion', oi.descripcion,
              'cantidad', oi.cantidad,
              'precio_unitario', oi.precio_unitario,
              'precio_instalacion', oi.precio_instalacion,
              'incluye_instalacion', oi.incluye_instalacion,
              'precio_total', (oi.precio_unitario + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion ELSE 0 END) * oi.cantidad,
              'medida_ancho', oi.medida_ancho, 'medida_alto', oi.medida_alto,
              'color', oi.color, 'vidrio', oi.vidrio,
              'tipo_abertura', ta.nombre, 'sistema', s.nombre
            ) ORDER BY oi.orden
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM operaciones o
      LEFT JOIN operacion_items oi ON oi.operacion_id = o.id
      LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
      LEFT JOIN sistemas s ON s.id = oi.sistema_id
      WHERE o.cliente_id = $1 AND o.estado NOT IN ('cancelado')
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [id]),
    db.query(`
      SELECT r.id, r.numero, r.fecha, r.monto_total, r.forma_pago,
        r.concepto, r.estado, r.operacion_id,
        COALESCE(
          json_agg(
            json_build_object(
              'descripcion', ri.descripcion,
              'monto', ri.monto,
              'cantidad', ri.cantidad
            ) ORDER BY ri.orden
          ) FILTER (WHERE ri.id IS NOT NULL),
          '[]'
        ) AS items
      FROM recibos r
      LEFT JOIN recibo_items ri ON ri.recibo_id = r.id
      WHERE r.cliente_id = $1 AND r.estado != 'anulado'
      GROUP BY r.id
      ORDER BY r.fecha ASC, r.created_at ASC
    `, [id]),
    db.query(`
      SELECT id, numero, fecha_emision, estado, operacion_id, medio_envio,
        fecha_entrega_real
      FROM remitos
      WHERE cliente_id = $1 AND estado != 'cancelado'
      ORDER BY fecha_emision ASC
    `, [id]),
  ]);

  if (!cliente) return c.json({ error: 'Cliente no encontrado' }, 404);

  // Agrupar recibos y remitos por operacion
  const recibosMap: Record<string, typeof recibos_all> = {};
  const recibosDirectos: typeof recibos_all = [];
  for (const r of recibos_all) {
    if (r.operacion_id) {
      if (!recibosMap[r.operacion_id]) recibosMap[r.operacion_id] = [];
      recibosMap[r.operacion_id].push(r);
    } else {
      recibosDirectos.push(r);
    }
  }
  const remitosMap: Record<string, typeof remitos_all> = {};
  for (const rm of remitos_all) {
    if (rm.operacion_id) {
      if (!remitosMap[rm.operacion_id]) remitosMap[rm.operacion_id] = [];
      remitosMap[rm.operacion_id].push(rm);
    }
  }

  // Calcular totales por operacion y globales
  let totalPresupuestado = 0;
  let totalCobrado = 0;

  const operacionesConDetalle = operaciones.map((op: any) => {
    const recibosOp = recibosMap[op.id] ?? [];
    const remitosOp = remitosMap[op.id] ?? [];
    const cobrado = recibosOp.reduce((s: number, r: any) => s + Number(r.monto_total), 0);
    const saldo = Number(op.precio_total) - cobrado;
    totalPresupuestado += Number(op.precio_total);
    totalCobrado += cobrado;
    return { ...op, recibos: recibosOp, remitos: remitosOp, cobrado, saldo };
  });

  const cobradoDirecto = recibosDirectos.reduce((s, r) => s + Number(r.monto_total), 0);
  totalCobrado += cobradoDirecto;

  return c.json({
    cliente,
    operaciones: operacionesConDetalle,
    recibos_directos: recibosDirectos,
    totales: {
      presupuestado: totalPresupuestado,
      cobrado: totalCobrado,
      saldo: totalPresupuestado - totalCobrado,
    },
  });
});

clientes.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [
    { rows: [cliente] },
    { rows: operaciones },
    { rows: interacciones },
    { rows: tareas },
    { rows: recibos },
    { rows: remitos },
  ] = await Promise.all([
    db.query(`
      SELECT c.*,
        EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
        CASE WHEN cat.id IS NOT NULL
          THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
          ELSE NULL END AS categoria,
        CASE WHEN ref.id IS NOT NULL
          THEN json_build_object('id', ref.id, 'apellido', ref.apellido, 'nombre', ref.nombre, 'razon_social', ref.razon_social, 'tipo_persona', ref.tipo_persona)
          ELSE NULL END AS referido_por
      FROM clientes c
      LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
      LEFT JOIN clientes ref ON ref.id = c.referido_por_id
      WHERE c.id = $1
    `, [id]),
    db.query(`
      SELECT id, numero, tipo, estado, precio_total, created_at
      FROM operaciones WHERE cliente_id = $1
      ORDER BY created_at DESC
    `, [id]),
    db.query(`
      SELECT i.*,
        CASE WHEN u.id IS NOT NULL
          THEN json_build_object('nombre', u.nombre)
          ELSE NULL END AS created_by_usuario
      FROM interacciones i
      LEFT JOIN usuarios u ON u.id = i.created_by
      WHERE i.cliente_id = $1
      ORDER BY i.created_at DESC LIMIT 50
    `, [id]),
    db.query(`
      SELECT t.*,
        CASE WHEN u.id IS NOT NULL
          THEN json_build_object('nombre', u.nombre)
          ELSE NULL END AS created_by_usuario
      FROM tareas t
      LEFT JOIN usuarios u ON u.id = t.created_by
      WHERE t.cliente_id = $1
      ORDER BY t.completada ASC,
        CASE WHEN t.vencimiento IS NULL THEN 1 ELSE 0 END,
        t.vencimiento ASC,
        CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END
    `, [id]),
    db.query(`
      SELECT r.id, r.numero, r.fecha, r.monto_total, r.forma_pago, r.estado,
        r.operacion_id,
        CASE WHEN op.id IS NOT NULL
          THEN json_build_object('id', op.id, 'numero', op.numero)
          ELSE NULL END AS operacion
      FROM recibos r
      LEFT JOIN operaciones op ON op.id = r.operacion_id
      WHERE r.cliente_id = $1 AND r.estado != 'anulado'
      ORDER BY r.fecha DESC, r.created_at DESC
      LIMIT 50
    `, [id]),
    db.query(`
      SELECT r.id, r.numero, r.fecha_emision, r.estado, r.operacion_id,
        CASE WHEN op.id IS NOT NULL
          THEN json_build_object('id', op.id, 'numero', op.numero)
          ELSE NULL END AS operacion
      FROM remitos r
      LEFT JOIN operaciones op ON op.id = r.operacion_id
      WHERE r.cliente_id = $1 AND r.estado != 'cancelado'
      ORDER BY r.fecha_emision DESC, r.created_at DESC
      LIMIT 50
    `, [id]),
  ]);

  if (!cliente) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json({ ...cliente, operaciones, interacciones, tareas, recibos, remitos });
});

clientes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    INSERT INTO clientes
      (tipo_persona, nombre, apellido, razon_social, documento_nro,
       telefono, telefono_fijo, email, direccion, localidad, categoria_id,
       estado, origen, fecha_nacimiento, genero,
       preferencia_contacto, acepta_marketing, referido_por_id, notas, created_by,
       dom_obra, dom_obra_localidad)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING *
  `, [
    body.tipo_persona?.trim() || 'fisica',
    body.nombre?.trim() || null,
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.documento_nro?.trim() || null,
    body.telefono?.trim() || null,
    body.telefono_fijo?.trim() || null,
    body.email?.trim() || null,
    body.direccion?.trim() || null,
    body.localidad?.trim() || null,
    body.categoria_id || null,
    body.estado?.trim() || 'activo',
    body.origen?.trim() || null,
    body.fecha_nacimiento || null,
    body.genero?.trim() || null,
    body.preferencia_contacto?.trim() || null,
    body.acepta_marketing ?? true,
    body.referido_por_id || null,
    body.notas?.trim() || null,
    user.id,
    body.dom_obra?.trim() || null,
    body.dom_obra_localidad?.trim() || null,
  ]);

  return c.json(row, 201);
});

clientes.put('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    UPDATE clientes SET
      tipo_persona    = $1,
      nombre          = $2,
      apellido        = $3,
      razon_social    = $4,
      documento_nro   = $5,
      telefono        = $6,
      telefono_fijo   = $7,
      email           = $8,
      direccion       = $9,
      localidad       = $10,
      categoria_id    = $11,
      estado          = $12,
      origen          = $13,
      fecha_nacimiento= $14,
      genero               = $15,
      preferencia_contacto = $16,
      acepta_marketing     = $17,
      referido_por_id      = $18,
      notas                = $19,
      dom_obra             = $20,
      dom_obra_localidad   = $21
    WHERE id = $22 RETURNING *
  `, [
    body.tipo_persona?.trim() || 'fisica',
    body.nombre?.trim() || null,
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.documento_nro?.trim() || null,
    body.telefono?.trim() || null,
    body.telefono_fijo?.trim() || null,
    body.email?.trim() || null,
    body.direccion?.trim() || null,
    body.localidad?.trim() || null,
    body.categoria_id || null,
    body.estado?.trim() || 'activo',
    body.origen?.trim() || null,
    body.fecha_nacimiento || null,
    body.genero?.trim() || null,
    body.preferencia_contacto?.trim() || null,
    body.acepta_marketing ?? true,
    body.referido_por_id || null,
    body.notas?.trim() || null,
    body.dom_obra?.trim() || null,
    body.dom_obra_localidad?.trim() || null,
    id,
  ]);

  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json(row);
});

clientes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [op] } = await db.query(
    `SELECT COUNT(*) AS n FROM operaciones WHERE cliente_id = $1`, [id]
  );
  if (parseInt(op.n) > 0) {
    return c.json({ error: 'El cliente tiene operaciones asociadas y no puede eliminarse' }, 409);
  }
  const { rows: [row] } = await db.query(
    `DELETE FROM clientes WHERE id = $1 RETURNING id`, [id]
  );
  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json({ ok: true });
});

export default clientes;
