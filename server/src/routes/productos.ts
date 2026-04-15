import { Hono } from 'hono';
import { db } from '../db.js';

const productos = new Hono();

const withJoins = `
  SELECT cp.*,
    CASE WHEN ta.id IS NOT NULL
      THEN json_build_object('id', ta.id, 'nombre', ta.nombre)
      ELSE NULL END AS tipo_abertura,
    CASE WHEN s.id IS NOT NULL
      THEN json_build_object('id', s.id, 'nombre', s.nombre)
      ELSE NULL END AS sistema
  FROM catalogo_productos cp
  LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
  LEFT JOIN sistemas s ON s.id = cp.sistema_id
`;

productos.get('/', async (c) => {
  const tipo   = c.req.query('tipo');
  const search = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (tipo && tipo !== 'todos') {
    params.push(tipo);
    where += ` AND cp.tipo = $${params.length}`;
  }
  if (search.trim()) {
    params.push(`%${search}%`);
    where += ` AND cp.nombre ILIKE $${params.length}`;
  }

  const { rows } = await db.query(
    `${withJoins} ${where} ORDER BY cp.tipo, cp.nombre`,
    params
  );
  return c.json(rows);
});

productos.get('/:id', async (c) => {
  const { rows: [row] } = await db.query(
    `${withJoins} WHERE cp.id = $1`,
    [c.req.param('id')]
  );
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(row);
});

productos.post('/', async (c) => {
  const b = await c.req.json();
  const { rows: [row] } = await db.query(`
    INSERT INTO catalogo_productos
      (nombre, descripcion, tipo, tipo_abertura_id, sistema_id,
       ancho, alto, costo_base, precio_base, precio_por_m2, activo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `, [
    b.nombre?.trim(),
    b.descripcion?.trim() || null,
    b.tipo,
    b.tipo_abertura_id || null,
    b.sistema_id || null,
    b.ancho ?? null,
    b.alto ?? null,
    b.costo_base,
    b.precio_base,
    b.precio_por_m2 ?? false,
    b.activo ?? true,
  ]);
  return c.json(row, 201);
});

productos.put('/:id', async (c) => {
  const b = await c.req.json();
  const { rows: [row] } = await db.query(`
    UPDATE catalogo_productos SET
      nombre           = $1,
      descripcion      = $2,
      tipo             = $3,
      tipo_abertura_id = $4,
      sistema_id       = $5,
      ancho            = $6,
      alto             = $7,
      costo_base       = $8,
      precio_base      = $9,
      precio_por_m2    = $10,
      activo           = $11
    WHERE id = $12 RETURNING *
  `, [
    b.nombre?.trim(),
    b.descripcion?.trim() || null,
    b.tipo,
    b.tipo_abertura_id || null,
    b.sistema_id || null,
    b.ancho ?? null,
    b.alto ?? null,
    b.costo_base,
    b.precio_base,
    b.precio_por_m2 ?? false,
    b.activo ?? true,
    c.req.param('id'),
  ]);
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(row);
});

productos.patch('/:id/toggle', async (c) => {
  const { rows: [row] } = await db.query(`
    UPDATE catalogo_productos SET activo = NOT activo
    WHERE id = $1 RETURNING id, activo
  `, [c.req.param('id')]);
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(row);
});

export default productos;
