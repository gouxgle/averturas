import { Hono } from 'hono';
import pkg from 'pg';
import { db } from '../db.js';

const recibos = new Hono();

async function nextNumero(): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS n FROM recibos WHERE numero LIKE $1`,
    [`REC-${ym}-%`]
  );
  const n = parseInt((rows[0] as { n: string }).n) + 1;
  return `REC-${ym}-${String(n).padStart(4, '0')}`;
}

// GET /tablero — panel de cobranza completo (ANTES de /:id)
recibos.get('/tablero', async (c) => {
  const mesStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    statsRec,
    statsComp,
    diasProm,
    recibosRows,
    compromisosRows,
    deudasRows,
    metodosPago,
    proximosVenc,
    infoClave,
    parciales,
  ] = await Promise.all([
    db.query(`
      SELECT
        COALESCE(SUM(monto_total) FILTER (WHERE estado = 'emitido' AND fecha >= $1::date), 0)::numeric AS cobrado_mes,
        COUNT(*) FILTER (WHERE estado = 'emitido' AND fecha >= $1::date)::int AS count_mes,
        COUNT(*) FILTER (WHERE fecha >= $1::date)::int AS total_comprobantes_mes,
        COUNT(*) FILTER (WHERE estado = 'anulado' AND fecha >= $1::date)::int AS anulados_mes
      FROM recibos
    `, [mesStr]),

    db.query(`
      SELECT
        COALESCE(SUM(monto) FILTER (WHERE fecha_vencimiento < CURRENT_DATE), 0)::numeric AS vencido,
        COALESCE(SUM(monto), 0)::numeric AS total_pendiente,
        COUNT(*) FILTER (WHERE fecha_vencimiento < CURRENT_DATE)::int AS count_vencido,
        COUNT(*)::int AS count_pendiente
      FROM compromisos_pago WHERE estado = 'pendiente'
    `, []),

    db.query(`
      SELECT COALESCE(ROUND(AVG(EXTRACT(DAY FROM (r.fecha::date - o.created_at::date))))::int, 0) AS dias_promedio
      FROM recibos r
      JOIN operaciones o ON o.id = r.operacion_id
      WHERE r.estado = 'emitido' AND r.fecha >= NOW() - INTERVAL '3 months'
    `, []),

    db.query(`
      SELECT
        r.id, r.numero, r.fecha, r.monto_total, r.forma_pago, r.referencia_pago,
        r.estado, r.operacion_id, cl.telefono AS cliente_telefono,
        CASE
          WHEN cl.tipo_persona = 'juridica' THEN COALESCE(cl.razon_social, '—')
          WHEN cl.apellido IS NOT NULL AND cl.nombre IS NOT NULL THEN cl.apellido || ', ' || cl.nombre
          WHEN cl.apellido IS NOT NULL THEN cl.apellido
          WHEN cl.nombre IS NOT NULL THEN cl.nombre
          ELSE '—'
        END AS cliente_nombre,
        op.numero AS operacion_numero, op.precio_total,
        cobros.total_cobrado,
        CASE
          WHEN r.estado = 'anulado' THEN 'anulado'
          WHEN op.id IS NOT NULL AND COALESCE(cobros.total_cobrado, 0) < COALESCE(op.precio_total, 0) - 0.01 THEN 'parcial'
          ELSE 'cobrado'
        END AS estado_cobro,
        GREATEST(0, COALESCE(op.precio_total, 0) - COALESCE(cobros.total_cobrado, 0)) AS saldo_pendiente
      FROM recibos r
      JOIN clientes cl ON cl.id = r.cliente_id
      LEFT JOIN operaciones op ON op.id = r.operacion_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(r2.monto_total), 0) AS total_cobrado
        FROM recibos r2 WHERE r2.operacion_id = op.id AND r2.estado = 'emitido'
      ) cobros ON true
      ORDER BY r.fecha DESC, r.created_at DESC
      LIMIT 300
    `, []),

    db.query(`
      SELECT
        cp.id, cp.monto AS monto_total, cp.fecha_vencimiento, cp.descripcion,
        cp.operacion_id, cp.created_at AS fecha, cl.telefono AS cliente_telefono,
        CASE
          WHEN cl.tipo_persona = 'juridica' THEN COALESCE(cl.razon_social, '—')
          WHEN cl.apellido IS NOT NULL AND cl.nombre IS NOT NULL THEN cl.apellido || ', ' || cl.nombre
          WHEN cl.apellido IS NOT NULL THEN cl.apellido
          WHEN cl.nombre IS NOT NULL THEN cl.nombre
          ELSE '—'
        END AS cliente_nombre,
        op.numero AS operacion_numero,
        CASE WHEN cp.fecha_vencimiento < CURRENT_DATE THEN 'vencido' ELSE 'pendiente' END AS estado_cobro
      FROM compromisos_pago cp
      JOIN clientes cl ON cl.id = cp.cliente_id
      LEFT JOIN operaciones op ON op.id = cp.operacion_id
      WHERE cp.estado = 'pendiente'
      ORDER BY cp.fecha_vencimiento ASC
    `, []),

    db.query(`
      SELECT
        cl.id,
        CASE
          WHEN cl.tipo_persona = 'juridica' THEN COALESCE(cl.razon_social, '—')
          WHEN cl.apellido IS NOT NULL AND cl.nombre IS NOT NULL THEN cl.apellido || ', ' || cl.nombre
          WHEN cl.apellido IS NOT NULL THEN cl.apellido
          WHEN cl.nombre IS NOT NULL THEN cl.nombre
          ELSE '—'
        END AS cliente_nombre,
        SUM(cp.monto)::numeric AS saldo_pendiente,
        COUNT(*) FILTER (WHERE cp.fecha_vencimiento < CURRENT_DATE)::int AS count_vencido
      FROM compromisos_pago cp
      JOIN clientes cl ON cl.id = cp.cliente_id
      WHERE cp.estado = 'pendiente'
      GROUP BY cl.id, cl.nombre, cl.apellido, cl.razon_social, cl.tipo_persona
      ORDER BY saldo_pendiente DESC
      LIMIT 8
    `, []),

    db.query(`
      SELECT
        CASE
          WHEN LOWER(forma_pago) LIKE '%transfer%' THEN 'Transferencia'
          WHEN LOWER(forma_pago) LIKE '%contado%' OR LOWER(forma_pago) LIKE '%efectivo%' THEN 'Efectivo'
          WHEN LOWER(forma_pago) LIKE '%tarjeta%' OR LOWER(forma_pago) LIKE '%cuota%'
            OR LOWER(forma_pago) LIKE '%débito%' OR LOWER(forma_pago) LIKE '%crédito%'
            OR LOWER(forma_pago) LIKE '%mercado%' THEN 'Tarjeta / Digital'
          ELSE 'Otros'
        END AS grupo,
        COUNT(*)::int AS count,
        SUM(monto_total)::numeric AS total
      FROM recibos
      WHERE estado = 'emitido' AND fecha >= $1::date
      GROUP BY grupo
      ORDER BY total DESC
    `, [mesStr]),

    db.query(`
      SELECT
        CASE
          WHEN cl.tipo_persona = 'juridica' THEN COALESCE(cl.razon_social, '—')
          WHEN cl.apellido IS NOT NULL AND cl.nombre IS NOT NULL THEN cl.apellido || ', ' || cl.nombre
          ELSE COALESCE(cl.apellido, cl.nombre, '—')
        END AS cliente_nombre,
        op.numero AS operacion_numero,
        cp.monto, cp.fecha_vencimiento,
        EXTRACT(DAY FROM cp.fecha_vencimiento::date - CURRENT_DATE)::int AS dias_para_vencer
      FROM compromisos_pago cp
      JOIN clientes cl ON cl.id = cp.cliente_id
      LEFT JOIN operaciones op ON op.id = cp.operacion_id
      WHERE cp.estado = 'pendiente' AND cp.fecha_vencimiento >= CURRENT_DATE
      ORDER BY cp.fecha_vencimiento ASC
      LIMIT 6
    `, []),

    db.query(`
      SELECT
        COUNT(*)::int AS total_comprobantes,
        COUNT(*) FILTER (WHERE estado = 'emitido')::int AS recibos_emitidos,
        COUNT(*) FILTER (WHERE estado = 'anulado')::int AS anulados
      FROM recibos
      WHERE fecha >= $1::date
    `, [mesStr]),

    db.query(`
      SELECT COUNT(DISTINCT op.id)::int AS count
      FROM operaciones op
      WHERE op.estado NOT IN ('cancelado', 'presupuesto', 'enviado')
        AND EXISTS (SELECT 1 FROM recibos r WHERE r.operacion_id = op.id AND r.estado = 'emitido')
        AND (
          SELECT COALESCE(SUM(r.monto_total), 0) FROM recibos r
          WHERE r.operacion_id = op.id AND r.estado = 'emitido'
        ) < op.precio_total - 0.01
    `, []),
  ]);

  const sr = statsRec.rows[0] as Record<string, string>;
  const sc = statsComp.rows[0] as Record<string, string>;
  const cobradoMes  = Number(sr.cobrado_mes);
  const totalPend   = Number(sc.total_pendiente);
  const totalACobrar = cobradoMes + totalPend;
  const pctCobro    = totalACobrar > 0 ? Math.round(cobradoMes / totalACobrar * 100) : 0;
  const diasProm0   = Number((diasProm.rows[0] as Record<string, number>)?.dias_promedio ?? 0);

  const totalPago = (metodosPago.rows as Record<string, string>[]).reduce((s, r) => s + Number(r.total), 0);

  return c.json({
    stats: {
      cobrado_mes:    cobradoMes,
      count_mes:      Number(sr.count_mes),
      pendiente_cobro: Number(sc.total_pendiente),
      vencido:        Number(sc.vencido),
      dias_promedio:  diasProm0,
      pct_cobro:      pctCobro,
      total_a_cobrar: totalACobrar,
    },
    recibos: (recibosRows.rows as Record<string, unknown>[]).map(r => ({
      tipo: 'recibo',
      id:              r.id,
      numero:          r.numero,
      fecha:           r.fecha,
      monto_total:     Number(r.monto_total),
      forma_pago:      r.forma_pago,
      referencia_pago: r.referencia_pago,
      estado:          r.estado,
      estado_cobro:    r.estado_cobro,
      saldo_pendiente: Number(r.saldo_pendiente),
      operacion_id:    r.operacion_id,
      operacion_numero: r.operacion_numero,
      cliente_nombre:  r.cliente_nombre,
      cliente_telefono: r.cliente_telefono,
    })),
    compromisos: (compromisosRows.rows as Record<string, unknown>[]).map(r => ({
      tipo: 'compromiso',
      id:              r.id,
      numero:          `COMP-${String(r.id).slice(0, 8).toUpperCase()}`,
      fecha:           r.fecha,
      fecha_vencimiento: r.fecha_vencimiento,
      monto_total:     Number(r.monto_total),
      estado_cobro:    r.estado_cobro,
      descripcion:     r.descripcion,
      operacion_id:    r.operacion_id,
      operacion_numero: r.operacion_numero,
      cliente_nombre:  r.cliente_nombre,
      cliente_telefono: r.cliente_telefono,
    })),
    deudas_cliente: (deudasRows.rows as Record<string, unknown>[]).map(r => ({
      cliente_id:      r.id,
      cliente_nombre:  r.cliente_nombre,
      saldo_pendiente: Number(r.saldo_pendiente),
      tiene_vencido:   Number(r.count_vencido) > 0,
    })),
    metodos_pago: (metodosPago.rows as Record<string, unknown>[]).map(r => ({
      grupo: r.grupo,
      count: Number(r.count),
      total: Number(r.total),
      pct:   totalPago > 0 ? Math.round(Number(r.total) / totalPago * 100) : 0,
    })),
    proximos_vencimientos: (proximosVenc.rows as Record<string, unknown>[]).map(r => ({
      cliente_nombre:    r.cliente_nombre,
      operacion_numero:  r.operacion_numero,
      monto:             Number(r.monto),
      fecha_vencimiento: r.fecha_vencimiento,
      dias_para_vencer:  Number(r.dias_para_vencer),
    })),
    info_clave: {
      total_comprobantes: Number((infoClave.rows[0] as Record<string, unknown>)?.total_comprobantes ?? 0),
      recibos_emitidos:   Number((infoClave.rows[0] as Record<string, unknown>)?.recibos_emitidos ?? 0),
      pagos_parciales:    Number((parciales.rows[0] as Record<string, unknown>)?.count ?? 0),
      anulados:           Number((infoClave.rows[0] as Record<string, unknown>)?.anulados ?? 0),
    },
  });
});

// GET /conteos — stats del mes (ANTES de /:id)
recibos.get('/conteos', async (c) => {
  const { rows: [r] } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'emitido')::int   AS emitidos,
      COUNT(*) FILTER (WHERE estado = 'anulado')::int   AS anulados,
      COALESCE(SUM(monto_total) FILTER (WHERE estado = 'emitido' AND fecha >= date_trunc('month', CURRENT_DATE)), 0)::numeric AS monto_mes,
      COUNT(*) FILTER (WHERE estado = 'emitido' AND fecha >= date_trunc('month', CURRENT_DATE))::int AS count_mes
    FROM recibos
  `);
  return c.json(r);
});

