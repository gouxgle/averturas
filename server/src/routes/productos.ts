import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

const productos = new Hono();

const withJoins = `
  SELECT cp.*,
    CASE WHEN ta.id IS NOT NULL
      THEN json_build_object('id', ta.id, 'nombre', ta.nombre)
      ELSE NULL END AS tipo_abertura,
    CASE WHEN s.id IS NOT NULL
      THEN json_build_object('id', s.id, 'nombre', s.nombre)
      ELSE NULL END AS sistema,
    CASE WHEN p.id IS NOT NULL
      THEN json_build_object('id', p.id, 'nombre', p.nombre)
      ELSE NULL END AS proveedor
  FROM catalogo_productos cp
  LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
  LEFT JOIN sistemas s ON s.id = cp.sistema_id
  LEFT JOIN proveedores p ON p.id = cp.proveedor_id
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
    where += ` AND (cp.nombre ILIKE $${params.length} OR cp.codigo ILIKE $${params.length})`;
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

// ── Upload imagen ─────────────────────────────────────────────
productos.post('/upload-imagen', async (c) => {
  const body = await c.req.formData();
  const file = body.get('imagen') as File | null;
  if (!file || !file.size) return c.json({ error: 'No se recibió imagen' }, 400);

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) return c.json({ error: 'Formato no permitido' }, 400);

  const filename = `${randomUUID()}.${ext}`;
  const dir = './uploads/productos';
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${filename}`, Buffer.from(await file.arrayBuffer()));

  return c.json({ url: `/uploads/productos/${filename}` });
});

function resolveImagenUrl(b: { imagen_url?: string | null; imagenes?: string[] }): string | null {
  if (Array.isArray(b.imagenes) && b.imagenes.length > 0) return b.imagenes[0];
  return b.imagen_url || null;
}

productos.post('/', async (c) => {
  const b = await c.req.json();
  const { rows: [row] } = await db.query(`
    INSERT INTO catalogo_productos
      (nombre, descripcion, tipo, tipo_abertura_id, sistema_id,
       ancho, alto, costo_base, precio_base, precio_por_m2, activo,
       codigo, color, stock_inicial, stock_minimo, proveedor_id,
       imagen_url, caracteristica_1, caracteristica_2, caracteristica_3, caracteristica_4,
       vidrio, premarco, accesorios, atributos, margen_tipo, promocion, imagenes, video_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
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
    b.codigo?.trim() || null,
    b.color?.trim() || null,
    b.stock_inicial ?? 0,
    b.stock_minimo ?? 0,
    b.proveedor_id || null,
    resolveImagenUrl(b),
    b.caracteristica_1?.trim() || null,
    b.caracteristica_2?.trim() || null,
    b.caracteristica_3?.trim() || null,
    b.caracteristica_4?.trim() || null,
    b.vidrio || null,
    b.premarco ?? false,
    b.accesorios ?? [],
    JSON.stringify(b.atributos ?? {}),
    b.margen_tipo || null,
    b.promocion ? JSON.stringify(b.promocion) : null,
    JSON.stringify(Array.isArray(b.imagenes) ? b.imagenes : (b.imagen_url ? [b.imagen_url] : [])),
    b.video_url || null,
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
      activo           = $11,
      codigo           = $12,
      color            = $13,
      stock_inicial    = $14,
      stock_minimo     = $15,
      proveedor_id     = $16,
      imagen_url       = $17,
      caracteristica_1 = $18,
      caracteristica_2 = $19,
      caracteristica_3 = $20,
      caracteristica_4 = $21,
      vidrio           = $22,
      premarco         = $23,
      accesorios       = $24,
      atributos        = $25,
      margen_tipo      = $26,
      promocion        = $27,
      imagenes         = $28,
      video_url        = $29
    WHERE id = $30 RETURNING *
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
    b.codigo?.trim() || null,
    b.color?.trim() || null,
    b.stock_inicial ?? 0,
    b.stock_minimo ?? 0,
    b.proveedor_id || null,
    resolveImagenUrl(b),
    b.caracteristica_1?.trim() || null,
    b.caracteristica_2?.trim() || null,
    b.caracteristica_3?.trim() || null,
    b.caracteristica_4?.trim() || null,
    b.vidrio || null,
    b.premarco ?? false,
    b.accesorios ?? [],
    JSON.stringify(b.atributos ?? {}),
    b.margen_tipo || null,
    b.promocion ? JSON.stringify(b.promocion) : null,
    JSON.stringify(Array.isArray(b.imagenes) ? b.imagenes : (b.imagen_url ? [b.imagen_url] : [])),
    b.video_url || null,
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
