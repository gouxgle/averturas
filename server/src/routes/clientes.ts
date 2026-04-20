import { Hono } from 'hono';
import { db } from '../db.js';

const clientes = new Hono();

clientes.get('/', async (c) => {
  const search = c.req.query('search') ?? '';
  const estado = c.req.query('estado') ?? '';
  const params: unknown[] = [];
  let where = `WHERE c.activo = true`;

  if (search.trim()) {
    params.push(`%${search}%`);
    const n = params.length;
    where += ` AND (c.nombre ILIKE $${n} OR c.apellido ILIKE $${n} OR c.razon_social ILIKE $${n} OR c.telefono ILIKE $${n} OR c.documento_nro ILIKE $${n})`;
  }
  if (estado.trim()) {
    params.push(estado);
    where += ` AND c.estado = $${params.length}`;
  }

  const { rows } = await db.query(`
    SELECT c.*,
      EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
      CASE WHEN cat.id IS NOT NULL
        THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
        ELSE NULL END AS categoria
    FROM clientes c
    LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
    ${where}
    ORDER BY c.ultima_interaccion DESC NULLS LAST, c.apellido ASC, c.nombre ASC
    LIMIT 200
  `, params);

  return c.json(rows);
});

clientes.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [
    { rows: [cliente] },
    { rows: operaciones },
    { rows: interacciones },
    { rows: tareas },
  ] = await Promise.all([
    db.query(`
      SELECT c.*,
        EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
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
      ORDER BY i.created_at DESC LIMIT 50
    `, [id]),
    db.query(`
      SELECT t.*,
        CASE WHEN u.id IS NOT NULL
          THEN json_build_object('nombre', u.nombre)
          ELSE NULL END AS created_by_usuario
      FROM tareas t
      LEFT JOIN usuarios u ON u.id = t.created_by
      WHERE t.cliente_id = $1
      ORDER BY t.completada ASC,
        CASE WHEN t.vencimiento IS NULL THEN 1 ELSE 0 END,
        t.vencimiento ASC,
        CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END
    `, [id]),
  ]);

  if (!cliente) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json({ ...cliente, operaciones, interacciones, tareas });
});

clientes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    INSERT INTO clientes
      (tipo_persona, nombre, apellido, razon_social, documento_nro,
       telefono, email, direccion, localidad, categoria_id,
       estado, origen, fecha_nacimiento, genero, notas, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING *
  `, [
    body.tipo_persona?.trim() || 'fisica',
    body.nombre?.trim() || null,
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.documento_nro?.trim() || null,
    body.telefono?.trim() || null,
    body.email?.trim() || null,
    body.direccion?.trim() || null,
    body.localidad?.trim() || null,
    body.categoria_id || null,
    body.estado?.trim() || 'activo',
    body.origen?.trim() || null,
    body.fecha_nacimiento || null,
    body.genero?.trim() || null,
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
      tipo_persona    = $1,
      nombre          = $2,
      apellido        = $3,
      razon_social    = $4,
      documento_nro   = $5,
      telefono        = $6,
      email           = $7,
      direccion       = $8,
      localidad       = $9,
      categoria_id    = $10,
      estado          = $11,
      origen          = $12,
      fecha_nacimiento= $13,
      genero          = $14,
      notas           = $15
    WHERE id = $16 RETURNING *
  `, [
    body.tipo_persona?.trim() || 'fisica',
    body.nombre?.trim() || null,
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.documento_nro?.trim() || null,
    body.telefono?.trim() || null,
    body.email?.trim() || null,
    body.direccion?.trim() || null,
    body.localidad?.trim() || null,
    body.categoria_id || null,
    body.estado?.trim() || 'activo',
    body.origen?.trim() || null,
    body.fecha_nacimiento || null,
    body.genero?.trim() || null,
    body.notas?.trim() || null,
    id,
  ]);

  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json(row);
});

export default clientes;
