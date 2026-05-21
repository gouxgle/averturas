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

// GET /proveedores/tablero — panel de gestión con métricas de compras
catalogo.get('/proveedores/tablero', async (c) => {
  const [provResult, comprasResult, rubroResult, movResult] = await Promise.all([
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
  ]);

  const comprasMap = new Map((comprasResult.rows as any[]).map(r => [r.proveedor_id, r]));

  const proveedores = (provResult.rows as any[]).map(p => {
    const c = comprasMap.get(p.id) as any;
    const diasSinCompra = c?.ultima_compra_fecha
      ? Math.floor((Date.now() - new Date(c.ultima_compra_fecha).getTime()) / 86400000)
      : 999;
    return {
      ...p,
      lotes_count_6m:     c?.lotes_count_6m    ?? 0,
      compras_monto_6m:   Number(c?.compras_monto_6m  ?? 0),
      lotes_count_30d:    c?.lotes_count_30d   ?? 0,
      ultima_compra_fecha: c?.ultima_compra_fecha ?? null,
      dias_sin_compra:    diasSinCompra,
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
  const b = await c.req.json();
  if (!b.nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(
    `INSERT INTO proveedores
       (nombre, tipo, contacto, telefono, email, cuit, direccion, localidad, provincia,
        web, materiales, notas, forma_entrega, plazo_entrega_dias, costo_flete,
        calificacion, deuda_actual, es_principal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      b.nombre.trim(), b.tipo || null, b.contacto || null, b.telefono || null,
      b.email || null, b.cuit || null, b.direccion || null, b.localidad || null,
      b.provincia || null, b.web || null,
      Array.isArray(b.materiales) ? b.materiales : [],
      b.notas || null,
      b.forma_entrega  || 'propia',
      b.plazo_entrega_dias ? parseInt(b.plazo_entrega_dias) : null,
      b.costo_flete    ? parseFloat(b.costo_flete)    : 0,
      b.calificacion   ? parseInt(b.calificacion)     : null,
      b.deuda_actual   ? parseFloat(b.deuda_actual)   : 0,
      b.es_principal   ?? false,
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
  const b = await c.req.json();
  const { rows } = await db.query(
    `UPDATE proveedores
     SET nombre=$1, tipo=$2, contacto=$3, telefono=$4, email=$5, cuit=$6,
         direccion=$7, localidad=$8, provincia=$9, web=$10, materiales=$11,
         notas=$12, activo=$13, forma_entrega=$14, plazo_entrega_dias=$15,
         costo_flete=$16, calificacion=$17, deuda_actual=$18, es_principal=$19
     WHERE id=$20 RETURNING *`,
    [
      b.nombre?.trim(), b.tipo || null, b.contacto || null, b.telefono || null,
      b.email || null, b.cuit || null, b.direccion || null, b.localidad || null,
      b.provincia || null, b.web || null,
      Array.isArray(b.materiales) ? b.materiales : [],
      b.notas || null, b.activo ?? true,
      b.forma_entrega  || 'propia',
      b.plazo_entrega_dias ? parseInt(b.plazo_entrega_dias) : null,
      b.costo_flete    ? parseFloat(b.costo_flete)    : 0,
      b.calificacion   ? parseInt(b.calificacion)     : null,
      b.deuda_actual   ? parseFloat(b.deuda_actual)   : 0,
      b.es_principal   ?? false,
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
      p.nombre AS proveedor_nombre
    FROM proveedor_precios pp
    JOIN proveedores p ON p.id = pp.proveedor_id
    ${where}
    ORDER BY pp.sku ASC
    LIMIT 500
  `, params);
  return c.json(rows);
});

// POST /proveedor-precios — upsert individual
catalogo.post('/proveedor-precios', async (c) => {
  const b = await c.req.json() as {
    proveedor_id: string; sku: string; descripcion: string; precio: number; activo?: boolean;
  };
  if (!b.proveedor_id || !b.sku?.trim() || !b.descripcion?.trim()) {
    return c.json({ error: 'proveedor_id, sku y descripcion son requeridos' }, 400);
  }
  const { rows: [row] } = await db.query(`
    INSERT INTO proveedor_precios (proveedor_id, sku, descripcion, precio, activo)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (proveedor_id, sku) DO UPDATE SET
      descripcion = EXCLUDED.descripcion,
      precio      = EXCLUDED.precio,
      activo      = EXCLUDED.activo,
      updated_at  = now()
    RETURNING *
  `, [b.proveedor_id, b.sku.trim(), b.descripcion.trim(), b.precio ?? 0, b.activo ?? true]);
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
  const b = await c.req.json() as { sku?: string; descripcion?: string; precio?: number; activo?: boolean };
  const { rows: [row] } = await db.query(`
    UPDATE proveedor_precios SET
      sku         = COALESCE($1, sku),
      descripcion = COALESCE($2, descripcion),
      precio      = COALESCE($3, precio),
      activo      = COALESCE($4, activo),
      updated_at  = now()
    WHERE id = $5
    RETURNING *
  `, [b.sku?.trim() ?? null, b.descripcion?.trim() ?? null, b.precio ?? null, b.activo ?? null, c.req.param('id')]);
  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json(row);
});

// DELETE /proveedor-precios/:id
catalogo.delete('/proveedor-precios/:id', async (c) => {
  await db.query(`DELETE FROM proveedor_precios WHERE id=$1`, [c.req.param('id')]);
  return c.json({ ok: true });
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
