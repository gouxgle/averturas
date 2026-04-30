import { Hono } from 'hono';
import pkg from 'pg';
import { db } from '../db.js';

type QueryRunner = { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }> };

const stock = new Hono();

async function nextLoteNumero(client: QueryRunner = db, productoId?: string): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');

  let tipoAbrev = 'GEN';
  if (productoId) {
    const { rows: [p] } = await client.query(
      `SELECT ta.nombre FROM catalogo_productos cp
       LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
       WHERE cp.id = $1`, [productoId]
    );
    const pRow = p as { nombre?: string } | undefined;
    if (pRow?.nombre) {
      tipoAbrev = (pRow.nombre as string)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar tildes
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'GEN';
    }
  }

  const { rows } = await client.query(
    `SELECT COUNT(*) AS n FROM stock_lotes WHERE numero LIKE $1`,
    [`LOT-${ym}-${tipoAbrev}-%`]
  );
  const n = parseInt((rows[0] as { n: string }).n) + 1;
  return `LOT-${ym}-${tipoAbrev}-${String(n).padStart(4, '0')}`;
}

// GET / — productos estándar con stock actual
stock.get('/', async (c) => {
  const search = c.req.query('search') ?? '';
  const filtro = c.req.query('filtro') ?? 'todos';
  const params: unknown[] = [];

  let searchClause = '';
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    searchClause = `AND (p.nombre ILIKE $${params.length} OR COALESCE(p.codigo,'') ILIKE $${params.length})`;
  }

  let having = '';
  if (filtro === 'sin_stock')   having = 'HAVING (COALESCE(p.stock_inicial,0) + COALESCE(SUM(m.cantidad),0)) <= 0';
  if (filtro === 'bajo_minimo') having = 'HAVING (COALESCE(p.stock_inicial,0) + COALESCE(SUM(m.cantidad),0)) > 0 AND (COALESCE(p.stock_inicial,0) + COALESCE(SUM(m.cantidad),0)) <= p.stock_minimo';

  const { rows } = await db.query(`
    SELECT
      p.id, p.nombre, p.codigo, p.tipo, p.stock_minimo, p.stock_inicial,
      p.precio_base, p.costo_base, p.color, p.imagen_url,
      json_build_object('id', ta.id, 'nombre', ta.nombre) AS tipo_abertura,
      json_build_object('id', s.id,  'nombre', s.nombre)  AS sistema,
      (COALESCE(p.stock_inicial, 0) + COALESCE(SUM(m.cantidad), 0))::int AS stock_actual,
      COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'ingreso'), 0)::int       AS total_ingresado,
      COALESCE(SUM(-m.cantidad) FILTER (WHERE m.tipo LIKE 'egreso%'), 0)::int   AS total_egresado
    FROM catalogo_productos p
    LEFT JOIN tipos_abertura ta     ON ta.id = p.tipo_abertura_id
    LEFT JOIN sistemas s            ON s.id  = p.sistema_id
    LEFT JOIN stock_movimientos m   ON m.producto_id = p.id
    WHERE p.activo = true
    ${searchClause}
    GROUP BY p.id, p.nombre, p.codigo, p.stock_minimo, p.stock_inicial,
             p.precio_base, p.costo_base, p.color, p.imagen_url,
             ta.id, ta.nombre, s.id, s.nombre
    ${having}
    ORDER BY stock_actual ASC, p.nombre
  `, params);

  return c.json(rows);
});

