import { Hono } from 'hono';
import { db } from '../db.js';

const clientes = new Hono();

clientes.get('/', async (c) => {
  const search = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = `WHERE c.activo = true`;

  if (search.trim()) {
    params.push(`%${search}%`);
    const n = params.length;
    where += ` AND (c.nombre ILIKE $${n} OR c.apellido ILIKE $${n} OR c.telefono ILIKE $${n})`;
  }

  const { rows } = await db.query(`
    SELECT c.*,
      CASE WHEN cat.id IS NOT NULL
        THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
        ELSE NULL END AS categoria
    FROM clientes c
    LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
    ${where}
    ORDER BY c.ultima_interaccion DESC NULLS LAST
    LIMIT 100
  `, params);

  return c.json(rows);
});

clientes.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [{ rows: [cliente] }, { rows: operaciones }, { rows: interacciones }] = await Promise.all([
    db.query(`
      SELECT c.*,
        CASE WHEN cat.id IS NOT NULL
          THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
          ELSE NULL END AS categoria
      FROM clientes c
      LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
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
      ORDER BY i.created_at DESC LIMIT 30
    `, [id]),
  ]);

  if (!cliente) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json({ ...cliente, operaciones, interacciones });
});

clientes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    INSERT INTO clientes
      (nombre, apellido, razon_social, telefono, email, direccion, localidad,
       categoria_id, notas, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `, [
    body.nombre?.trim(),
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.telefono?.trim() || null,
    body.email?.trim() || null,
    body.direccion?.trim() || null,
    body.localidad?.trim() || null,
    body.categoria_id || null,
    body.notas?.trim() || null,
    user.id,
  ]);

  return c.json(row, 201);
});

clientes.put('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    UPDATE clientes SET
      nombre       = $1,
      apellido     = $2,
      razon_social = $3,
      telefono     = $4,
      email        = $5,
      direccion    = $6,
      localidad    = $7,
      categoria_id = $8,
      notas        = $9
    WHERE id = $10 RETURNING *
  `, [
    body.nombre?.trim(),
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.telefono?.trim() || null,
    body.email?.trim() || null,
    body.direccion?.trim() || null,
    body.localidad?.trim() || null,
    body.categoria_id || null,
    body.notas?.trim() || null,
    id,
  ]);

  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json(row);
});

export default clientes;
