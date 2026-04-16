import { Hono } from 'hono';
import { db } from '../db.js';

const dashboard = new Hono();

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
