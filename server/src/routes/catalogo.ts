import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import {
  TipoAberturaSchema, SistemaSchema, ColorSchema,
  ProveedorSchema, ProveedorPrecioSchema, ProveedorPrecioPatchSchema,
} from '../lib/schemas.js';

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
  const b = await validateBody(c, TipoAberturaSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `INSERT INTO tipos_abertura (nombre, descripcion, icono, orden, margen_venta)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [b.nombre.trim(), b.descripcion || null, b.icono || null, b.orden ?? 0, b.margen_venta ?? null]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/tipos-abertura/:id', async (c) => {
  const b = await validateBody(c, TipoAberturaSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `UPDATE tipos_abertura SET nombre=$1, descripcion=$2, icono=$3, orden=$4, activo=$5, margen_venta=$6
     WHERE id=$7 RETURNING *`,
    [b.nombre.trim(), b.descripcion || null, b.icono || null, b.orden ?? 0, b.activo ?? true, b.margen_venta ?? null, c.req.param('id')]
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
  const b = await validateBody(c, SistemaSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `INSERT INTO sistemas (nombre, material, descripcion) VALUES ($1, $2, $3) RETURNING *`,
    [b.nombre.trim(), b.material || null, b.descripcion || null]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/sistemas/:id', async (c) => {
  const b = await validateBody(c, SistemaSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `UPDATE sistemas SET nombre=$1, material=$2, descripcion=$3, activo=$4 WHERE id=$5 RETURNING *`,
    [b.nombre.trim(), b.material || null, b.descripcion || null, b.activo ?? true, c.req.param('id')]
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
  const b = await validateBody(c, ColorSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `INSERT INTO colores (nombre, hex) VALUES ($1, $2) RETURNING *`,
    [b.nombre.trim(), b.hex || null]
  );
  return c.json(rows[0], 201);
});

catalogo.put('/colores/:id', async (c) => {
  const b = await validateBody(c, ColorSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `UPDATE colores SET nombre=$1, hex=$2, activo=$3 WHERE id=$4 RETURNING *`,
    [b.nombre.trim(), b.hex || null, b.activo ?? true, c.req.param('id')]
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

// GET /proveedores/tablero — panel de gestión con métricas de compras
catalogo.get('/proveedores/tablero', async (c) => {
  const [provResult, comprasResult, rubroResult, movResult, pedidosPendResult] = await Promise.all([
    db.query(`SELECT * FROM proveedores ORDER BY nombre`),

    db.query(`
      SELECT
        l.proveedor_id,
        COUNT(DISTINCT l.id)::int                                                                           AS lotes_count_6m,
        COALESCE(SUM(m.cantidad * COALESCE(m.costo_unitario, 0)), 0)::numeric                              AS compras_monto_6m,
        COUNT(DISTINCT l.id) FILTER (WHERE l.fecha_ingreso >= now() - INTERVAL '30 days')::int             AS lotes_count_30d,
        MAX(l.fecha_ingreso)                                                                                AS ultima_compra_fecha
      FROM stock_lotes l
      JOIN stock_movimientos m ON m.lote_id = l.id AND m.tipo = 'ingreso'
      WHERE l.fecha_ingreso >= now() - INTERVAL '6 months'
        AND l.proveedor_id IS NOT NULL
      GROUP BY l.proveedor_id
    `),

    db.query(`
      SELECT
        COALESCE(ta.nombre, 'Otros') AS rubro,
        COALESCE(SUM(m.cantidad * COALESCE(m.costo_unitario, 0)), 0)::numeric AS total_compras,
        COUNT(DISTINCT l.id)::int AS cant_lotes
      FROM stock_lotes l
      JOIN stock_movimientos m ON m.lote_id = l.id AND m.tipo = 'ingreso'
      JOIN catalogo_productos cp ON cp.id = m.producto_id
      LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
      WHERE l.fecha_ingreso >= now() - INTERVAL '6 months'
      GROUP BY ta.nombre
      ORDER BY total_compras DESC
    `),

    db.query(`
      SELECT
        COALESCE(SUM(m.cantidad * COALESCE(m.costo_unitario,0)) FILTER (WHERE l.fecha_ingreso >= now() - INTERVAL '30 days'), 0)::numeric  AS mes_actual,
        COALESCE(SUM(m.cantidad * COALESCE(m.costo_unitario,0)) FILTER (WHERE l.fecha_ingreso >= now() - INTERVAL '60 days' AND l.fecha_ingreso < now() - INTERVAL '30 days'), 0)::numeric AS mes_anterior
      FROM stock_lotes l
      JOIN stock_movimientos m ON m.lote_id = l.id AND m.tipo = 'ingreso'
    `),

    db.query(`
      SELECT proveedor_id, COUNT(*)::int AS pedidos_pendientes
      FROM pedidos
      WHERE estado = 'pendiente' AND proveedor_id IS NOT NULL
      GROUP BY proveedor_id
    `),
  ]);

  const comprasMap   = new Map((comprasResult.rows as any[]).map(r => [r.proveedor_id, r]));
  const pendientesMap = new Map((pedidosPendResult.rows as any[]).map(r => [r.proveedor_id, r.pedidos_pendientes as number]));

  const proveedores = (provResult.rows as any[]).map(p => {
    const c = comprasMap.get(p.id) as any;
    const diasSinCompra = c?.ultima_compra_fecha
      ? Math.floor((Date.now() - new Date(c.ultima_compra_fecha).getTime()) / 86400000)
      : 999;
    return {
      ...p,
      lotes_count_6m:      c?.lotes_count_6m    ?? 0,
      compras_monto_6m:    Number(c?.compras_monto_6m  ?? 0),
      lotes_count_30d:     c?.lotes_count_30d   ?? 0,
      ultima_compra_fecha: c?.ultima_compra_fecha ?? null,
      dias_sin_compra:     diasSinCompra,
      pedidos_pendientes:  pendientesMap.get(p.id) ?? 0,
    };
  });

  const activos      = proveedores.filter(p => p.activo);
  const deuda_total  = activos.reduce((s, p) => s + Number(p.deuda_actual ?? 0), 0);
  const con_plazo    = activos.filter(p => p.plazo_entrega_dias);
  const prom_plazo   = con_plazo.length > 0
    ? Math.round(con_plazo.reduce((s, p) => s + Number(p.plazo_entrega_dias), 0) / con_plazo.length * 10) / 10
    : 0;
  const mov = movResult.rows[0] as any;
  const mes_actual   = Number(mov?.mes_actual   ?? 0);
  const mes_anterior = Number(mov?.mes_anterior ?? 0);
  const tendencia    = mes_anterior > 0 ? Math.round((mes_actual - mes_anterior) / mes_anterior * 100) : 0;

  const formaEntregaCounts = activos.reduce((acc: Record<string, number>, p) => {
    const fe = p.forma_entrega ?? 'propia';
    acc[fe] = (acc[fe] || 0) + 1;
    return acc;
  }, {});

  const stats = {
    activos_count: activos.length,
    total_count:   proveedores.length,
    deuda_total,
    prom_plazo_dias: prom_plazo,
    compras_mes_actual: mes_actual,
    tendencia_compras:  tendencia,
    forma_entrega_counts: formaEntregaCounts,
  };

  const alertas = {
    con_deuda:      activos.filter(p => Number(p.deuda_actual) > 0).sort((a, b) => Number(b.deuda_actual) - Number(a.deuda_actual)).slice(0, 3),
    sin_actividad:  activos.filter(p => p.dias_sin_compra > 90).slice(0, 3),
    baja_calif:     activos.filter(p => p.calificacion && Number(p.calificacion) <= 2).slice(0, 3),
  };

  const top_proveedores = [...activos]
    .sort((a, b) => b.compras_monto_6m - a.compras_monto_6m)
    .slice(0, 5);

  return c.json({ proveedores, stats, alertas, top_proveedores, compras_por_rubro: rubroResult.rows });
});

catalogo.get('/proveedores', async (c) => {
  const all = c.req.query('all') === '1';
  const { rows } = await db.query(
    `SELECT * FROM proveedores ${all ? '' : 'WHERE activo = true'} ORDER BY nombre`
  );
  return c.json(rows);
});

catalogo.post('/proveedores', async (c) => {
  const b = await validateBody(c, ProveedorSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `INSERT INTO proveedores
       (nombre, tipo, contacto, telefono, email, cuit, direccion, localidad, provincia,
        web, materiales, notas, forma_entrega, plazo_entrega_dias, costo_flete,
        calificacion, deuda_actual, es_principal, margen_venta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      b.nombre.trim(), b.tipo || null, b.contacto || null, b.telefono || null,
      b.email || null, b.cuit || null, b.direccion || null, b.localidad || null,
      b.provincia || null, b.web || null,
      Array.isArray(b.materiales) ? b.materiales : [],
      b.notas           ?? null,
      b.forma_entrega   ?? 'propia',
      b.plazo_entrega_dias ?? null,
      b.costo_flete     ?? 0,
      b.calificacion    ?? null,
      b.deuda_actual    ?? 0,
      b.es_principal    ?? false,
      b.margen_venta    ?? 0,
    ]
  );
  return c.json(rows[0], 201);
});

