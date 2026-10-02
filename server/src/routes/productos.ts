import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { ProductoSchema } from '../lib/schemas.js';
import { z } from 'zod';
import {
  filasRevision, analizarFila, leerConfigPrecios, precioSegunCriterio, redondearPrecio, grupoDe, registrarHistorial,
  type Criterio, type CambioHistorial,
} from '../lib/precios.js';

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
    CASE WHEN li.id IS NOT NULL
      THEN json_build_object('id', li.id, 'nombre', li.nombre)
      ELSE NULL END AS linea,
    CASE WHEN p.id IS NOT NULL
      THEN json_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color, 'plazo_entrega_dias', p.plazo_entrega_dias)
      ELSE NULL END AS proveedor,
    CASE WHEN mo.id IS NOT NULL
      THEN json_build_object('id', mo.id, 'nombre', mo.nombre)
      ELSE NULL END AS modelo
  FROM catalogo_productos cp
  LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
  LEFT JOIN sistemas s ON s.id = cp.sistema_id
  LEFT JOIN lineas li ON li.id = cp.linea_id
  LEFT JOIN proveedores p ON p.id = cp.proveedor_id
  LEFT JOIN catalogo_modelos mo ON mo.id = cp.modelo_id
`;

productos.get('/', async (c) => {
  const tipo   = c.req.query('tipo');
  const search = c.req.query('search') ?? '';
  // ?activo=true — para los selectores de producto (presupuesto, pedido), que no
  // deben ofrecer productos dados de baja. La gestión del catálogo los sigue viendo.
  const soloActivos = c.req.query('activo') === 'true';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (soloActivos) where += ' AND cp.activo = true';
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
      CASE WHEN li.id IS NOT NULL
        THEN json_build_object('id', li.id, 'nombre', li.nombre)
        ELSE NULL END AS linea,
      CASE WHEN p.id IS NOT NULL
        THEN json_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color, 'plazo_entrega_dias', p.plazo_entrega_dias)
        ELSE NULL END AS proveedor,
      CASE WHEN mo.id IS NOT NULL
        THEN json_build_object('id', mo.id, 'nombre', mo.nombre)
        ELSE NULL END AS modelo
    FROM catalogo_productos cp
    LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
    LEFT JOIN sistemas s ON s.id = cp.sistema_id
    LEFT JOIN lineas li ON li.id = cp.linea_id
    LEFT JOIN proveedores p ON p.id = cp.proveedor_id
    LEFT JOIN catalogo_modelos mo ON mo.id = cp.modelo_id
    LEFT JOIN stock_movimientos m ON m.producto_id = cp.id
    ${where}
    GROUP BY cp.id, ta.id, s.id, li.id, p.id, mo.id
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
  // Por familias (tipo_abertura_ids) o por productos elegidos a mano (producto_ids).
  const body = await c.req.json().catch(() => ({})) as { tipo_abertura_ids?: unknown; producto_ids?: unknown };
  const uuids = (v: unknown) => Array.isArray(v) && v.length > 0 && v.length <= 5000
    && v.every(x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) ? v as string[] : null;
  const familias = uuids(body.tipo_abertura_ids);
  const elegidos = uuids(body.producto_ids);
  if (!familias && !elegidos) {
    return c.json({ error: 'Seleccioná al menos una familia o un producto' }, 422);
  }
  const { rows } = await db.query(
    `UPDATE catalogo_productos SET precio_actualizado_at = now()
     WHERE activo = true AND (tipo_abertura_id = ANY($1::uuid[]) OR id = ANY($2::uuid[]))
     RETURNING id, precio_base::float AS precio, costo_base::float AS costo`,
    [familias ?? [], elegidos ?? []]
  );
  await registrarHistorial(db, rows.map(r => ({
    producto_id: r.id, tipo: 'renovacion' as const, precio_anterior: r.precio, precio_nuevo: r.precio,
    costo_anterior: r.costo, costo_nuevo: r.costo, origen: 'revision',
    criterio: familias ? 'renovación por familia' : 'renovación de validez',
  })), c.get('user')?.id ?? null);
  return c.json({ actualizados: rows.length });
});


// ── Revisión integral de precios ────────────────────────────────
// Análisis de cada producto (lib/precios.ts): sugiere renovar la validez de lo que no varió y
// actualizar lo que sí, con los motivos. Registrar ANTES de '/:id'.

const PreviaSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(2000),
  criterio: z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('sugerido') }),
    z.object({ tipo: z.literal('porcentaje'), pct: z.number().min(-90).max(500) }),
    z.object({ tipo: z.literal('dolar') }),
    z.object({ tipo: z.literal('costo'), actualizar_costo: z.boolean() }),
    z.object({ tipo: z.literal('grupos'), por: z.enum(['familia', 'linea', 'proveedor', 'medida']), pcts: z.record(z.string(), z.number().min(-90).max(500)) }),
  ]),
  redondeo: z.number().min(0).max(100_000).default(0),
});

const AplicarSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    precio_nuevo: z.number().positive().max(1_000_000_000),
    costo_nuevo: z.number().positive().max(1_000_000_000).nullable().optional(),
  })).min(1).max(2000),
  criterio: z.string().trim().max(200),
});

const ConfigPreciosSchema = z.object({
  umbral_pct: z.number().min(0.5).max(50),
  dias_al_dia: z.number().int().min(1).max(60),
  dias_vencido: z.number().int().min(2).max(120),
}).refine(c => c.dias_vencido > c.dias_al_dia, { message: 'Los días de vencido tienen que ser más que los de al día', path: ['dias_vencido'] });

productos.get('/revision-precios', async (c) => {
  const [cfg, filas, { rows: [dolar] }, { rows: ipc }] = await Promise.all([
    leerConfigPrecios(),
    filasRevision(),
    db.query(`SELECT (SELECT venta FROM cotizacion_dolar_historial ORDER BY fecha DESC LIMIT 1)::float AS hoy,
                     (SELECT fecha FROM cotizacion_dolar_historial ORDER BY fecha DESC LIMIT 1) AS fecha,
                     (SELECT venta FROM cotizacion_dolar_historial WHERE fecha <= CURRENT_DATE - 30 ORDER BY fecha DESC LIMIT 1)::float AS hace30`),
    db.query(`SELECT mes, variacion::float FROM indice_ipc ORDER BY mes DESC LIMIT 3`),
  ]);
  const productos = filas.map(f => ({ ...f, analisis: analizarFila(f, cfg) }));
  const ipc3 = ipc.length === 3 ? (ipc.reduce((a, m) => a * (1 + m.variacion / 100), 1) - 1) * 100 : null;
  return c.json({
    config: cfg,
    dolar: { hoy: dolar?.hoy ?? null, fecha: dolar?.fecha ?? null, var_30d: dolar?.hoy && dolar?.hace30 ? (dolar.hoy / dolar.hace30 - 1) * 100 : null },
    ipc: { ultimo: ipc[0] ?? null, ultimos_3: ipc3 },
    productos,
  });
});

productos.put('/revision-precios/config', async (c) => {
  if (c.get('user')?.rol !== 'admin') return c.json({ error: 'Solo un administrador cambia los parámetros' }, 403);
  const b = await validateBody(c, ConfigPreciosSchema);
  if (b instanceof Response) return b;
  await db.query(`UPDATE precios_config SET umbral_pct = $1, dias_al_dia = $2, dias_vencido = $3, updated_at = now() WHERE id = 1`,
    [b.umbral_pct, b.dias_al_dia, b.dias_vencido]);
  return c.json(b);
});

/** Vista previa: precio actual → nuevo según el criterio, sin guardar nada. */
productos.post('/revision-precios/previsualizar', async (c) => {
  const b = await validateBody(c, PreviaSchema);
  if (b instanceof Response) return b;
  const cfg = await leerConfigPrecios();
  const filas = await filasRevision(b.ids);
  const criterio = b.criterio as Criterio;
  const items = filas.map(f => {
    const a = analizarFila(f, cfg);
    const grupo = criterio.tipo === 'grupos' ? grupoDe(f, criterio.por) : null;
    const r = precioSegunCriterio(Number(f.precio), a, criterio, grupo);
    const precioNuevo = redondearPrecio(r.precio, b.redondeo);
    const costoNuevo = r.costo ?? Number(f.costo);
    return {
      id: f.id, nombre: f.nombre, codigo: f.codigo, familia: f.familia, linea: f.linea ?? f.sistema, proveedor: f.proveedor,
      precio_manual: f.precio_manual, precio_por_m2: f.precio_por_m2,
      precio_actual: Number(f.precio), precio_nuevo: precioNuevo,
      pct: Number(f.precio) > 0 ? (precioNuevo / Number(f.precio) - 1) * 100 : 0,
      costo_actual: Number(f.costo), costo_nuevo: r.costo !== null ? costoNuevo : null,
      recargo_nuevo: costoNuevo > 0 ? (precioNuevo / costoNuevo - 1) * 100 : null,
      recargo_objetivo: f.recargo_objetivo,
    };
  });
  return c.json({ items });
});

/** Aplica precios (y costos) ya revisados en la vista previa. Todo o nada, con historial. */
productos.post('/revision-precios/aplicar', async (c) => {
  if (c.get('user')?.rol === 'consulta') return c.json({ error: 'Tu usuario es de solo consulta' }, 403);
  const b = await validateBody(c, AplicarSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: antes } = await client.query(
      `SELECT id, precio_base::float AS precio, costo_base::float AS costo FROM catalogo_productos
        WHERE id = ANY($1::uuid[]) AND activo FOR UPDATE`, [b.items.map(i => i.id)]);
    const porId = new Map(antes.map(r => [r.id, r]));
    const cambios: CambioHistorial[] = [];
    for (const it of b.items) {
      const a = porId.get(it.id);
      if (!a) continue;
      const precio = Math.round(it.precio_nuevo * 100) / 100;
      const costo = it.costo_nuevo != null ? Math.round(it.costo_nuevo * 100) / 100 : a.costo;
      await client.query(
        `UPDATE catalogo_productos SET precio_base = $2, costo_base = $3, precio_actualizado_at = now() WHERE id = $1`,
        [it.id, precio, costo]);
      cambios.push({
        producto_id: it.id, tipo: precio !== a.precio ? 'cambio_precio' : costo !== a.costo ? 'cambio_costo' : 'renovacion',
        precio_anterior: a.precio, precio_nuevo: precio, costo_anterior: a.costo, costo_nuevo: costo,
        origen: 'revision', criterio: b.criterio,
      });
    }
    await registrarHistorial(client, cambios, c.get('user')?.id ?? null);
    await client.query('COMMIT');
    return c.json({ actualizados: cambios.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

productos.get('/:id/historial-precios', async (c) => {
  const { rows } = await db.query(`
    SELECT h.*, u.nombre AS usuario FROM producto_precio_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.producto_id = $1 ORDER BY h.created_at DESC LIMIT 50`, [c.req.param('id')]);
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

function resolveImagenUrl(b: { imagen_url?: string | null; imagenes?: string[] | null }): string | null {
  if (Array.isArray(b.imagenes) && b.imagenes.length > 0) return b.imagenes[0];
  return b.imagen_url || null;
}

// Publicar en el catálogo web exige al menos una foto: una ficha sin imagen no sirve
// de cara al cliente y quedaría como un hueco en la galería del sitio.
const SIN_IMAGEN_MSG = 'No se puede publicar en el catálogo online sin al menos una imagen del producto';

function tieneImagen(b: { imagen_url?: string | null; imagenes?: string[] | null }): boolean {
  return resolveImagenUrl(b) !== null;
}

productos.post('/', async (c) => {
  const b = await validateBody(c, ProductoSchema);
  if (b instanceof Response) return b;

  if (b.en_salon && (b.stock_inicial ?? 0) < 1) {
    return c.json({ error: 'No se puede marcar "Exhibido en salón" sin al menos 1 unidad en stock' }, 422);
  }
  if (b.publicado_web && !tieneImagen(b)) {
    return c.json({ error: SIN_IMAGEN_MSG }, 422);
  }

  const { rows: [row] } = await db.query(`
    INSERT INTO catalogo_productos
      (nombre, descripcion, tipo, tipo_abertura_id, sistema_id,
       ancho, alto, costo_base, precio_base, precio_por_m2, activo,
       codigo, color, stock_inicial, stock_minimo, proveedor_id,
       imagen_url, caracteristica_1, caracteristica_2, caracteristica_3, caracteristica_4,
       vidrio, premarco, accesorios, atributos, margen_tipo, promocion, imagenes, video_url, etiqueta,
       proveedor_sku, margen_venta, precio_manual, en_salon, categoria_id, linea_id, modelo_id, material,
       publicado_web, nombre_web)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40)
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
    b.margen_venta ?? null,
    b.precio_manual ?? false,
    b.en_salon ?? false,
    b.categoria_id || null,
    b.linea_id || null,
    b.modelo_id || null,
    b.material?.trim() || null,
    b.publicado_web ?? false,
    b.nombre_web?.trim() || null,
  ]);
  return c.json(row, 201);
});

