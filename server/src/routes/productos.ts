import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../db.js';

const productos = new Hono();

const withJoins = `
  SELECT cp.*,
    (COALESCE(cp.stock_inicial, 0) + COALESCE((
      SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
    ), 0))::int AS stock_actual,
    CASE WHEN ta.id IS NOT NULL
      THEN json_build_object('id', ta.id, 'nombre', ta.nombre)
      ELSE NULL END AS tipo_abertura,
    CASE WHEN s.id IS NOT NULL
      THEN json_build_object('id', s.id, 'nombre', s.nombre)
      ELSE NULL END AS sistema,
    CASE WHEN p.id IS NOT NULL
      THEN json_build_object('id', p.id, 'nombre', p.nombre)
      ELSE NULL END AS proveedor,
    CASE WHEN mo.id IS NOT NULL
      THEN json_build_object('id', mo.id, 'nombre', mo.nombre)
      ELSE NULL END AS modelo
  FROM catalogo_productos cp
  LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
  LEFT JOIN sistemas s ON s.id = cp.sistema_id
  LEFT JOIN proveedores p ON p.id = cp.proveedor_id
  LEFT JOIN catalogo_modelos mo ON mo.id = cp.modelo_id
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

  const { rows } = await db.query(`
    SELECT cp.*,
      (COALESCE(cp.stock_inicial, 0) + COALESCE(SUM(m.cantidad), 0))::int AS stock_actual,
      CASE WHEN ta.id IS NOT NULL
        THEN json_build_object('id', ta.id, 'nombre', ta.nombre)
        ELSE NULL END AS tipo_abertura,
      CASE WHEN s.id IS NOT NULL
        THEN json_build_object('id', s.id, 'nombre', s.nombre)
        ELSE NULL END AS sistema,
      CASE WHEN p.id IS NOT NULL
        THEN json_build_object('id', p.id, 'nombre', p.nombre)
        ELSE NULL END AS proveedor,
      CASE WHEN mo.id IS NOT NULL
        THEN json_build_object('id', mo.id, 'nombre', mo.nombre)
        ELSE NULL END AS modelo
    FROM catalogo_productos cp
    LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
    LEFT JOIN sistemas s ON s.id = cp.sistema_id
    LEFT JOIN proveedores p ON p.id = cp.proveedor_id
    LEFT JOIN catalogo_modelos mo ON mo.id = cp.modelo_id
    LEFT JOIN stock_movimientos m ON m.producto_id = cp.id
    ${where}
    GROUP BY cp.id, ta.id, s.id, p.id, mo.id
    ORDER BY cp.tipo, cp.nombre
  `, params);
  return c.json(rows);
});

// PATCH /renovar-validez-precios — renueva precio_actualizado_at por lotes (una o
// varias familias de abertura) sin tocar el precio en sí. Para cuando el panorama
// económico no amerita cambios y no tiene sentido revisar producto por producto
// solo para resetear el semáforo de antigüedad (verde ≤7d / amarillo 8-10 / rojo >10,
// ver colorPorAntiguedadPrecio en TarjetaProductoMosaico.tsx).
productos.patch('/renovar-validez-precios', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { tipo_abertura_ids?: string[] };
  const ids = body.tipo_abertura_ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'Seleccioná al menos una familia' }, 422);
  }
  const { rowCount } = await db.query(
    `UPDATE catalogo_productos SET precio_actualizado_at = now()
     WHERE tipo_abertura_id = ANY($1::uuid[]) AND activo = true`,
    [ids]
  );
  return c.json({ actualizados: rowCount });
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
// Redimensiona a máx. 1600px de lado mayor y recodifica a WebP calidad 82.
// Las fotos de celular llegan a pesar 2-8MB — se muestran como miniaturas
// de ~100px en galerías, eso hacía la carga muy lenta en conexiones débiles.
productos.post('/upload-imagen', async (c) => {
  const body = await c.req.formData();
  const file = body.get('imagen') as File | null;
  if (!file || !file.size) return c.json({ error: 'No se recibió imagen' }, 400);

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) return c.json({ error: 'Formato no permitido' }, 400);

  const filename = `${randomUUID()}.webp`;
  const dir = './uploads/productos';
  await mkdir(dir, { recursive: true });

  const optimizado = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate() // respeta orientación EXIF de fotos de celular
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(`${dir}/${filename}`, optimizado);

  return c.json({ url: `/uploads/productos/${filename}` });
});

function resolveImagenUrl(b: { imagen_url?: string | null; imagenes?: string[] }): string | null {
  if (Array.isArray(b.imagenes) && b.imagenes.length > 0) return b.imagenes[0];
  return b.imagen_url || null;
}

productos.post('/', async (c) => {
  const b = await c.req.json();

  if (b.en_salon && (b.stock_inicial ?? 0) < 1) {
    return c.json({ error: 'No se puede marcar "Exhibido en salón" sin al menos 1 unidad en stock' }, 422);
  }

  const { rows: [row] } = await db.query(`
    INSERT INTO catalogo_productos
      (nombre, descripcion, tipo, tipo_abertura_id, sistema_id,
       ancho, alto, costo_base, precio_base, precio_por_m2, activo,
       codigo, color, stock_inicial, stock_minimo, proveedor_id,
       imagen_url, caracteristica_1, caracteristica_2, caracteristica_3, caracteristica_4,
       vidrio, premarco, accesorios, atributos, margen_tipo, promocion, imagenes, video_url, etiqueta,
       proveedor_sku, margen_venta, precio_manual, en_salon, categoria_id, nivel_comercial, modelo_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
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
    b.etiqueta || null,
    b.proveedor_sku?.trim() || null,
    b.margen_venta != null ? parseFloat(b.margen_venta) : null,
    b.precio_manual ?? false,
    b.en_salon ?? false,
    b.categoria_id || null,
    b.nivel_comercial || null,
    b.modelo_id || null,
  ]);
  return c.json(row, 201);
});