// GET /alertas — resumen para dashboard/header
stock.get('/alertas', async (c) => {
  const { rows: [r] } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE stock_actual <= 0)::int                                       AS sin_stock,
      COUNT(*) FILTER (WHERE stock_actual > 0 AND stock_actual <= stock_minimo)::int       AS bajo_minimo,
      COUNT(*)::int                                                                        AS total
    FROM (
      SELECT p.id, p.stock_minimo,
             (COALESCE(p.stock_inicial, 0) + COALESCE(SUM(m.cantidad), 0))::int AS stock_actual
      FROM catalogo_productos p
      LEFT JOIN stock_movimientos m ON m.producto_id = p.id
      WHERE p.activo = true
      GROUP BY p.id, p.stock_minimo, p.stock_inicial
    ) sub
  `);
  return c.json(r);
});

// GET /producto/:id/movimientos
stock.get('/producto/:id/movimientos', async (c) => {
  const { id } = c.req.param();
  const { rows } = await db.query(`
    SELECT m.*,
      l.numero       AS lote_numero,
      l.fecha_ingreso AS lote_fecha,
      l.remito_nro   AS lote_remito,
      prov.nombre    AS proveedor_nombre,
      op.numero      AS operacion_numero
    FROM stock_movimientos m
    LEFT JOIN stock_lotes l    ON l.id  = m.lote_id
    LEFT JOIN proveedores prov ON prov.id = l.proveedor_id
    LEFT JOIN operaciones op   ON op.id  = m.operacion_id
    WHERE m.producto_id = $1
    ORDER BY m.created_at DESC
    LIMIT 60
  `, [id]);
  return c.json(rows);
});

// GET /lotes — historial de lotes con totales de ingreso/egreso por producto
stock.get('/lotes', async (c) => {
  const search = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = '';
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where = `WHERE l.numero ILIKE $1 OR COALESCE(l.remito_nro,'') ILIKE $1 OR COALESCE(prov.nombre,'') ILIKE $1`;
  }

  const { rows } = await db.query(`
    SELECT
      l.*,
      prov.nombre AS proveedor_nombre,
      COALESCE(json_agg(
        json_build_object(
          'producto_id',       p.id,
          'nombre',            p.nombre,
          'tipo_abertura',     ta.nombre,
          'cantidad_ingresada', COALESCE(ing.cant, 0),
          'cantidad_egresada',  COALESCE(egr.cant, 0),
          'stock_remanente',   COALESCE(ing.cant, 0) - COALESCE(egr.cant, 0),
          'costo_unitario',    ing.costo
        ) ORDER BY p.nombre
      ) FILTER (WHERE p.id IS NOT NULL), '[]') AS items
    FROM stock_lotes l
    LEFT JOIN proveedores prov ON prov.id = l.proveedor_id
    LEFT JOIN LATERAL (
      SELECT m.producto_id, SUM(m.cantidad)::int AS cant, MAX(m.costo_unitario) AS costo
      FROM stock_movimientos m
      WHERE m.lote_id = l.id AND m.tipo = 'ingreso'
      GROUP BY m.producto_id
    ) ing ON true
    LEFT JOIN catalogo_productos p  ON p.id = ing.producto_id
    LEFT JOIN tipos_abertura ta     ON ta.id = p.tipo_abertura_id
    LEFT JOIN LATERAL (
      SELECT m.producto_id, SUM(-m.cantidad)::int AS cant
      FROM stock_movimientos m
      WHERE m.lote_id = l.id AND m.tipo LIKE 'egreso%'
      GROUP BY m.producto_id
    ) egr ON egr.producto_id = ing.producto_id
    ${where}
    GROUP BY l.id, prov.nombre
    ORDER BY l.created_at DESC
    LIMIT 100
  `, params);
  return c.json(rows);
});

// GET /lotes/producto/:id — lotes de un producto para select
stock.get('/lotes/producto/:id', async (c) => {
  const { id } = c.req.param();
  const { rows } = await db.query(`
    SELECT DISTINCT l.id, l.numero, l.fecha_ingreso, l.remito_nro, prov.nombre AS proveedor_nombre
    FROM stock_lotes l
    JOIN stock_movimientos m ON m.lote_id = l.id
    LEFT JOIN proveedores prov ON prov.id = l.proveedor_id
    WHERE m.producto_id = $1 AND m.tipo = 'ingreso'
    ORDER BY l.fecha_ingreso DESC
    LIMIT 20
  `, [id]);
  return c.json(rows);
});

// POST /ingresar
stock.post('/ingresar', async (c) => {
  const user = c.get('user');
  const b    = await c.req.json();

  if (!b.producto_id)          return c.json({ error: 'producto_id requerido' }, 400);
  if (!b.cantidad || b.cantidad <= 0) return c.json({ error: 'cantidad debe ser > 0' }, 400);

  const client: pkg.PoolClient = await db.connect();
  try {
    await client.query('BEGIN');

    let loteId: string;
    if (b.lote_id) {
      loteId = b.lote_id;
    } else {
      const numero = await nextLoteNumero(client, b.producto_id);
      const { rows: [lote] } = await client.query(`
        INSERT INTO stock_lotes (numero, proveedor_id, fecha_ingreso, remito_nro, factura_nro, notas)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
      `, [
        numero,
        b.proveedor_id  || null,
        b.fecha_ingreso || new Date().toISOString().split('T')[0],
        b.remito_nro    || null,
        b.factura_nro   || null,
        b.notas_lote    || null,
      ]);
      loteId = lote.id;
    }

    const { rows: [mov] } = await client.query(`
      INSERT INTO stock_movimientos
        (producto_id, lote_id, tipo, cantidad, costo_unitario, referencia_nro, notas, created_by)
      VALUES ($1,$2,'ingreso',$3,$4,$5,$6,$7)
      RETURNING *
    `, [
      b.producto_id,
      loteId,
      parseInt(b.cantidad),
      b.costo_unitario != null ? parseFloat(b.costo_unitario) : null,
      b.remito_nro     || null,
      b.notas          || null,
      user?.id         || null,
    ]);

    await client.query('COMMIT');

    // Traer número de lote para devolver
    const { rows: [lote] } = await db.query(`SELECT numero FROM stock_lotes WHERE id=$1`, [loteId]);
    return c.json({ movimiento: mov, lote_id: loteId, lote_numero: lote?.numero }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// POST /egresar
stock.post('/egresar', async (c) => {
  const user = c.get('user');
  const b    = await c.req.json();

  if (!b.producto_id)          return c.json({ error: 'producto_id requerido' }, 400);
  if (!b.cantidad || b.cantidad <= 0) return c.json({ error: 'cantidad debe ser > 0' }, 400);
  if (!b.tipo)                 return c.json({ error: 'tipo requerido' }, 400);

  // Verificar stock suficiente
  const { rows: [{ actual }] } = await db.query(
    `SELECT (COALESCE(p.stock_inicial,0) + COALESCE(SUM(m.cantidad),0))::int AS actual
     FROM catalogo_productos p
     LEFT JOIN stock_movimientos m ON m.producto_id = p.id
     WHERE p.id = $1 GROUP BY p.id, p.stock_inicial`,
    [b.producto_id]
  );
  if (parseInt(actual) < parseInt(b.cantidad)) {
    return c.json({ error: `Stock insuficiente (disponible: ${actual})` }, 409);
  }

  const { rows: [mov] } = await db.query(`
    INSERT INTO stock_movimientos
      (producto_id, lote_id, tipo, cantidad, motivo, operacion_id, referencia_nro, notas, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [
    b.producto_id,
    b.lote_id        || null,
    b.tipo,
    -Math.abs(parseInt(b.cantidad)),
    b.motivo         || null,
    b.operacion_id   || null,
    b.referencia_nro || null,
    b.notas          || null,
    user?.id         || null,
  ]);

  return c.json(mov, 201);
});

// POST /ajustar — corrección manual de inventario
stock.post('/ajustar', async (c) => {
  const user = c.get('user');
  const b    = await c.req.json();

  if (!b.producto_id)    return c.json({ error: 'producto_id requerido' }, 400);
  if (b.cantidad == null) return c.json({ error: 'cantidad requerida' }, 400);

  const { rows: [mov] } = await db.query(`
    INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, notas, created_by)
    VALUES ($1, 'ajuste', $2, $3, $4, $5)
    RETURNING *
  `, [
    b.producto_id,
    parseInt(b.cantidad),
    b.motivo || 'Ajuste manual',
    b.notas  || null,
    user?.id || null,
  ]);

  return c.json(mov, 201);
});

export default stock;