productos.put('/:id', async (c) => {
  const b = await validateBody(c, ProductoSchema);
  if (b instanceof Response) return b;

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
  if (b.publicado_web && !tieneImagen(b)) {
    return c.json({ error: SIN_IMAGEN_MSG }, 422);
  }
  const { rows: [antes] } = await db.query(
    `SELECT costo_base::float AS costo, precio_base::float AS precio FROM catalogo_productos WHERE id = $1`, [c.req.param('id')]);

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
      linea_id         = $36,
      modelo_id        = $37,
      material         = $38,
      publicado_web    = $39,
      nombre_web       = $40
    WHERE id = $41 RETURNING *
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
    b.margen_venta ?? null,
    b.precio_manual ?? false,
    b.en_salon ?? false,
    b.categoria_id || null,
    b.linea_id || null,
    b.modelo_id || null,
    b.material?.trim() || null,
    b.publicado_web ?? false,
    b.nombre_web?.trim() || null,
    c.req.param('id'),
  ]);
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404);
  if (antes) {
    const cambioPrecio = Number(row.precio_base) !== antes.precio;
    const cambioCosto = Number(row.costo_base) !== antes.costo;
    if (cambioPrecio || cambioCosto) {
      await registrarHistorial(db, [{
        producto_id: row.id, tipo: cambioPrecio ? 'cambio_precio' : 'cambio_costo',
        precio_anterior: antes.precio, precio_nuevo: Number(row.precio_base),
        costo_anterior: antes.costo, costo_nuevo: Number(row.costo_base), origen: 'ficha', criterio: 'a mano',
      }], c.get('user')?.id ?? null).catch(e => console.error('[precios] historial:', e));
    }
  }
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

// Publicar / despublicar en el catálogo del sitio web, sin entrar a editar el producto.
// Mismo patrón que toggle-salon, pero la guarda es tener foto en vez de tener stock.
productos.patch('/:id/toggle-web', async (c) => {
  const { id } = c.req.param();

  const { rows: [actual] } = await db.query(
    `SELECT publicado_web, imagen_url, imagenes FROM catalogo_productos WHERE id = $1`, [id]
  );
  if (!actual) return c.json({ error: 'Producto no encontrado' }, 404);

  if (!actual.publicado_web && !tieneImagen(actual)) {
    return c.json({ error: SIN_IMAGEN_MSG }, 422);
  }

  const { rows: [row] } = await db.query(`
    UPDATE catalogo_productos SET publicado_web = NOT publicado_web
    WHERE id = $1 RETURNING id, publicado_web
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
