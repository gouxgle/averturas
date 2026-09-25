import { Hono } from 'hono';
import { db } from '../db.js';

const dashboard = new Hono();

dashboard.get('/resumen', async (c) => {
  const primerDiaMes = new Date();
  primerDiaMes.setDate(1);
  primerDiaMes.setHours(0, 0, 0, 0);

  const [
    statsRow,
    sinConfirmar,
    sinPago,
    pagadosNoEntregados,
    compromisosSemana,
    stockBajo,
    topProductos,
    sinContacto,
    recientes,
    pedidosAtrasados,
    oportunidadesPendientes,
    entregasHoy,
  ] = await Promise.all([

    db.query(`
      SELECT
        (SELECT COUNT(*) FROM operaciones WHERE estado IN ('presupuesto','enviado','aprobado'))::int AS presupuestos_activos,
        (SELECT COUNT(*) FROM operaciones WHERE estado NOT IN ('cancelado','presupuesto','enviado') AND created_at >= $1)::int AS ventas_mes,
        (SELECT COALESCE(SUM(precio_total),0) FROM operaciones WHERE estado NOT IN ('cancelado','presupuesto','enviado') AND created_at >= $1)::numeric AS monto_mes,
        (SELECT COALESCE(SUM(precio_total),0) FROM operaciones WHERE estado NOT IN ('cancelado','presupuesto','enviado') AND DATE(created_at) = CURRENT_DATE)::numeric AS ventas_hoy,
        (SELECT COUNT(*) FROM clientes WHERE activo = true)::int AS clientes_total,
        (SELECT COUNT(*) FROM clientes WHERE activo = true AND estado = 'prospecto')::int AS prospectos,
        (SELECT COUNT(*) FROM clientes WHERE activo = true AND estado IN ('activo','recurrente') AND (ultima_interaccion IS NULL OR ultima_interaccion < now() - interval '30 days'))::int AS sin_contacto_30,
        (SELECT COUNT(*) FROM tareas WHERE completada = false AND vencimiento < CURRENT_DATE)::int AS tareas_vencidas
    `, [primerDiaMes.toISOString()]),

    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente,
        (SELECT oi.descripcion FROM operacion_items oi WHERE oi.operacion_id = o.id ORDER BY oi.orden LIMIT 1) AS primer_item
      FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado IN ('presupuesto','enviado')
      ORDER BY o.created_at ASC LIMIT 10
    `),

    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente
      FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado = 'aprobado'
        AND NOT EXISTS (SELECT 1 FROM recibos r WHERE r.operacion_id = o.id AND r.estado = 'emitido')
      ORDER BY o.created_at ASC LIMIT 10
    `),

    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente
      FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado NOT IN ('cancelado','entregado')
        AND COALESCE((SELECT SUM(r.monto_total) FROM recibos r WHERE r.operacion_id = o.id AND r.estado = 'emitido'), 0) >= o.precio_total
        AND NOT EXISTS (SELECT 1 FROM remitos rm WHERE rm.operacion_id = o.id AND rm.estado = 'entregado')
      ORDER BY o.created_at ASC LIMIT 10
    `),

    db.query(`
      SELECT cp.id, cp.monto, cp.fecha_vencimiento, cp.tipo, cp.descripcion,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente,
        json_build_object('id', op.id, 'numero', op.numero) AS operacion
      FROM compromisos_pago cp
      JOIN clientes cl ON cl.id = cp.cliente_id
      LEFT JOIN operaciones op ON op.id = cp.operacion_id
      WHERE cp.estado = 'pendiente'
        AND cp.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
      ORDER BY cp.fecha_vencimiento ASC LIMIT 20
    `),

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

    db.query(`
      SELECT
        oi.descripcion,
        COUNT(DISTINCT o.id)::int AS veces_vendido,
        SUM(oi.cantidad)::int AS unidades,
        SUM(oi.precio_unitario * oi.cantidad)::numeric AS monto_total
      FROM operacion_items oi
      JOIN operaciones o ON o.id = oi.operacion_id
      WHERE o.estado NOT IN ('cancelado', 'presupuesto')
        AND o.created_at >= NOW() - INTERVAL '3 months'
      GROUP BY oi.descripcion
      ORDER BY veces_vendido DESC, unidades DESC
      LIMIT 4
    `),

    db.query(`
      SELECT c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
        c.telefono, c.estado, c.preferencia_contacto, c.ultima_interaccion,
        COALESCE(CURRENT_DATE - c.ultima_interaccion::date, 999) AS dias_sin_contacto
      FROM clientes c
      WHERE c.activo = true
        AND c.estado IN ('activo','recurrente')
        AND (c.ultima_interaccion IS NULL OR c.ultima_interaccion < now() - interval '30 days')
      ORDER BY c.ultima_interaccion ASC NULLS FIRST
      LIMIT 8
    `),

    db.query(`
      SELECT o.id, o.numero, o.precio_total, o.estado, o.created_at,
        json_build_object('nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      ORDER BY o.created_at DESC LIMIT 6
    `),

    db.query(`
      SELECT p.id, p.numero, p.estado, COALESCE(p.fecha_prometida, p.fecha_entrega_est) AS fecha_entrega_est,
        p.monto_total, p.estado_logistica,
        (CURRENT_DATE - COALESCE(p.fecha_prometida, p.fecha_entrega_est))::int AS dias_atraso,
        json_build_object('id', prov.id, 'nombre', prov.nombre) AS proveedor,
        CASE WHEN o.id IS NOT NULL THEN
          json_build_object('id', o.id, 'numero', o.numero,
            'cliente', json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
              'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona))
        ELSE NULL END AS operacion
      FROM pedidos p
      JOIN proveedores prov ON prov.id = p.proveedor_id
      LEFT JOIN operaciones o ON o.id = p.operacion_id
      LEFT JOIN clientes cl ON cl.id = o.cliente_id
      WHERE p.estado_logistica NOT IN ('borrador','recibida','cerrada','cancelada')
        AND COALESCE(p.fecha_prometida, p.fecha_entrega_est) IS NOT NULL
        AND COALESCE(p.fecha_prometida, p.fecha_entrega_est) < CURRENT_DATE
      ORDER BY COALESCE(p.fecha_prometida, p.fecha_entrega_est) ASC
      LIMIT 20
    `),

    db.query(`
      SELECT o.id, o.motivo, o.fecha_recontacto, o.interes, o.probabilidad,
        (CURRENT_DATE - o.fecha_recontacto)::int AS dias_atraso,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente
      FROM oportunidades o
      JOIN clientes cl ON cl.id = o.cliente_id
      WHERE o.estado = 'pendiente'
        AND o.fecha_recontacto <= CURRENT_DATE
      ORDER BY o.fecha_recontacto ASC
      LIMIT 20
    `),

    db.query(`
      SELECT r.id, r.numero, r.hora_entrega_est, r.direccion_entrega,
        json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
          'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona,
          'telefono', cl.telefono) AS cliente
      FROM remitos r
      JOIN clientes cl ON cl.id = r.cliente_id
      WHERE r.fecha_entrega_est = CURRENT_DATE AND r.estado = 'emitido'
      ORDER BY r.hora_entrega_est ASC NULLS LAST
      LIMIT 10
    `),
  ]);

  const s = statsRow.rows[0];
  return c.json({
    stats: {
      presupuestos_activos: s.presupuestos_activos,
      ventas_mes:           s.ventas_mes,
      monto_mes:            parseFloat(s.monto_mes),
      ventas_hoy:           parseFloat(s.ventas_hoy),
      clientes_total:       s.clientes_total,
      prospectos:           s.prospectos,
      sin_contacto_30:      s.sin_contacto_30,
      tareas_vencidas:      s.tareas_vencidas,
    },
    sin_confirmar:         sinConfirmar.rows,
    sin_pago:              sinPago.rows,
    pagados_no_entregados: pagadosNoEntregados.rows,
    compromisos_semana:    compromisosSemana.rows,
    stock_bajo:            stockBajo.rows,
    top_productos:         topProductos.rows,
    sin_contacto:          sinContacto.rows,
    recientes:             recientes.rows,
    pedidos_atrasados:     pedidosAtrasados.rows,
    oportunidades_pendientes: oportunidadesPendientes.rows,
    entregas_hoy:          entregasHoy.rows,
  });
});

export default dashboard;
