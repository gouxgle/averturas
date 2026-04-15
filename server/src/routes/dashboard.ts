import { Hono } from 'hono';
import { db } from '../db.js';

const dashboard = new Hono();

dashboard.get('/stats', async (c) => {
  const primerDiaMes = new Date();
  primerDiaMes.setDate(1);
  primerDiaMes.setHours(0, 0, 0, 0);

  const [presupuestos, ventas, clientes] = await Promise.all([
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
  ]);

  return c.json({
    presupuestos_activos: parseInt(presupuestos.rows[0].total),
    ventas_mes:  parseInt(ventas.rows[0].count),
    monto_mes:   parseFloat(ventas.rows[0].monto),
    clientes_total: parseInt(clientes.rows[0].total),
  });
});

dashboard.get('/recientes', async (c) => {
  const { rows } = await db.query(`
    SELECT o.*,
      json_build_object('nombre', c.nombre, 'apellido', c.apellido) AS cliente
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
    ORDER BY o.created_at DESC LIMIT 5
  `);
  return c.json(rows);
});

dashboard.get('/pendientes', async (c) => {
  const { rows } = await db.query(`
    SELECT o.*,
      json_build_object('nombre', c.nombre, 'apellido', c.apellido) AS cliente
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado IN ('presupuesto','enviado')
    ORDER BY o.created_at ASC LIMIT 5
  `);
  return c.json(rows);
});

export default dashboard;