catalogo.get('/proveedores/:id', async (c) => {
  const { rows: [prov] } = await db.query(`SELECT * FROM proveedores WHERE id=$1`, [c.req.param('id')]);
  if (!prov) return c.json({ error: 'Proveedor no encontrado' }, 404);
  return c.json(prov);
});

catalogo.put('/proveedores/:id', async (c) => {
  const b = await validateBody(c, ProveedorSchema);
  if (b instanceof Response) return b;
  const { rows } = await db.query(
    `UPDATE proveedores
     SET nombre=$1, tipo=$2, contacto=$3, telefono=$4, email=$5, cuit=$6,
         direccion=$7, localidad=$8, provincia=$9, web=$10, materiales=$11,
         notas=$12, activo=$13, forma_entrega=$14, plazo_entrega_dias=$15,
         costo_flete=$16, calificacion=$17, deuda_actual=$18, es_principal=$19,
         margen_venta=$20
     WHERE id=$21 RETURNING *`,
    [
      b.nombre?.trim(), b.tipo || null, b.contacto || null, b.telefono || null,
      b.email || null, b.cuit || null, b.direccion || null, b.localidad || null,
      b.provincia || null, b.web || null,
      Array.isArray(b.materiales) ? b.materiales : [],
      b.notas || null, b.activo ?? true,
      b.forma_entrega       ?? 'propia',
      b.plazo_entrega_dias  ?? null,
      b.costo_flete         ?? 0,
      b.calificacion        ?? null,
      b.deuda_actual        ?? 0,
      b.es_principal        ?? false,
      b.margen_venta        ?? 0,
      c.req.param('id'),
    ]
  );
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

catalogo.delete('/proveedores/:id', async (c) => {
  const id = c.req.param('id');
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS cnt FROM pedidos WHERE proveedor_id=$1 AND estado != 'cancelado'`, [id]
  );
  if (rows[0].cnt > 0) {
    return c.json({ error: `No se puede eliminar: tiene ${rows[0].cnt} pedido${rows[0].cnt > 1 ? 's' : ''} activo${rows[0].cnt > 1 ? 's' : ''}` }, 409);
  }
  await db.query(`DELETE FROM proveedores WHERE id=$1`, [id]);
  return c.json({ ok: true });
});

// ── Proveedor precios ──────────────────────────────────────────
// GET /proveedor-precios?proveedor_id=X&search=Y&activo=true
catalogo.get('/proveedor-precios', async (c) => {
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const search      = c.req.query('search') ?? '';
  const soloActivos = c.req.query('activo') === 'true';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (proveedorId) {
    params.push(proveedorId);
    where += ` AND pp.proveedor_id = $${params.length}`;
  }
  if (soloActivos) {
    where += ' AND pp.activo = true';
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (pp.sku ILIKE $${params.length} OR pp.descripcion ILIKE $${params.length})`;
  }

  const { rows } = await db.query(`
    SELECT pp.*,
      p.nombre AS proveedor_nombre,
      p.margen_venta AS proveedor_margen,
      cp.id AS producto_id,
      cp.nombre AS producto_nombre,
      cp.margen_venta AS producto_margen,
      ta.margen_venta AS tipo_margen,
      ta.nombre AS tipo_nombre,
      COALESCE(cp.margen_venta, ta.margen_venta, p.margen_venta, 0) AS margen_efectivo,
      CASE
        WHEN cp.margen_venta IS NOT NULL THEN 'producto'
        WHEN ta.margen_venta IS NOT NULL THEN 'tipo'
        WHEN p.margen_venta IS NOT NULL AND p.margen_venta > 0 THEN 'proveedor'
        ELSE 'ninguno'
      END AS margen_fuente
    FROM proveedor_precios pp
    JOIN proveedores p ON p.id = pp.proveedor_id
    LEFT JOIN catalogo_productos cp ON cp.id = pp.producto_id
    LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
    ${where}
    ORDER BY pp.sku ASC
    LIMIT 500
  `, params);
  return c.json(rows);
});

// POST /proveedor-precios — upsert individual
catalogo.post('/proveedor-precios', async (c) => {
  const raw = await validateBody(c, ProveedorPrecioSchema.extend({ proveedor_id: z.string().min(1) }));
  if (raw instanceof Response) return raw;
  const b = raw;
  const { rows: [row] } = await db.query(`
    INSERT INTO proveedor_precios (proveedor_id, sku, descripcion, precio, activo)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (proveedor_id, sku) DO UPDATE SET
      descripcion = EXCLUDED.descripcion,
      precio      = EXCLUDED.precio,
      activo      = EXCLUDED.activo,
      updated_at  = now()
    RETURNING *
  `, [b.proveedor_id, b.sku.trim(), b.descripcion?.trim() ?? '', b.precio ?? 0, b.activo ?? true]);
  return c.json(row, 201);
});

// POST /proveedor-precios/import — upsert masivo desde array CSV-parseado
catalogo.post('/proveedor-precios/import', async (c) => {
  const b = await c.req.json() as {
    proveedor_id: string;
    filas: { sku: string; descripcion: string; precio: number }[];
  };
  if (!b.proveedor_id || !Array.isArray(b.filas) || !b.filas.length) {
    return c.json({ error: 'proveedor_id y filas[] requeridos' }, 400);
  }
  const client = await db.connect();
  let insertados = 0; let actualizados = 0;
  try {
    await client.query('BEGIN');
    for (const fila of b.filas) {
      if (!fila.sku?.trim() || !fila.descripcion?.trim()) continue;
      const { rows: [existing] } = await client.query(
        `SELECT id FROM proveedor_precios WHERE proveedor_id=$1 AND sku=$2`,
        [b.proveedor_id, fila.sku.trim()]
      );
      await client.query(`
        INSERT INTO proveedor_precios (proveedor_id, sku, descripcion, precio)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (proveedor_id, sku) DO UPDATE SET
          descripcion = EXCLUDED.descripcion,
          precio      = EXCLUDED.precio,
          updated_at  = now()
      `, [b.proveedor_id, fila.sku.trim(), fila.descripcion.trim(), fila.precio ?? 0]);
      if (existing) actualizados++; else insertados++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return c.json({ insertados, actualizados, total: insertados + actualizados });
});

// PUT /proveedor-precios/:id
catalogo.put('/proveedor-precios/:id', async (c) => {
  const b = await validateBody(c, ProveedorPrecioPatchSchema);
  if (b instanceof Response) return b;
  const id = c.req.param('id');
  const hasProductoId = 'producto_id' in b;
  const params: unknown[] = [b.sku?.trim() ?? null, b.descripcion?.trim() ?? null, b.precio ?? null, b.activo ?? null];
  const pidClause = hasProductoId ? `, producto_id = $${params.push(b.producto_id || null)}` : '';
  params.push(id);
  const { rows: [row] } = await db.query(`
    UPDATE proveedor_precios SET
      sku         = COALESCE($1, sku),
      descripcion = COALESCE($2, descripcion),
      precio      = COALESCE($3, precio),
      activo      = COALESCE($4, activo)
      ${pidClause},
      updated_at  = now()
    WHERE id = $${params.length}
    RETURNING *
  `, params);
  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json(row);
});

// DELETE /proveedor-precios/:id
catalogo.delete('/proveedor-precios/:id', async (c) => {
  await db.query(`DELETE FROM proveedor_precios WHERE id=$1`, [c.req.param('id')]);
  return c.json({ ok: true });
});

// POST /proveedor-precios/aplicar-actualizacion
// Aplica nuevos precios (ítem por ítem o porcentaje batch) y propaga a catálogo si se indica
catalogo.post('/proveedor-precios/aplicar-actualizacion', async (c) => {
  const b = await c.req.json() as {
    proveedor_id: string;
    items: { id: string; precio_nuevo: number; actualizar_catalogo: boolean }[];
    propagar_precio_base: boolean; // si true, recalcula precio_base = precio * (1+margen/100)
  };
  if (!b.proveedor_id || !Array.isArray(b.items) || !b.items.length) {
    return c.json({ error: 'proveedor_id e items[] requeridos' }, 400);
  }
  const client = await db.connect();
  let preciosActualizados = 0;
  let catalogoActualizados = 0;
  try {
    await client.query('BEGIN');
    for (const item of b.items) {
      if (!item.id || item.precio_nuevo == null) continue;
      await client.query(
        `UPDATE proveedor_precios SET precio=$1, updated_at=now() WHERE id=$2`,
        [item.precio_nuevo, item.id]
      );
      preciosActualizados++;
      if (item.actualizar_catalogo) {
        // Obtener producto vinculado y margen efectivo
        const { rows: [pp] } = await client.query(`
          SELECT pp.producto_id,
            COALESCE(cp.margen_venta, ta.margen_venta, p.margen_venta, 0) AS margen_efectivo
          FROM proveedor_precios pp
          JOIN proveedores p ON p.id = pp.proveedor_id
          LEFT JOIN catalogo_productos cp ON cp.id = pp.producto_id
          LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
          WHERE pp.id = $1
        `, [item.id]);
        if (pp?.producto_id) {
          const nuevoCosto = item.precio_nuevo;
          const margen = parseFloat(pp.margen_efectivo) || 0;
          const updates: string[] = ['costo_base=$1'];
          const vals: unknown[] = [nuevoCosto];
          if (b.propagar_precio_base) {
            const nuevoPrecio = Math.round(nuevoCosto * (1 + margen / 100) * 100) / 100;
            updates.push(`precio_base=$${vals.push(nuevoPrecio)}`);
            // precio_manual se mantiene: si estaba en true, no lo tocamos; el usuario decidió al desmarcar
          }
          vals.push(pp.producto_id);
          await client.query(
            `UPDATE catalogo_productos SET ${updates.join(',')} WHERE id=$${vals.length} AND precio_manual=false`,
            vals
          );
          catalogoActualizados++;
        }
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return c.json({ preciosActualizados, catalogoActualizados });
});

catalogo.get('/productos', async (c) => {
  const tipo = c.req.query('tipo');
  const search = c.req.query('search') ?? '';

  let q = `
    SELECT cp.*,
      json_build_object('id', ta.id, 'nombre', ta.nombre) AS tipo_abertura,
      json_build_object('id', s.id,  'nombre', s.nombre)  AS sistema,
      (COALESCE(cp.stock_inicial, 0) + COALESCE(st.mov_total, 0))::int AS stock_actual
    FROM catalogo_productos cp
    LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
    LEFT JOIN sistemas s        ON s.id  = cp.sistema_id
    LEFT JOIN LATERAL (
      SELECT SUM(cantidad)::int AS mov_total
      FROM stock_movimientos WHERE producto_id = cp.id
    ) st ON true
    WHERE cp.activo = true
  `;
  const params: unknown[] = [];

  if (tipo) {
    params.push(tipo);
    q += ` AND cp.tipo = $${params.length}`;
  }
  if (search.trim()) {
    params.push(`%${search}%`);
    q += ` AND (cp.nombre ILIKE $${params.length}
           OR cp.codigo ILIKE $${params.length}
           OR cp.caracteristica_1 ILIKE $${params.length}
           OR cp.caracteristica_2 ILIKE $${params.length}
           OR ta.nombre ILIKE $${params.length}
           OR s.nombre  ILIKE $${params.length}
           OR CAST(cp.ancho AS TEXT) ILIKE $${params.length}
           OR CAST(cp.alto  AS TEXT) ILIKE $${params.length})`;
  }
  q += ` ORDER BY cp.tipo, cp.nombre`;

  const { rows } = await db.query(q, params);
  return c.json(rows);
});

export default catalogo;