// GET / — lista con filtros
recibos.get('/', async (c) => {
  const search       = c.req.query('search')       ?? '';
  const estado       = c.req.query('estado')       ?? '';
  const operacion_id = c.req.query('operacion_id') ?? '';
  const cliente_id   = c.req.query('cliente_id')   ?? '';
  const params: unknown[] = [];
  const where: string[] = [];

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where.push(`(r.numero ILIKE $${params.length} OR cl.nombre ILIKE $${params.length} OR cl.apellido ILIKE $${params.length} OR cl.razon_social ILIKE $${params.length})`);
  }
  if (estado) { params.push(estado); where.push(`r.estado = $${params.length}`); }
  if (operacion_id) { params.push(operacion_id); where.push(`r.operacion_id = $${params.length}`); }
  if (cliente_id)   { params.push(cliente_id);   where.push(`r.cliente_id = $${params.length}`);   }

  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await db.query(`
    SELECT r.*,
      json_build_object('id', cl.id, 'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona) AS cliente,
      json_build_object('id', op.id, 'numero', op.numero, 'precio_total', op.precio_total) AS operacion,
      json_build_object('id', rm.id, 'numero', rm.numero) AS remito
    FROM recibos r
    JOIN  clientes   cl ON cl.id = r.cliente_id
    LEFT JOIN operaciones op ON op.id = r.operacion_id
    LEFT JOIN remitos      rm ON rm.id = r.remito_id
    ${w}
    ORDER BY r.fecha DESC, r.created_at DESC
    LIMIT 300
  `, params);

  return c.json(rows);
});

