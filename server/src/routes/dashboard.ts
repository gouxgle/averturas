import { Hono } from 'hono';
import { db } from '../db.js';

const dashboard = new Hono();

// Indicadores de acción
dashboard.get('/indicadores', async (c) => {
  const [sinConfirmar, sinPago, pagadosNoEntregados, compromisosSemana, stockBajo] = await Promise.all([

    // a) Presupuestos sin confirmar (estado presupuesto o enviado)
    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente
      FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado IN ('presupuesto','enviado')
      ORDER BY o.created_at ASC
      LIMIT 10
    `),

    // b) Presupuestos sin pago (aprobados sin recibos emitidos)
    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente
      FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado = 'aprobado'
        AND NOT EXISTS (
          SELECT 1 FROM recibos r
          WHERE r.operacion_id = o.id AND r.estado = 'emitido'
        )
      ORDER BY o.created_at ASC
      LIMIT 10
    `),

    // c) Pagados (cobro total) pero no entregados
    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente,
        COALESCE((
          SELECT SUM(r.monto_total) FROM recibos r
          WHERE r.operacion_id = o.id AND r.estado = 'emitido'
        ), 0) AS cobrado
      FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado NOT IN ('cancelado','entregado')
        AND COALESCE((
          SELECT SUM(r.monto_total) FROM recibos r
          WHERE r.operacion_id = o.id AND r.estado = 'emitido'
        ), 0) >= o.precio_total
        AND NOT EXISTS (
          SELECT 1 FROM remitos rm
          WHERE rm.operacion_id = o.id AND rm.estado = 'entregado'
        )
      ORDER BY o.created_at ASC
      LIMIT 10
    `),

    // d) Compromisos de pago que vencen esta semana (lunes a domingo)
    db.query(`
      SELECT cp.id, cp.monto, cp.fecha_vencimiento, cp.tipo, cp.descripcion,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente,
        json_build_object('id', op.id, 'numero', op.numero) AS operacion
      FROM compromisos_pago cp
      JOIN clientes cl ON cl.id = cp.cliente_id
      LEFT JOIN operaciones op ON op.id = cp.operacion_id
      WHERE cp.estado = 'pendiente'
        AND cp.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ORDER BY cp.fecha_vencimiento ASC
      LIMIT 20
    `),

    // e) Productos con stock bajo o en cero
    db.query(`
      SELECT p.id, p.nombre, p.stock_minimo,
        p.stock_inicial + COALESCE(SUM(sm.cantidad), 0) AS stock_actual
      FROM catalogo_productos p
      LEFT JOIN stock_movimientos sm ON sm.producto_id = p.id
      WHERE p.activo = true AND p.stock_minimo > 0
      GROUP BY p.id, p.nombre, p.stock_minimo, p.stock_inicial
      HAVING p.stock_inicial + COALESCE(SUM(sm.cantidad), 0) <= p.stock_minimo
      ORDER BY (p.stock_inicial + COALESCE(SUM(sm.cantidad), 0)) ASC
      LIMIT 10
    `),
  ]);

  return c.json({
    sin_confirmar:          sinConfirmar.rows,
    sin_pago:               sinPago.rows,
    pagados_no_entregados:  pagadosNoEntregados.rows,
    compromisos_semana:     compromisosSemana.rows,
    stock_bajo:             stockBajo.rows,
  });
});

dashboard.get('/stats', async (c) => {
  const primerDiaMes = new Date();
  primerDiaMes.setDate(1);
  primerDiaMes.setHours(0, 0, 0, 0);

  const [presupuestos, ventas, clientes, crm] = await Promise.all([
    db.query(`
      SELECT COUNT(*) AS total FROM operaciones
      WHERE estado IN ('presupuesto','enviado','aprobado')
    `),
    db.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(precio_total),0) AS monto
      FROM operaciones
      WHERE estado NOT IN ('cancelado','presupuesto','enviado')
        AND created_at >= $1
    `, [primerDiaMes.toISOString()]),
    db.query(`SELECT COUNT(*) AS total FROM clientes WHERE activo = true`),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'prospecto') AS prospectos,
        COUNT(*) FILTER (
          WHERE estado IN ('activo','recurrente')
          AND (ultima_interaccion IS NULL OR ultima_interaccion < now() - interval '30 days')
        ) AS sin_contacto_30,
        (SELECT COUNT(*) FROM tareas WHERE completada = false AND vencimiento < CURRENT_DATE) AS tareas_vencidas
      FROM clientes WHERE activo = true
    `),
  ]);

  return c.json({
    presupuestos_activos:  parseInt(presupuestos.rows[0].total),
    ventas_mes:            parseInt(ventas.rows[0].count),
    monto_mes:             parseFloat(ventas.rows[0].monto),
    clientes_total:        parseInt(clientes.rows[0].total),
    prospectos:            parseInt(crm.rows[0].prospectos),
    sin_contacto_30:       parseInt(crm.rows[0].sin_contacto_30),
    tareas_vencidas:       parseInt(crm.rows[0].tareas_vencidas),
  });
});

dashboard.get('/recientes', async (c) => {
  const { rows } = await db.query(`
    SELECT o.*,
      json_build_object(
        'nombre', c.nombre, 'apellido', c.apellido,
        'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona
      ) AS cliente
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
    ORDER BY o.created_at DESC LIMIT 5
  `);
  return c.json(rows);
});

dashboard.get('/pendientes', async (c) => {
  const { rows } = await db.query(`
    SELECT o.*,
      json_build_object(
        'nombre', c.nombre, 'apellido', c.apellido,
        'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona
      ) AS cliente
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado IN ('presupuesto','enviado')
    ORDER BY o.created_at ASC LIMIT 5
  `);
  return c.json(rows);
});

dashboard.get('/tareas-hoy', async (c) => {
  const { rows } = await db.query(`
    SELECT t.*,
      json_build_object(
        'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
        'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona
      ) AS cliente
    FROM tareas t
    JOIN clientes c ON c.id = t.cliente_id
    WHERE t.completada = false
      AND (t.vencimiento IS NULL OR t.vencimiento <= CURRENT_DATE + 1)
    ORDER BY
      CASE WHEN t.vencimiento < CURRENT_DATE THEN 0 ELSE 1 END,
      t.vencimiento ASC NULLS LAST,
      CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END
    LIMIT 10
  `);
  return c.json(rows);
});

dashboard.get('/sin-contacto', async (c) => {
  const { rows } = await db.query(`
    SELECT c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
      c.telefono, c.estado,
      EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
      CASE WHEN cat.id IS NOT NULL
        THEN json_build_object('nombre', cat.nombre, 'color', cat.color)
        ELSE NULL END AS categoria
    FROM clientes c
    LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
    WHERE c.activo = true
      AND c.estado IN ('activo','recurrente')
      AND (c.ultima_interaccion IS NULL OR c.ultima_interaccion < now() - interval '30 days')
    ORDER BY c.ultima_interaccion ASC NULLS FIRST
    LIMIT 10
  `);
  return c.json(rows);
});

export default dashboard;