productos.put('/:id', async (c) => {
  const b = await c.req.json();

  if (b.en_salon) {
    const { rows: [mov] } = await db.query(
      `SELECT COALESCE(SUM(cantidad),0)::int AS suma FROM stock_movimientos WHERE producto_id = $1`,
      [c.req.param('id')]
    );
    const stockActual = (b.stock_inicial ?? 0) + Number(mov?.suma ?? 0);
    if (stockActual < 1) {
      return c.json({ error: 'No se puede marcar "Exhibido en salón" sin al menos 1 unidad en stock' }, 422);
    }
  }

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
      precio_actualizado_at = CASE WHEN precio_base IS DISTINCT FROM $9 THEN now() ELSE precio_actualizado_at END,
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
      video_url        = $29,
      etiqueta         = $30,
      proveedor_sku    = $31,
      margen_venta     = $32,
      precio_manual    = $33,
      en_salon         = $34,
      categoria_id     = $35,
      nivel_comercial  = $36,
      modelo_id        = $37
    WHERE id = $38 RETURNING *
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
    b.etiqueta || null,
    b.proveedor_sku?.trim() || null,
    b.margen_venta != null ? parseFloat(b.margen_venta) : null,
    b.precio_manual ?? false,
    b.en_salon ?? false,
    b.categoria_id || null,
    b.nivel_comercial || null,
    b.modelo_id || null,
    c.req.param('id'),
  ]);
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(row);
});

productos.delete('/:id', async (c) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM catalogo_productos WHERE id = $1',
      [c.req.param('id')]
    );
    if (!rowCount) return c.json({ error: 'Producto no encontrado' }, 404);
    return c.json({ ok: true });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === '23503') {
      return c.json({
        error: 'El producto tiene movimientos de stock asociados y no puede eliminarse. Desactivalo en su lugar.',
      }, 409);
    }
    throw err;
  }
});

productos.patch('/:id/toggle', async (c) => {
  const { rows: [row] } = await db.query(`
    UPDATE catalogo_productos SET activo = NOT activo
    WHERE id = $1 RETURNING id, activo
  `, [c.req.param('id')]);
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(row);
});

productos.patch('/:id/toggle-salon', async (c) => {
  const { id } = c.req.param();

  const { rows: [actual] } = await db.query(`
    SELECT cp.en_salon,
      (COALESCE(cp.stock_inicial, 0) + COALESCE((
        SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
      ), 0))::int AS stock_actual
    FROM catalogo_productos cp WHERE cp.id = $1
  `, [id]);
  if (!actual) return c.json({ error: 'Producto no encontrado' }, 404);

  if (!actual.en_salon && actual.stock_actual < 1) {
    return c.json({ error: 'No se puede marcar "Exhibido en salón" sin al menos 1 unidad en stock' }, 422);
  }

  const { rows: [row] } = await db.query(`
    UPDATE catalogo_productos SET en_salon = NOT en_salon
    WHERE id = $1 RETURNING id, en_salon
  `, [id]);
  return c.json(row);
});

// Disponibilidad confirmada con el proveedor (hoy se chequea por WhatsApp) — mientras
// no esté confirmada (o esté vencida), la fecha de entrega debe mostrarse como estimativa.
productos.patch('/:id/disponibilidad', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const body = await c.req.json<{ confirmado: boolean }>();

  const { rows: [row] } = await db.query(`
    UPDATE catalogo_productos SET
      disponibilidad_confirmada_at = CASE WHEN $1 THEN now() ELSE NULL END,
      disponibilidad_confirmada_by = CASE WHEN $1 THEN $2::uuid ELSE NULL END
    WHERE id = $3 RETURNING *
  `, [body.confirmado, user?.id ?? null, id]);

  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(row);
});

export default productos;
