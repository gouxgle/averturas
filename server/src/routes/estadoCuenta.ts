import { Hono } from 'hono';
import { db } from '../db.js';

const estadoCuenta = new Hono();

// GET / — dashboard global: todos los clientes con actividad económica
estadoCuenta.get('/', async (c) => {
  const sort  = c.req.query('sort')   ?? 'saldo_desc';   // saldo_desc|saldo_asc|nombre|actividad
  const filtro = c.req.query('filtro') ?? 'todos';        // todos|con_saldo|con_compromisos|saldados
  const search = c.req.query('search') ?? '';

  let orderBy: string;
  switch (sort) {
    case 'saldo_asc':    orderBy = 'saldo ASC NULLS LAST'; break;
    case 'nombre':       orderBy = 'apellido ASC, nombre ASC'; break;
    case 'actividad':    orderBy = 'ultima_actividad DESC NULLS LAST'; break;
    case 'vencimiento':  orderBy = 'proximo_vencimiento ASC NULLS LAST'; break;
    default:             orderBy = 'saldo DESC NULLS LAST';
  }

  const params: unknown[] = [];

  let filtroExtra = '';
  if (filtro === 'con_saldo')       filtroExtra = 'AND (ops.total - COALESCE(rec.total,0)) > 0';
  if (filtro === 'con_compromisos') filtroExtra = 'AND comp.total > 0';
  if (filtro === 'saldados')        filtroExtra = 'AND (ops.total - COALESCE(rec.total,0)) <= 0';

  let whereSearch = '';
  if (search.trim()) {
    params.push(`%${search}%`);
    whereSearch = `AND (c.nombre ILIKE $${params.length} OR c.apellido ILIKE $${params.length} OR c.razon_social ILIKE $${params.length} OR c.telefono ILIKE $${params.length})`;
  }

  const { rows } = await db.query(`
    SELECT
      c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
      c.telefono, c.email,
      ops.count                                          AS operaciones_count,
      ops.total                                          AS total_presupuestado,
      COALESCE(rec.total, 0)                             AS total_cobrado,
      ops.total - COALESCE(rec.total, 0)                 AS saldo,
      COALESCE(pend.count, 0)                            AS pendientes_count,
      COALESCE(pend.total, 0)                            AS pendientes_monto,
      COALESCE(comp.total, 0)                            AS compromisos_pendientes,
      comp.proximo_vencimiento,
      comp.compromisos_vencidos,
      GREATEST(ops.ultima, COALESCE(rec.ultima, ops.ultima)) AS ultima_actividad,
      EXTRACT(DAY FROM now() - ops.primera)::int              AS dias_desde_primera_op
    FROM clientes c
    JOIN LATERAL (
      -- Solo operaciones aprobadas (y estados posteriores) generan saldo
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(precio_total), 0) AS total,
             MAX(created_at) AS ultima,
             MIN(created_at) AS primera
      FROM operaciones
      WHERE cliente_id = c.id
        AND estado IN ('aprobado','en_produccion','listo','instalado','entregado')
    ) ops ON ops.count > 0
    LEFT JOIN LATERAL (
      -- Pendientes de aprobación (solo para mostrar como referencia)
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(precio_total), 0) AS total
      FROM operaciones
      WHERE cliente_id = c.id
        AND estado IN ('presupuesto','enviado','rechazado')
    ) pend ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(monto_total), 0) AS total,
             MAX(created_at) AS ultima
      FROM recibos
      WHERE cliente_id = c.id AND estado != 'anulado'
    ) rec ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'), 0) AS total,
             MIN(fecha_vencimiento) FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento >= CURRENT_DATE) AS proximo_vencimiento,
             COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE) AS compromisos_vencidos
      FROM compromisos_pago
      WHERE cliente_id = c.id
    ) comp ON true
    WHERE c.activo = true ${whereSearch} ${filtroExtra}
    ORDER BY ${orderBy}
    LIMIT 500
  `, params);

  // Totales globales
  const totales = rows.reduce((acc: any, r: any) => {
    acc.presupuestado  += Number(r.total_presupuestado);
    acc.cobrado        += Number(r.total_cobrado);
    acc.saldo          += Number(r.saldo);
    acc.compromisos    += Number(r.compromisos_pendientes);
    if (Number(r.saldo) > 0)              acc.clientes_con_saldo++;
    if (Number(r.compromisos_vencidos) > 0) acc.compromisos_vencidos++;
    return acc;
  }, { presupuestado: 0, cobrado: 0, saldo: 0, compromisos: 0, clientes_con_saldo: 0, compromisos_vencidos: 0 });

  return c.json({ clientes: rows, totales });
});

// GET /:clienteId/compromisos — lista de compromisos de un cliente
estadoCuenta.get('/:clienteId/compromisos', async (c) => {
  const { clienteId } = c.req.param();
  const { rows } = await db.query(`
    SELECT cp.*,
      CASE WHEN o.id IS NOT NULL
        THEN json_build_object('id', o.id, 'numero', o.numero)
        ELSE NULL END AS operacion
    FROM compromisos_pago cp
    LEFT JOIN operaciones o ON o.id = cp.operacion_id
    WHERE cp.cliente_id = $1
    ORDER BY cp.fecha_vencimiento ASC, cp.created_at ASC
  `, [clienteId]);
  return c.json(rows);
});

// POST /:clienteId/compromisos — crear compromiso
estadoCuenta.post('/:clienteId/compromisos', async (c) => {
  const { clienteId } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    INSERT INTO compromisos_pago
      (cliente_id, operacion_id, tipo, monto, fecha_vencimiento,
       descripcion, numero_cheque, banco, notas, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `, [
    clienteId,
    body.operacion_id || null,
    body.tipo || 'cuota',
    Number(body.monto),
    body.fecha_vencimiento,
    body.descripcion?.trim() || null,
    body.numero_cheque?.trim() || null,
    body.banco?.trim() || null,
    body.notas?.trim() || null,
    user.id,
  ]);
  return c.json(row, 201);
});

// PATCH /compromisos/:id — cambiar estado (pendiente → cobrado/rechazado)
estadoCuenta.patch('/compromisos/:id', async (c) => {
  const { id } = c.req.param();
  const { estado } = await c.req.json();
  if (!['pendiente','cobrado','rechazado','vencido'].includes(estado)) {
    return c.json({ error: 'Estado inválido' }, 400);
  }
  const { rows: [row] } = await db.query(
    `UPDATE compromisos_pago SET estado = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [estado, id]
  );
  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json(row);
});

// DELETE /compromisos/:id
estadoCuenta.delete('/compromisos/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [row] } = await db.query(
    `DELETE FROM compromisos_pago WHERE id = $1 RETURNING id`, [id]
  );
  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json({ ok: true });
});

export default estadoCuenta;