// GET /:id — detalle con items
recibos.get('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [r] } = await db.query(`
    SELECT r.*,
      json_build_object('id', cl.id, 'nombre', cl.nombre, 'apellido', cl.apellido,
        'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona,
        'telefono', cl.telefono, 'email', cl.email,
        'direccion', cl.direccion, 'localidad', cl.localidad,
        'documento_nro', cl.documento_nro) AS cliente,
      json_build_object('id', op.id, 'numero', op.numero, 'precio_total', op.precio_total, 'estado', op.estado) AS operacion,
      json_build_object('id', rm.id, 'numero', rm.numero, 'estado', rm.estado) AS remito,
      u.nombre AS created_by_nombre
    FROM recibos r
    JOIN  clientes   cl ON cl.id = r.cliente_id
    LEFT JOIN operaciones op ON op.id = r.operacion_id
    LEFT JOIN remitos      rm ON rm.id = r.remito_id
    LEFT JOIN usuarios     u  ON u.id  = r.created_by
    WHERE r.id = $1
  `, [id]);

  if (!r) return c.json({ error: 'No encontrado' }, 404);

  const { rows: items } = await db.query(`
    SELECT ri.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo
    FROM recibo_items ri
    LEFT JOIN catalogo_productos p ON p.id = ri.producto_id
    WHERE ri.recibo_id = $1
    ORDER BY ri.orden, ri.id
  `, [id]);

  // Compromiso pendiente más próximo para esta operación (si existe)
  let compromiso = null;
  if (r.operacion_id) {
    const { rows: comps } = await db.query(`
      SELECT monto, fecha_vencimiento, tipo, descripcion
      FROM compromisos_pago
      WHERE operacion_id = $1 AND estado = 'pendiente'
      ORDER BY fecha_vencimiento ASC
      LIMIT 1
    `, [r.operacion_id]);
    if (comps.length) compromiso = comps[0];
  }

  // Total ya cobrado para la operación (para calcular saldo real)
  let cobrado_operacion = 0;
  if (r.operacion_id) {
    const { rows: [tot] } = await db.query(`
      SELECT COALESCE(SUM(monto_total), 0) AS total
      FROM recibos
      WHERE operacion_id = $1 AND estado = 'emitido'
    `, [r.operacion_id]);
    cobrado_operacion = Number(tot?.total ?? 0);
  }

  return c.json({ ...r, items, compromiso, cobrado_operacion });
});

// POST / — crear recibo
recibos.post('/', async (c) => {
  const user = c.get('user');
  const b    = await c.req.json();

  if (!b.cliente_id)                      return c.json({ error: 'cliente_id requerido' }, 400);
  if (!b.monto_total || parseFloat(b.monto_total) <= 0) return c.json({ error: 'monto_total debe ser > 0' }, 400);
  if (!b.forma_pago)                      return c.json({ error: 'forma_pago requerida' }, 400);

  const numero = await nextNumero();
  const items: { descripcion: string; producto_id?: string; cantidad?: number; monto: number }[] = b.items ?? [];

  const client: pkg.PoolClient = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [rec] } = await client.query(`
      INSERT INTO recibos
        (numero, fecha, cliente_id, operacion_id, remito_id, monto_total,
         forma_pago, referencia_pago, concepto, notas, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      numero,
      b.fecha           || new Date().toISOString().split('T')[0],
      b.cliente_id,
      b.operacion_id    || null,
      b.remito_id       || null,
      parseFloat(b.monto_total),
      b.forma_pago,
      b.referencia_pago || null,
      b.concepto        || null,
      b.notas           || null,
      user?.id          || null,
    ]);

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(`
        INSERT INTO recibo_items (recibo_id, descripcion, producto_id, cantidad, monto, orden)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [rec.id, it.descripcion, it.producto_id || null, it.cantidad ?? 1, parseFloat(String(it.monto)), i]);
    }

    // Compromiso de saldo (pago parcial)
    const comp = b.compromiso;
    if (comp && parseFloat(String(comp.monto)) > 0 && comp.fecha_vencimiento) {
      await client.query(`
        INSERT INTO compromisos_pago
          (cliente_id, operacion_id, tipo, monto, fecha_vencimiento, descripcion, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        b.cliente_id,
        b.operacion_id || null,
        comp.tipo || 'cuota',
        parseFloat(String(comp.monto)),
        comp.fecha_vencimiento,
        comp.descripcion || null,
        user?.id || null,
      ]);
    }

    await client.query('COMMIT');
    return c.json(rec, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PUT /:id — editar (solo emitidos)
recibos.put('/:id', async (c) => {
  const { id } = c.req.param();
  const b      = await c.req.json();

  const { rows: [existing] } = await db.query('SELECT estado FROM recibos WHERE id=$1', [id]);
  if (!existing)                      return c.json({ error: 'No encontrado' }, 404);
  if (existing.estado === 'anulado')  return c.json({ error: 'No se puede editar un recibo anulado' }, 400);

  const client: pkg.PoolClient = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [rec] } = await client.query(`
      UPDATE recibos SET
        fecha = $1, operacion_id = $2, remito_id = $3,
        monto_total = $4, forma_pago = $5, referencia_pago = $6,
        concepto = $7, notas = $8, updated_at = now()
      WHERE id = $9 RETURNING *
    `, [
      b.fecha,
      b.operacion_id    || null,
      b.remito_id       || null,
      parseFloat(b.monto_total),
      b.forma_pago,
      b.referencia_pago || null,
      b.concepto        || null,
      b.notas           || null,
      id,
    ]);

    await client.query('DELETE FROM recibo_items WHERE recibo_id=$1', [id]);
    const items: { descripcion: string; producto_id?: string; cantidad?: number; monto: number }[] = b.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(`
        INSERT INTO recibo_items (recibo_id, descripcion, producto_id, cantidad, monto, orden)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [id, it.descripcion, it.producto_id || null, it.cantidad ?? 1, parseFloat(String(it.monto)), i]);
    }

    await client.query('COMMIT');
    return c.json(rec);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id/anular
recibos.patch('/:id/anular', async (c) => {
  const { id } = c.req.param();
  const { rows: [rec] } = await db.query(
    `UPDATE recibos SET estado='anulado', updated_at=now() WHERE id=$1 AND estado='emitido' RETURNING *`,
    [id]
  );
  if (!rec) return c.json({ error: 'Recibo no encontrado o ya anulado' }, 400);
  return c.json(rec);
});

export default recibos;
