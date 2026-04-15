import { Hono } from 'hono';
import { db } from '../db.js';

const catalogo = new Hono();

catalogo.get('/tipos-abertura', async (c) => {
  const { rows } = await db.query(
    `SELECT * FROM tipos_abertura WHERE activo = true ORDER BY orden, nombre`
  );
  return c.json(rows);
});

catalogo.get('/sistemas', async (c) => {
  const { rows } = await db.query(
    `SELECT * FROM sistemas WHERE activo = true ORDER BY nombre`
  );
  return c.json(rows);
});

catalogo.get('/categorias-cliente', async (c) => {
  const { rows } = await db.query(
    `SELECT * FROM categorias_cliente ORDER BY orden, nombre`
  );
  return c.json(rows);
});

catalogo.get('/proveedores', async (c) => {
  const { rows } = await db.query(
    `SELECT * FROM proveedores WHERE activo = true ORDER BY nombre`
  );
  return c.json(rows);
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
