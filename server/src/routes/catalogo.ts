import { Hono } from 'hono';
import { db } from '../db.js';

const catalogo = new Hono();

// ── Tipos de abertura ─────────────────────────────────────────────────────────

catalogo.get('/tipos-abertura', async (c) => {
  const all = c.req.query('all') === '1';
  const { rows } = await db.query(
    `SELECT * FROM tipos_abertura ${all ? '' : 'WHERE activo = true'} ORDER BY orden, nombre`
  );
  return c.json(rows);
});

catalogo.post('/tipos-abertura', async (c) => {
  const { nombre, descripcion, icono, orden } = await c.req.json();
  if (!nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(
    `INSERT INTO tipos_abertura (nombre, descripcion, icono, orden)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [nombre.trim(), descripcion || null, icono || null, orden ?? 0]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/tipos-abertura/:id', async (c) => {
  const { nombre, descripcion, icono, orden, activo } = await c.req.json();
  const { rows } = await db.query(
    `UPDATE tipos_abertura SET nombre=$1, descripcion=$2, icono=$3, orden=$4, activo=$5
     WHERE id=$6 RETURNING *`,
    [nombre?.trim(), descripcion || null, icono || null, orden ?? 0, activo ?? true, c.req.param('id')]
  );
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

catalogo.delete('/tipos-abertura/:id', async (c) => {
  await db.query(`UPDATE tipos_abertura SET activo=false WHERE id=$1`, [c.req.param('id')]);
  return c.json({ ok: true });
});

// ── Sistemas ──────────────────────────────────────────────────────────────────

catalogo.get('/sistemas', async (c) => {
  const all = c.req.query('all') === '1';
  const { rows } = await db.query(
    `SELECT * FROM sistemas ${all ? '' : 'WHERE activo = true'} ORDER BY nombre`
  );
  return c.json(rows);
});

catalogo.post('/sistemas', async (c) => {
  const { nombre, material, descripcion } = await c.req.json();
  if (!nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(
    `INSERT INTO sistemas (nombre, material, descripcion)
     VALUES ($1, $2, $3) RETURNING *`,
    [nombre.trim(), material || null, descripcion || null]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/sistemas/:id', async (c) => {
  const { nombre, material, descripcion, activo } = await c.req.json();
  const { rows } = await db.query(
    `UPDATE sistemas SET nombre=$1, material=$2, descripcion=$3, activo=$4
     WHERE id=$5 RETURNING *`,
    [nombre?.trim(), material || null, descripcion || null, activo ?? true, c.req.param('id')]
  );
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

catalogo.delete('/sistemas/:id', async (c) => {
  await db.query(`UPDATE sistemas SET activo=false WHERE id=$1`, [c.req.param('id')]);
  return c.json({ ok: true });
});

// ── Colores ───────────────────────────────────────────────────────────────────

catalogo.get('/colores', async (c) => {
  const all = c.req.query('all') === '1';
  const { rows } = await db.query(
    `SELECT * FROM colores ${all ? '' : 'WHERE activo = true'} ORDER BY nombre`
  );
  return c.json(rows);
});

catalogo.post('/colores', async (c) => {
  const { nombre, hex } = await c.req.json();
  if (!nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(
    `INSERT INTO colores (nombre, hex) VALUES ($1, $2) RETURNING *`,
    [nombre.trim(), hex || null]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/colores/:id', async (c) => {
  const { nombre, hex, activo } = await c.req.json();
  const { rows } = await db.query(
    `UPDATE colores SET nombre=$1, hex=$2, activo=$3 WHERE id=$4 RETURNING *`,
    [nombre?.trim(), hex || null, activo ?? true, c.req.param('id')]
  );
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

catalogo.delete('/colores/:id', async (c) => {
  await db.query(`UPDATE colores SET activo=false WHERE id=$1`, [c.req.param('id')]);
  return c.json({ ok: true });
});

// ── Otros ─────────────────────────────────────────────────────────────────────

catalogo.get('/categorias-cliente', async (c) => {
  const { rows } = await db.query(
    `SELECT * FROM categorias_cliente ORDER BY orden, nombre`
  );
  return c.json(rows);
});

catalogo.get('/proveedores', async (c) => {
  const all = c.req.query('all') === '1';
  const { rows } = await db.query(
    `SELECT * FROM proveedores ${all ? '' : 'WHERE activo = true'} ORDER BY nombre`
  );
  return c.json(rows);
});

catalogo.post('/proveedores', async (c) => {
  const b = await c.req.json();
  if (!b.nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(
    `INSERT INTO proveedores (nombre, tipo, contacto, telefono, email, cuit, direccion, localidad, provincia, web, materiales, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      b.nombre.trim(), b.tipo || null, b.contacto || null, b.telefono || null,
      b.email || null, b.cuit || null, b.direccion || null, b.localidad || null,
      b.provincia || null, b.web || null,
      Array.isArray(b.materiales) ? b.materiales : [],
      b.notas || null,
    ]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/proveedores/:id', async (c) => {
  const b = await c.req.json();
  const { rows } = await db.query(
    `UPDATE proveedores
     SET nombre=$1, tipo=$2, contacto=$3, telefono=$4, email=$5, cuit=$6,
         direccion=$7, localidad=$8, provincia=$9, web=$10, materiales=$11,
         notas=$12, activo=$13
     WHERE id=$14 RETURNING *`,
    [
      b.nombre?.trim(), b.tipo || null, b.contacto || null, b.telefono || null,
      b.email || null, b.cuit || null, b.direccion || null, b.localidad || null,
      b.provincia || null, b.web || null,
      Array.isArray(b.materiales) ? b.materiales : [],
      b.notas || null, b.activo ?? true,
      c.req.param('id'),
    ]
  );
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

catalogo.delete('/proveedores/:id', async (c) => {
  await db.query(`UPDATE proveedores SET activo=false WHERE id=$1`, [c.req.param('id')]);
  return c.json({ ok: true });
});

catalogo.get('/productos', async (c) => {
  const tipo = c.req.query('tipo');
  const search = c.req.query('search') ?? '';

  let q = `
    SELECT cp.*,
      json_build_object('id', ta.id, 'nombre', ta.nombre) AS tipo_abertura,
      json_build_object('id', s.id, 'nombre', s.nombre) AS sistema
    FROM catalogo_productos cp
    LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
    LEFT JOIN sistemas s ON s.id = cp.sistema_id
    WHERE cp.activo = true
  `;
  const params: unknown[] = [];

  if (tipo) {
    params.push(tipo);
    q += ` AND cp.tipo = $${params.length}`;
  }
  if (search.trim()) {
    params.push(`%${search}%`);
    q += ` AND cp.nombre ILIKE $${params.length}`;
  }
  q += ` ORDER BY cp.tipo, cp.nombre`;

  const { rows } = await db.query(q, params);
  return c.json(rows);
});

export default catalogo;
