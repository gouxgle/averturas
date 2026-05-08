import { Hono } from 'hono';
import { db } from '../db.js';

const estadoCuenta = new Hono();

// GET / — tablero global de cobranzas
estadoCuenta.get('/', async (c) => {
  const sort   = c.req.query('sort')   ?? 'saldo_desc';
  const filtro = c.req.query('filtro') ?? 'todos';
  const search = c.req.query('search') ?? '';

  let orderBy: string;
  switch (sort) {
    case 'saldo_asc':    orderBy = 'saldo ASC NULLS LAST'; break;
    case 'nombre':       orderBy = 'apellido ASC, nombre ASC'; break;
    case 'actividad':    orderBy = 'ultima_actividad DESC NULLS LAST'; break;
    case 'vencimiento':  orderBy = 'comp.proximo_vencimiento ASC NULLS LAST'; break;
    case 'dias_vencido': orderBy = 'comp.dias_vencido_oldest DESC NULLS LAST'; break;
    default:             orderBy = 'saldo DESC NULLS LAST';
  }

  const params: unknown[] = [];
  let filtroExtra = '';
  if (filtro === 'con_saldo')       filtroExtra = 'AND (ops.total - COALESCE(rec.total,0)) > 0.01';
  if (filtro === 'con_compromisos') filtroExtra = 'AND comp.total > 0';
  if (filtro === 'saldados')        filtroExtra = 'AND (ops.total - COALESCE(rec.total,0)) <= 0.01';
  if (filtro === 'vencidos')        filtroExtra = 'AND COALESCE(comp.compromisos_vencidos,0) > 0';

  let whereSearch = '';
  if (search.trim()) {
    params.push(`%${search}%`);
    whereSearch = `AND (c.nombre ILIKE $${params.length} OR c.apellido ILIKE $${params.length} OR c.razon_social ILIKE $${params.length} OR c.telefono ILIKE $${params.length})`;
  }

  const [mainResult, promedioResult, tendenciaResult] = await Promise.all([
    db.query(`
      SELECT
        c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
        c.telefono, c.email,
        ops.count                                            AS operaciones_count,
        ops.total                                            AS total_presupuestado,
        COALESCE(rec.total, 0)                               AS total_cobrado,
        ops.total - COALESCE(rec.total, 0)                   AS saldo,
        COALESCE(pend.count, 0)                              AS pendientes_count,
        COALESCE(pend.total, 0)                              AS pendientes_monto,
        COALESCE(comp.total, 0)                              AS compromisos_pendientes,
        comp.proximo_vencimiento,
        comp.compromisos_vencidos,
        comp.dias_vencido_oldest,
        GREATEST(ops.ultima, COALESCE(rec.ultima, ops.ultima)) AS ultima_actividad,
        ops.ultima                                           AS ultima_compra_fecha,
        EXTRACT(DAY FROM now() - ops.primera)::int           AS dias_desde_primera_op,
        EXTRACT(DAY FROM now() - ops.ultima)::int            AS dias_desde_ultima_compra,
        COALESCE(ROUND(100.0 * COALESCE(rec.total,0) / NULLIF(ops.total,0), 0), 0)::int AS pct_cobrado,
        CASE
          WHEN (ops.total - COALESCE(rec.total, 0)) <= 0.01 THEN 'saldado'
          WHEN COALESCE(comp.compromisos_vencidos, 0) > 0   THEN 'vencido'
          WHEN comp.proximo_vencimiento IS NOT NULL
            AND comp.proximo_vencimiento <= CURRENT_DATE + 7 THEN 'por_vencer'
          ELSE 'al_dia'
        END AS estado_cobro
      FROM clientes c
      JOIN LATERAL (
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM(precio_total), 0) AS total,
               MAX(created_at) AS ultima,
               MIN(created_at) AS primera
        FROM operaciones
        WHERE cliente_id = c.id
          AND estado IN ('aprobado','en_produccion','listo','instalado','entregado')
      ) ops ON ops.count > 0
      LEFT JOIN LATERAL (
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
        SELECT
          COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'), 0) AS total,
          MIN(fecha_vencimiento) FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento >= CURRENT_DATE) AS proximo_vencimiento,
          COUNT(*) FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE)::int AS compromisos_vencidos,
          COALESCE(EXTRACT(DAY FROM now() - MIN(fecha_vencimiento)
            FILTER (WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE)), 0)::int AS dias_vencido_oldest
        FROM compromisos_pago
        WHERE cliente_id = c.id
      ) comp ON true
      WHERE c.activo = true ${whereSearch} ${filtroExtra}
      ORDER BY ${orderBy}
      LIMIT 500
    `, params),

    db.query(`
      SELECT COALESCE(ROUND(AVG(EXTRACT(DAY FROM now() - fecha_vencimiento)))::int, 0) AS dias_promedio
      FROM compromisos_pago
      WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE
    `),

    db.query(`
      SELECT
        COALESCE(SUM(monto_total) FILTER (WHERE created_at >= now() - INTERVAL '30 days'), 0)::numeric AS mes_actual,
        COALESCE(SUM(monto_total) FILTER (WHERE created_at >= now() - INTERVAL '60 days' AND created_at < now() - INTERVAL '30 days'), 0)::numeric AS mes_anterior
      FROM recibos WHERE estado != 'anulado'
    `),
  ]);

  const rows = mainResult.rows;
  const diasPromedio = Number(promedioResult.rows[0]?.dias_promedio ?? 0);
  const mesActual    = Number(tendenciaResult.rows[0]?.mes_actual ?? 0);
  const mesAnterior  = Number(tendenciaResult.rows[0]?.mes_anterior ?? 0);
  const tendencia30d = mesAnterior > 0 ? Math.round((mesActual - mesAnterior) / mesAnterior * 100) : 0;

  const totales = rows.reduce((acc: any, r: any) => {
    const saldo = Number(r.saldo);
    acc.presupuestado  += Number(r.total_presupuestado);
    acc.cobrado        += Number(r.total_cobrado);
    acc.saldo          += saldo;
    acc.compromisos    += Number(r.compromisos_pendientes);
    acc.total_clientes++;
    if (saldo > 0.01) acc.clientes_con_saldo++;
    if (Number(r.compromisos_vencidos) > 0) acc.compromisos_vencidos_count++;
    if (r.estado_cobro === 'vencido')    acc.vencidos_monto    += saldo;
    if (r.estado_cobro === 'por_vencer') acc.por_vencer_monto  += Number(r.compromisos_pendientes);
    if (r.estado_cobro === 'al_dia')     acc.al_dia_monto      += saldo;
    return acc;
  }, {
    presupuestado: 0, cobrado: 0, saldo: 0, compromisos: 0,
    clientes_con_saldo: 0, compromisos_vencidos_count: 0, total_clientes: 0,
    vencidos_monto: 0, por_vencer_monto: 0, al_dia_monto: 0,
  });

  totales.pct_cobrado         = totales.presupuestado > 0 ? Math.round(totales.cobrado / totales.presupuestado * 100) : 0;
  totales.dias_promedio_atraso = diasPromedio;
  totales.tendencia_30d       = tendencia30d;

  // Top 3 cobros prioritarios del día
  const cobros_prioritarios = [...rows]
    .filter((r: any) => ['vencido','por_vencer'].includes(r.estado_cobro) && Number(r.saldo) > 0)
    .sort((a: any, b: any) => {
      if (a.estado_cobro !== b.estado_cobro) return a.estado_cobro === 'vencido' ? -1 : 1;
      if (a.estado_cobro === 'vencido') return Number(b.dias_vencido_oldest) - Number(a.dias_vencido_oldest);
      if (a.proximo_vencimiento && b.proximo_vencimiento)
        return new Date(a.proximo_vencimiento).getTime() - new Date(b.proximo_vencimiento).getTime();
      return Number(b.saldo) - Number(a.saldo);
    })
    .slice(0, 3);

  return c.json({ clientes: rows, totales, cobros_prioritarios });
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
