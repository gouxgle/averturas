import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { OperacionSchema, EstadoOperacionSchema, VentaRapidaSchema } from '../lib/schemas.js';

const operaciones = new Hono();

// MAX del sufijo numérico (no COUNT): un borrado previo deja huecos y COUNT(*) + 1
// puede repetir un número ya usado, violando el UNIQUE de numero.
async function nextNumeroRecibo(): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(SUBSTRING(numero FROM '(\\d+)$')::int), 0) AS n FROM recibos WHERE numero LIKE $1`,
    [`REC-${ym}-%`]
  );
  const n = Number((rows[0] as { n: number }).n) + 1;
  return `REC-${ym}-${String(n).padStart(4, '0')}`;
}

async function nextNumeroRemito(): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(SUBSTRING(numero FROM '(\\d+)$')::int), 0) AS n FROM remitos WHERE numero LIKE $1`,
    [`R-${ym}-%`]
  );
  const n = Number((rows[0] as { n: number }).n) + 1;
  return `R-${ym}-${String(n).padStart(4, '0')}`;
}

// ── Venta rápida de mostrador ────────────────────────────────────────────
// Crea operación (ya aprobada) + recibo (emitido) + remito (emitido/entregado) + descuento
// de stock, todo en una sola transacción. Debe ir ANTES de GET /:id.
operaciones.post('/venta-rapida', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, VentaRapidaSchema);
  if (b instanceof Response) return b;

  // Validar stock suficiente por ítem antes de tocar nada
  for (const item of b.items) {
    const { rows: [prod] } = await db.query(`
      SELECT cp.nombre,
        (COALESCE(cp.stock_inicial, 0) + COALESCE((
          SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
        ), 0))::int AS stock_actual
      FROM catalogo_productos cp WHERE cp.id = $1
    `, [item.producto_id]);
    if (!prod) return c.json({ error: `Producto no encontrado: ${item.descripcion}` }, 404);
    if (prod.stock_actual < item.cantidad) {
      return c.json({
        error: `Stock insuficiente para "${prod.nombre}": disponible ${prod.stock_actual}, pedido ${item.cantidad}`
      }, 422);
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Operación — venta directa, ya aprobada (sin negociación previa)
    const { rows: [op] } = await client.query(`
      INSERT INTO operaciones (tipo, estado, cliente_id, vendedor_id, created_by, forma_pago, forma_envio, notas, es_venta_rapida)
      VALUES ('estandar','aprobado',$1,$2,$3,$4,'retiro_local','Venta rápida de mostrador',true)
      RETURNING *
    `, [b.cliente_id, user.id, user.id, b.forma_pago]);

    // 2. Ítems de la operación
    for (const [idx, item] of b.items.entries()) {
      await client.query(`
        INSERT INTO operacion_items (operacion_id, orden, producto_id, descripcion, cantidad, precio_unitario)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [op.id, idx, item.producto_id, item.descripcion, item.cantidad, item.precio_unitario]);
    }

    // El trigger recalcular_totales_operacion ya completó operaciones.precio_total
    const { rows: [{ precio_total }] } = await client.query(
      `SELECT precio_total FROM operaciones WHERE id=$1`, [op.id]
    );
    const montoProductos = Number(precio_total);

    // 3. Bonificación — igual que NuevoRecibo.tsx: solo sobre el subtotal de productos
    const montoDescuento = b.descuento_pct > 0
      ? Math.round(montoProductos * (b.descuento_pct / 100) * 100) / 100
      : Number(b.monto_descuento ?? 0);
    const montoFinal = montoProductos - montoDescuento;

    // 4. Recibo (emitido por default de columna)
    const numeroRecibo = await nextNumeroRecibo();
    const { rows: [recibo] } = await client.query(`
      INSERT INTO recibos
        (numero, cliente_id, operacion_id, monto_total, forma_pago, concepto,
         descuento_pct, monto_lista, monto_descuento, created_by)
      VALUES ($1,$2,$3,$4,$5,'Venta rápida de mostrador',$6,$7,$8,$9)
      RETURNING *
    `, [numeroRecibo, b.cliente_id, op.id, montoFinal, b.forma_pago, b.descuento_pct, montoProductos, montoDescuento, user.id]);

    for (const [idx, item] of b.items.entries()) {
      await client.query(`
        INSERT INTO recibo_items (recibo_id, descripcion, producto_id, cantidad, monto, orden)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [recibo.id, item.descripcion, item.producto_id, item.cantidad, item.precio_unitario * item.cantidad, idx]);
    }

    // 5. Remito — nace 'borrador' por diseño de columna
    const numeroRemito = await nextNumeroRemito();
    const { rows: [remito] } = await client.query(`
      INSERT INTO remitos (numero, cliente_id, operacion_id, medio_envio, notas, created_by)
      VALUES ($1,$2,$3,'retiro_local','Venta rápida de mostrador',$4)
      RETURNING *
    `, [numeroRemito, b.cliente_id, op.id, user.id]);

    for (const item of b.items) {
      await client.query(`
        INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad, precio_unitario, estado_producto)
        VALUES ($1,$2,$3,$4,$5,'nuevo')
      `, [remito.id, item.producto_id, item.descripcion, item.cantidad, item.precio_unitario]);
    }

    // 6. borrador → emitido: descuenta stock (mismo patrón que remitos.ts PATCH /:id/estado)
    for (const item of b.items) {
      await client.query(`
        INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
        VALUES ($1,'egreso_remito',$2,'Venta rápida de mostrador',$3,$4,$5)
      `, [item.producto_id, -Math.abs(item.cantidad), op.id, numeroRemito, user.id]);
    }
    await client.query(`UPDATE remitos SET estado='emitido', stock_descontado=true WHERE id=$1`, [remito.id]);

    // Si el stock de algún producto quedó en 0, ya no puede seguir "exhibido en salón"
    await client.query(`
      UPDATE catalogo_productos cp SET en_salon = false
      WHERE cp.id = ANY($1::uuid[]) AND cp.en_salon = true
        AND (COALESCE(cp.stock_inicial,0) + COALESCE((
          SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
        ), 0)) <= 0
    `, [b.items.map(i => i.producto_id)]);

    // 7. Si el cliente retira ahora: emitido → entregado, y la operación queda cerrada
    let estadoRemitoFinal = 'emitido';
    if (b.retira) {
      await client.query(`
        UPDATE remitos SET estado='entregado', fecha_entrega_real=CURRENT_DATE, recepcion_estado='conforme'
        WHERE id=$1
      `, [remito.id]);
      await client.query(`UPDATE operaciones SET estado='entregado', updated_at=now() WHERE id=$1`, [op.id]);
      estadoRemitoFinal = 'entregado';
    }

    await client.query('COMMIT');
    return c.json({
      operacion_id: op.id, numero_operacion: op.numero,
      recibo_id: recibo.id, numero_recibo: recibo.numero,
      remito_id: remito.id, numero_remito: remito.numero,
      estado_remito: estadoRemitoFinal,
    }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── Upload del cálculo del software externo (por abertura a medida) ────
// Debe ir ANTES de GET /:id — Hono matchea en orden de registro
operaciones.post('/upload-calculo', async (c) => {
  const body = await c.req.formData();
  const file = body.get('calculo') as File | null;
  if (!file || !file.size) return c.json({ error: 'No se recibió imagen' }, 400);

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) return c.json({ error: 'Formato no permitido' }, 400);

  const filename = `${randomUUID()}.webp`;
  const dir = './uploads/calculos';
  await mkdir(dir, { recursive: true });

  const optimizado = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  await writeFile(`${dir}/${filename}`, optimizado);

  return c.json({ url: `/uploads/calculos/${filename}` });
});

operaciones.get('/', async (c) => {
  const estado     = c.req.query('estado');
  const estados    = c.req.query('estados');    // comma-separated
  const search     = c.req.query('search')     ?? '';
  const cliente_id = c.req.query('cliente_id') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (estados) {
    const list = estados.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) {
      params.push(list);
      where += ` AND o.estado = ANY($${params.length}::estado_operacion[])`;
    }
  } else if (estado && estado !== 'todos') {
    params.push(estado);
    where += ` AND o.estado = $${params.length}`;
  }

  if (search.trim()) {
    params.push(`%${search}%`);
    where += ` AND o.numero ILIKE $${params.length}`;
  }

  if (cliente_id) {
    params.push(cliente_id);
    where += ` AND o.cliente_id = $${params.length}`;
  }

  // Excluir operaciones que ya tienen un remito activo (no cancelado)
  const sinRemito = c.req.query('sin_remito') === '1';
  if (sinRemito) {
    where += ` AND NOT EXISTS (
      SELECT 1 FROM remitos r
      WHERE r.operacion_id = o.id AND r.estado NOT IN ('cancelado')
    )`;
  }

  const { rows } = await db.query(`
    SELECT o.*,
      COALESCE((
        SELECT SUM(r.monto_total) FROM recibos r
        WHERE r.operacion_id = o.id AND r.estado = 'emitido'
      ), 0)::numeric AS cobrado_total,
      json_build_object(
        'id', c.id, 'nombre', c.nombre,
        'apellido', c.apellido, 'telefono', c.telefono
      ) AS cliente
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT 100
  `, params);

  return c.json(rows);
});

operaciones.get('/tablero', async (c) => {
  const lunes = new Date();
  const dow = lunes.getDay() === 0 ? 6 : lunes.getDay() - 1;
  lunes.setDate(lunes.getDate() - dow);
  lunes.setHours(0, 0, 0, 0);

  const baseSelect = `
    SELECT o.id, o.numero, o.estado, o.tipo, o.precio_total::numeric,
      o.created_at, o.fecha_entrega_estimada, o.fecha_validez, o.updated_at,
      EXTRACT(DAY FROM now() - o.updated_at)::int AS dias_en_estado,
      COALESCE((
        SELECT SUM(r2.monto_total) FROM recibos r2
        WHERE r2.operacion_id = o.id AND r2.estado = 'emitido'
      ), 0)::numeric AS cobrado_total,
      json_build_object(
        'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
        'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
        'telefono', c.telefono
      ) AS cliente,
      (SELECT oi.descripcion FROM operacion_items oi
       WHERE oi.operacion_id = o.id ORDER BY oi.orden LIMIT 1) AS primer_item,
      (SELECT p.fecha_entrega_est FROM pedidos p
       WHERE p.operacion_id = o.id AND p.estado NOT IN ('cancelado', 'recibido')
       ORDER BY p.created_at DESC LIMIT 1) AS pedido_fecha_entrega_est
    FROM operaciones o
    JOIN clientes c ON c.id = o.cliente_id
  `;

  const [
    statsRow, sinConfirmar, confirmadas, conPedido,
    listasEntregar, entregadas, canceladas, proximasRows,
  ] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado NOT IN ('entregado','cancelado','rechazado'))::int AS total_activas,
        COALESCE(SUM(precio_total) FILTER (WHERE estado NOT IN ('entregado','cancelado','rechazado')), 0)::numeric AS valor_activas,
        COUNT(*) FILTER (WHERE estado IN ('presupuesto','enviado'))::int AS sin_confirmar,
        COUNT(*) FILTER (WHERE estado = 'entregado' AND updated_at >= $1)::int AS entregadas_semana,
        COALESCE(SUM(precio_total) FILTER (WHERE estado = 'entregado' AND updated_at >= $1), 0)::numeric AS valor_entregadas_semana
      FROM operaciones
    `, [lunes.toISOString()]),

    // 1. Sin confirmar: presupuestos enviados o en borrador
    db.query(`${baseSelect}
      WHERE o.estado IN ('presupuesto', 'enviado')
      ORDER BY o.created_at DESC LIMIT 50`),

    // 2. Confirmadas: aprobadas sin pedido activo al proveedor
    db.query(`${baseSelect}
      WHERE o.estado = 'aprobado'
        AND NOT EXISTS (
          SELECT 1 FROM pedidos p WHERE p.operacion_id = o.id AND p.estado != 'cancelado'
        )
      ORDER BY o.created_at DESC LIMIT 50`),

    // 3. Con pedido al proveedor: tiene al menos un pedido activo no recibido
    db.query(`${baseSelect}
      WHERE o.estado NOT IN ('cancelado', 'rechazado', 'presupuesto', 'enviado')
        AND EXISTS (
          SELECT 1 FROM pedidos p
          WHERE p.operacion_id = o.id AND p.estado NOT IN ('cancelado', 'recibido')
        )
      ORDER BY o.created_at DESC LIMIT 50`),

    // 4. Lista p/ entregar: todos los pedidos activos fueron recibidos, sin remito activo
    db.query(`${baseSelect}
      WHERE o.estado NOT IN ('cancelado', 'rechazado', 'entregado')
        AND EXISTS (
          SELECT 1 FROM pedidos p WHERE p.operacion_id = o.id AND p.estado = 'recibido'
        )
        AND NOT EXISTS (
          SELECT 1 FROM pedidos p WHERE p.operacion_id = o.id AND p.estado NOT IN ('cancelado', 'recibido')
        )
        AND NOT EXISTS (
          SELECT 1 FROM remitos r WHERE r.operacion_id = o.id AND r.estado != 'cancelado'
        )
      ORDER BY o.created_at DESC LIMIT 50`),

    // 5. Entregadas: estado entregado O tiene remito activo
    db.query(`${baseSelect}
      WHERE o.estado NOT IN ('cancelado', 'rechazado')
        AND (
          o.estado = 'entregado'
          OR EXISTS (SELECT 1 FROM remitos r WHERE r.operacion_id = o.id AND r.estado != 'cancelado')
        )
      ORDER BY o.updated_at DESC LIMIT 50`),

    // 6. Canceladas
    db.query(`${baseSelect}
      WHERE o.estado IN ('cancelado', 'rechazado')
      ORDER BY o.updated_at DESC LIMIT 30`),

    db.query(`
      SELECT o.id, o.numero, o.precio_total::numeric, o.estado, o.fecha_entrega_estimada,
        json_build_object('nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado NOT IN ('entregado','cancelado')
        AND o.fecha_entrega_estimada IS NOT NULL
        AND o.fecha_entrega_estimada >= CURRENT_DATE
        AND o.fecha_entrega_estimada <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY o.fecha_entrega_estimada ASC
      LIMIT 20
    `),
  ]);

  const s = statsRow.rows[0];
  const parseOps = (rows: any[]) => rows.map(o => ({
    ...o,
    precio_total:  parseFloat(o.precio_total),
    cobrado_total: parseFloat(o.cobrado_total),
  }));

  return c.json({
    stats: {
      total_activas:           s.total_activas,
      valor_activas:           parseFloat(s.valor_activas),
      sin_confirmar:           s.sin_confirmar,
      entregadas_semana:       s.entregadas_semana,
      valor_entregadas_semana: parseFloat(s.valor_entregadas_semana),
    },
    kanban: {
      sin_confirmar:   parseOps(sinConfirmar.rows),
      confirmadas:     parseOps(confirmadas.rows),
      con_pedido:      parseOps(conPedido.rows),
      listas_entregar: parseOps(listasEntregar.rows),
      entregadas:      parseOps(entregadas.rows),
      canceladas:      parseOps(canceladas.rows),
    },
    proximas: proximasRows.rows.map(r => ({ ...r, precio_total: parseFloat(r.precio_total) })),
  });
});

operaciones.get('/ventas-panel', async (c) => {
  const [statsRow, listRows, seguimientoRows] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE o.estado IN ('presupuesto','enviado'))::int AS total_activos,
        COALESCE(SUM(o.precio_total) FILTER (WHERE o.estado IN ('presupuesto','enviado')), 0)::numeric AS importe_total,
        COUNT(*) FILTER (
          WHERE o.estado = 'enviado'
            AND COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 3
        )::int AS sin_respuesta_count,
        COALESCE(SUM(o.precio_total) FILTER (
          WHERE o.estado = 'enviado'
            AND COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 3
        ), 0)::numeric AS sin_respuesta_monto,
        COUNT(*) FILTER (
          WHERE o.estado IN ('presupuesto','enviado') AND o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE
        )::int AS vencidos_count,
        COALESCE(SUM(o.precio_total) FILTER (
          WHERE o.estado IN ('presupuesto','enviado') AND o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE
        ), 0)::numeric AS vencidos_monto,
        COALESCE(ROUND(
          100.0 * COUNT(*) FILTER (WHERE o.estado = 'aprobado' AND o.created_at >= now() - INTERVAL '30 days') /
          NULLIF(COUNT(*) FILTER (WHERE o.estado IN ('aprobado','cancelado','rechazado') AND o.created_at >= now() - INTERVAL '30 days'), 0)
        , 0), 0)::int AS tasa_cierre_pct
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
    `),

    db.query(`
      SELECT
        o.id, o.numero, o.tipo, o.estado, o.precio_total::numeric,
        o.created_at, o.fecha_validez, o.aprobado_online_at, o.motivo_rechazo,
        (o.token_acceso IS NOT NULL) AS link_enviado,
        o.enviado_wa_at,
        o.respuesta_cliente, o.respuesta_cliente_at,
        (o.enviado_wa_at IS NULL AND o.estado IN ('presupuesto','enviado')) AS pendiente_envio,
        EXTRACT(DAY FROM now() - o.fecha_validez)::int                         AS dias_vencido,
        EXTRACT(DAY FROM o.fecha_validez - now())::int                         AS dias_hasta_vencimiento,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999)::int     AS dias_sin_respuesta,
        (SELECT i.tipo FROM interacciones i WHERE i.cliente_id = c.id ORDER BY i.created_at DESC LIMIT 1) AS ultimo_contacto_canal,
        json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono, 'email', c.email
        ) AS cliente,
        CASE
          WHEN o.estado IN ('aprobado','cancelado','rechazado') THEN 'baja'
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE THEN 'alta'
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez <= CURRENT_DATE + 3 THEN 'alta'
          WHEN COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 7 THEN 'alta'
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez <= CURRENT_DATE + 7 THEN 'media'
          WHEN COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 3 THEN 'media'
          ELSE 'baja'
        END AS prioridad,
        cob.cobrado_total,
        CASE
          WHEN o.estado NOT IN ('aprobado','en_produccion','listo','instalado','entregado') THEN NULL
          WHEN cob.cobrado_total < 0.01 THEN 'sin_cobrar'
          WHEN cob.cobrado_total + cob.descuentos_total >= o.precio_total - 0.01 THEN 'cobrado'
          ELSE 'seña'
        END AS estado_cobro,
        COALESCE(ped.tiene_pedido, false) AS tiene_pedido,
        ped.pedido_estado,
        (SELECT COUNT(*)::int FROM operacion_items oi WHERE oi.operacion_id = o.id) AS items_total,
        (SELECT COUNT(*)::int FROM operacion_items oi
         WHERE oi.operacion_id = o.id
           AND EXISTS (
             SELECT 1 FROM pedido_items pi JOIN pedidos p2 ON p2.id = pi.pedido_id
             WHERE pi.operacion_item_id = oi.id AND p2.estado != 'cancelado'
           )
        ) AS items_en_pedido
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(r.monto_total),    0)::numeric AS cobrado_total,
          COALESCE(SUM(r.monto_descuento),0)::numeric AS descuentos_total
        FROM recibos r WHERE r.operacion_id = o.id AND r.estado = 'emitido'
      ) cob ON true
      LEFT JOIN LATERAL (
        SELECT
          (COUNT(*) > 0) AS tiene_pedido,
          (SELECT p2.estado FROM pedidos p2 WHERE p2.operacion_id = o.id AND p2.estado != 'cancelado' ORDER BY p2.created_at DESC LIMIT 1) AS pedido_estado
        FROM pedidos p WHERE p.operacion_id = o.id AND p.estado != 'cancelado'
      ) ped ON true
      WHERE o.estado IN ('presupuesto','enviado','aprobado','cancelado','rechazado')
      ORDER BY
        CASE WHEN o.estado IN ('presupuesto','enviado') THEN 0 ELSE 1 END,
        CASE
          WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE THEN 0
          WHEN COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 7 THEN 1
          ELSE 2
        END,
        o.precio_total DESC
      LIMIT 200
    `),

    db.query(`
      SELECT
        o.id, o.numero, o.precio_total::numeric, o.estado, o.fecha_validez,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999)::int AS dias_sin_respuesta,
        (SELECT i.tipo FROM interacciones i WHERE i.cliente_id = c.id ORDER BY i.created_at DESC LIMIT 1) AS ultimo_contacto_canal,
        json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono
        ) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado IN ('presupuesto','enviado')
        AND COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) > 2
      ORDER BY
        CASE WHEN o.fecha_validez IS NOT NULL AND o.fecha_validez < CURRENT_DATE THEN 0 ELSE 1 END,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) DESC,
        o.precio_total DESC
      LIMIT 5
    `),
  ]);

  const s = statsRow.rows[0];
  const lista = listRows.rows;
  const sinRespuestaMonto = parseFloat(s.sin_respuesta_monto);
  const vencidosMonto     = parseFloat(s.vencidos_monto);

  const activos  = lista.filter(r => ['presupuesto','enviado'].includes(r.estado));
  const probAlta = activos.filter(r => r.prioridad === 'baja').length;
  const probMedia = activos.filter(r => r.prioridad === 'media').length;
  const probBaja  = activos.filter(r => r.prioridad === 'alta').length;

  return c.json({
    stats: {
      total_activos:       s.total_activos,
      importe_total:       parseFloat(s.importe_total),
      sin_respuesta_count: s.sin_respuesta_count,
      sin_respuesta_monto: sinRespuestaMonto,
      vencidos_count:      s.vencidos_count,
      vencidos_monto:      vencidosMonto,
      tasa_cierre_pct:     s.tasa_cierre_pct,
      en_riesgo_total:     sinRespuestaMonto + vencidosMonto,
    },
    presupuestos: lista.map(r => ({ ...r, precio_total: parseFloat(r.precio_total) })),
    seguimiento_sugerido: seguimientoRows.rows.map(r => ({ ...r, precio_total: parseFloat(r.precio_total) })),
    prob_cierre: { alta: probAlta, media: probMedia, baja: probBaja },
  });
});

// POST /:id/generar-link — crea o regenera token de aprobación pública
operaciones.post('/:id/generar-link', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const { rows: [op] } = await db.query(
    `SELECT id, numero, cliente_id, estado FROM operaciones WHERE id = $1`, [id]
  );
  if (!op) return c.json({ error: 'No encontrado' }, 404);

  // Generar token UUID (crypto.randomUUID disponible en Node 19+, fallback manual)
  const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  // Si estaba rechazado, reabrirlo como "enviado" para que el cliente pueda volver a aprobar
  const estadoNuevo = op.estado === 'rechazado' ? 'enviado' : op.estado;
  // Reenviar la proforma cierra cualquier respuesta intermedia pendiente (ej. "pidió modificar")
  await db.query(
    `UPDATE operaciones SET token_acceso = $1, token_acceso_at = now(), estado = $2,
       respuesta_cliente = NULL, respuesta_cliente_at = NULL
     WHERE id = $3`,
    [token, estadoNuevo, id]
  );

  // Interacción CRM automática
  const proformaNumero = (op.numero as string).replace(/^OP-/, 'PRO-');
  db.query(
    `INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by)
     VALUES ($1, 'proforma_enviada', $2, $3)`,
    [op.cliente_id, `Proforma ${proformaNumero} enviada por link de aprobación`, user?.id ?? null]
  ).catch(err => console.error('[crm] Error al registrar interacción:', err));

  if (!process.env.APP_URL) {
    console.error('[config] APP_URL no configurada — el link público puede no funcionar');
  }
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return c.json({ token, url: `${appUrl}/p/${token}` });
});

// POST /:id/enviar-whatsapp — genera token y envía mensaje via Evolution API
operaciones.post('/:id/enviar-whatsapp', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const { rows: [op] } = await db.query(
    `SELECT o.id, o.numero, o.cliente_id, o.estado, o.fecha_validez,
       cl.nombre, cl.apellido, cl.razon_social, cl.tipo_persona, cl.telefono
     FROM operaciones o
     JOIN clientes cl ON cl.id = o.cliente_id
     WHERE o.id = $1`,
    [id]
  );
  if (!op) return c.json({ error: 'No encontrado' }, 404);

  const telefono: string | null = op.telefono;
  if (!telefono) return c.json({ error: 'El cliente no tiene teléfono registrado' }, 422);

  // Normalizar a formato Evolution API: 549XXXXXXXXXX (Argentina)
  const digits = telefono.replace(/\D/g, '');
  let numero: string;
  if (digits.startsWith('549') && digits.length >= 13) {
    numero = digits;
  } else if (digits.startsWith('54') && digits.length >= 12) {
    numero = `549${digits.slice(2)}`;
  } else if (digits.startsWith('0') && digits.length >= 11) {
    numero = `549${digits.slice(1)}`;
  } else {
    numero = `549${digits}`;
  }

  // Generar/regenerar token
  const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  // Si estaba rechazado, reabrirlo como "enviado" para que el cliente pueda volver a aprobar
  const estadoNuevo = op.estado === 'rechazado' ? 'enviado' : op.estado;
  // Reenviar la proforma cierra cualquier respuesta intermedia pendiente (ej. "pidió modificar")
  await db.query(
    `UPDATE operaciones SET token_acceso = $1, token_acceso_at = now(), estado = $2,
       respuesta_cliente = NULL, respuesta_cliente_at = NULL
     WHERE id = $3`,
    [token, estadoNuevo, id]
  );

  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const url = `${appUrl}/p/${token}`;

  const nombre = op.tipo_persona === 'juridica'
    ? (op.razon_social ?? 'estimado/a')
    : `${op.nombre ?? ''} ${op.apellido ?? ''}`.trim() || 'estimado/a';

  const proformaNumero = (op.numero as string).replace(/^OP-/, 'PRO-');

  // Leer plantilla de DB
  const { rows: [tpl] } = await db.query(
    `SELECT contenido FROM mensajes_plantilla WHERE clave = 'presupuesto_aprobacion'`
  );
  const mensaje = tpl?.contenido
    ? tpl.contenido
        .replace(/\{\{nombre\}\}/g, nombre)
        .replace(/\{\{numero\}\}/g, proformaNumero)
        .replace(/\{\{url\}\}/g, url)
    : `Hola ${nombre}, te enviamos el presupuesto *${proformaNumero}* para tu revisión.\n\nPodés aprobarlo desde este enlace:\n${url}`;

  // Enviar via Evolution API
  const evoUrl = process.env.EVOLUTION_API_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  const evoInst = process.env.EVOLUTION_INSTANCE;

  if (!evoUrl || !evoKey || !evoInst) {
    return c.json({ error: 'Evolution API no configurada (faltan env vars)' }, 500);
  }

  const resp = await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    body: JSON.stringify({ number: numero, text: mensaje }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error('[whatsapp] Evolution API error:', resp.status, errBody);

    try {
      const errJson = JSON.parse(errBody);
      const msgs: Array<{ exists?: boolean; number?: string }> = errJson?.response?.message ?? [];
      const noExiste = msgs.find(m => m.exists === false);
      if (noExiste) {
        return c.json({
          error: `El número ${noExiste.number ?? numero} no está registrado en WhatsApp. Verificá el número en la ficha del cliente.`
        }, 422);
      }
    } catch { /* no JSON */ }

    return c.json({ error: `Error al enviar WhatsApp (${resp.status})` }, 502);
  }

  // Interacción CRM
  db.query(
    `INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by)
     VALUES ($1, 'proforma_enviada', $2, $3)`,
    [op.cliente_id, `Proforma ${proformaNumero} enviada por WhatsApp (${numero})`, user?.id ?? null]
  ).catch(err => console.error('[crm] Error al registrar interacción:', err));

  await db.query(`UPDATE operaciones SET enviado_wa_at = now() WHERE id = $1`, [id]);

  return c.json({ enviado: true, numero, url });
});

// POST /:id/avisar-cliente — avisa al cliente que su operación está lista para entrega
operaciones.post('/:id/avisar-cliente', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const { rows: [op] } = await db.query(
    `SELECT o.id, o.numero, o.cliente_id, o.estado,
       cl.nombre, cl.apellido, cl.razon_social, cl.tipo_persona, cl.telefono
     FROM operaciones o
     JOIN clientes cl ON cl.id = o.cliente_id
     WHERE o.id = $1`,
    [id]
  );
  if (!op) return c.json({ error: 'No encontrado' }, 404);

  const telefono: string | null = op.telefono;
  if (!telefono) return c.json({ error: 'El cliente no tiene teléfono registrado' }, 422);

  const digits = telefono.replace(/\D/g, '');
  let numero: string;
  if (digits.startsWith('549') && digits.length >= 13) numero = digits;
  else if (digits.startsWith('54') && digits.length >= 12) numero = `549${digits.slice(2)}`;
  else if (digits.startsWith('0') && digits.length >= 11) numero = `549${digits.slice(1)}`;
  else numero = `549${digits}`;

  const nombre = op.tipo_persona === 'juridica'
    ? (op.razon_social ?? 'estimado/a')
    : `${op.nombre ?? ''} ${op.apellido ?? ''}`.trim() || 'estimado/a';

  const { rows: [tpl] } = await db.query(
    `SELECT contenido FROM mensajes_plantilla WHERE clave = 'operacion_lista_entrega'`
  );
  const mensaje = tpl?.contenido
    ? tpl.contenido
        .replace(/\{\{nombre\}\}/g, nombre)
        .replace(/\{\{numero_op\}\}/g, op.numero)
    : `Hola ${nombre}! Tu pedido *${op.numero}* ya está listo para la entrega.\n\nNos comunicamos para coordinar. ¡Gracias! 🏠`;

  const evoUrl  = process.env.EVOLUTION_API_URL;
  const evoKey  = process.env.EVOLUTION_API_KEY;
  const evoInst = process.env.EVOLUTION_INSTANCE;
  if (!evoUrl || !evoKey || !evoInst)
    return c.json({ error: 'Evolution API no configurada (faltan env vars)' }, 500);

  const resp = await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    body: JSON.stringify({ number: numero, text: mensaje }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[whatsapp-aviso-entrega] Evolution API error:', resp.status, errText);
    try {
      const errJson = JSON.parse(errText);
      const msgs: Array<{ exists?: boolean; number?: string }> = errJson?.response?.message ?? [];
      const noExiste = msgs.find(m => m.exists === false);
      if (noExiste)
        return c.json({ error: `El número ${noExiste.number ?? numero} no está en WhatsApp. Verificá la ficha del cliente.` }, 422);
    } catch { /* no JSON */ }
    return c.json({ error: `Error al enviar WhatsApp (${resp.status})` }, 502);
  }

  db.query(
    `INSERT INTO interacciones (cliente_id, tipo, descripcion, created_by)
     VALUES ($1, 'whatsapp', $2, $3)`,
    [op.cliente_id, `Aviso de operación lista para entrega (${op.numero}) enviado por WhatsApp`, user?.id ?? null]
  ).catch(err => console.error('[crm] interaccion aviso-entrega:', err));

  return c.json({ enviado: true, numero });
});

// PATCH /:id/resolver-respuesta — cierra manualmente una respuesta intermedia del cliente
// (ej. ya lo llamaron, ya se respondió la consulta) sin necesidad de reenviar la proforma
operaciones.patch('/:id/resolver-respuesta', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const { rows: [op] } = await db.query(
    `SELECT id, cliente_id, numero, respuesta_cliente FROM operaciones WHERE id = $1`, [id]
  );
  if (!op) return c.json({ error: 'No encontrado' }, 404);
  if (!op.respuesta_cliente) return c.json({ error: 'Esta operación no tiene una respuesta pendiente' }, 400);

  await db.query(
    `UPDATE operaciones SET respuesta_cliente = NULL, respuesta_cliente_at = NULL WHERE id = $1`,
    [id]
  );

  const proformaNumero = (op.numero as string).replace(/^OP-/, 'PRO-');
  db.query(
    `INSERT INTO interacciones (cliente_id, operacion_id, tipo, descripcion, created_by)
     VALUES ($1, $2, 'seguimiento_resuelto', $3, $4)`,
    [op.cliente_id, op.id, `Seguimiento resuelto manualmente — Proforma ${proformaNumero}`, user?.id ?? null]
  ).catch(err => console.error('[crm] Error al registrar interacción:', err));

  return c.json({ ok: true });
});

operaciones.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [{ rows: [op] }, { rows: items }, { rows: historial }] = await Promise.all([
    db.query(`
      SELECT o.*,
        COALESCE((
          SELECT SUM(r.monto_total) FROM recibos r
          WHERE r.operacion_id = o.id AND r.estado = 'emitido'
        ), 0)::numeric AS cobrado_total,
        COALESCE((
          SELECT SUM(r.monto_descuento) FROM recibos r
          WHERE r.operacion_id = o.id AND r.estado = 'emitido'
        ), 0)::numeric AS total_descuentos,
        (
          SELECT i.descripcion FROM interacciones i
          WHERE i.operacion_id = o.id AND i.tipo = 'respuesta_proforma'
          ORDER BY i.created_at DESC LIMIT 1
        ) AS respuesta_cliente_detalle,
        json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono, 'email', c.email,
          'direccion', c.direccion, 'localidad', c.localidad,
          'documento_nro', c.documento_nro
        ) AS cliente
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.id = $1
    `, [id]),
    db.query(`
      SELECT oi.*,
        oi.medida_ancho AS ancho,
        oi.medida_alto  AS alto,
        (oi.precio_unitario + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion ELSE 0 END) * oi.cantidad AS precio_total,
        ta.nombre AS tipo_abertura_nombre,
        s.nombre  AS sistema_nombre,
        cp.atributos    AS producto_atributos,
        cp.nombre       AS producto_nombre,
        cp.imagen_url   AS producto_imagen_url,
        cp.proveedor_sku AS producto_proveedor_sku,
        cp.costo_base   AS producto_costo_base,
        (
          SELECT json_build_object('pedido_id', p2.id, 'pedido_numero', p2.numero)
          FROM pedido_items pi2
          JOIN pedidos p2 ON p2.id = pi2.pedido_id
          WHERE pi2.operacion_item_id = oi.id
            AND p2.estado != 'cancelado'
          LIMIT 1
        ) AS covered_by,
        CASE WHEN cp.id IS NOT NULL THEN
          (COALESCE(cp.stock_inicial,0) + COALESCE((
            SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
          ),0))::int
          ELSE NULL END AS stock_actual
      FROM operacion_items oi
      LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
      LEFT JOIN sistemas s ON s.id = oi.sistema_id
      LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
      WHERE oi.operacion_id = $1
      ORDER BY oi.orden
    `, [id]),
    db.query(`
      SELECT * FROM estados_historial
      WHERE operacion_id = $1
      ORDER BY created_at DESC
    `, [id]),
  ]);

  if (!op) return c.json({ error: 'Operación no encontrada' }, 404);
  return c.json({ ...op, items, historial });
});

operaciones.post('/', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, OperacionSchema);
  if (b instanceof Response) return b;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [op] } = await client.query(`
      INSERT INTO operaciones
        (tipo, estado, cliente_id, vendedor_id, proveedor_id,
         incluye_instalacion, notas, notas_internas, fecha_validez, created_by,
         tipo_proyecto, forma_pago, tiempo_entrega, forma_envio, costo_envio)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      b.tipo ?? 'a_medida_proveedor',
      b.estado ?? 'presupuesto',
      b.cliente_id,
      user.id,
      b.proveedor_id || null,
      b.items?.some((i: any) => i.incluye_instalacion) ?? false,
      b.notas || null,
      b.notas_internas || null,
      b.fecha_validez || null,
      user.id,
      b.tipo_proyecto || null,
      b.forma_pago || null,
      b.tiempo_entrega ?? null,
      b.forma_envio ?? 'retiro_local',
      b.costo_envio ?? 0,
    ]);

    if (b.items?.length) {
      for (const [idx, item] of b.items.entries()) {
        await client.query(`
          INSERT INTO operacion_items
            (operacion_id, orden, tipo_abertura_id, sistema_id, descripcion,
             medida_ancho, medida_alto, cantidad, costo_unitario, precio_unitario,
             incluye_instalacion, costo_instalacion, precio_instalacion,
             vidrio, premarco, origen, color, accesorios, producto_id, calculo_url)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [
          op.id,
          idx,
          item.tipo_abertura_id || null,
          item.sistema_id || null,
          item.descripcion || '',
          item.medida_ancho ?? null,
          item.medida_alto  ?? null,
          item.cantidad ?? 1,
          item.costo_unitario ?? 0,
          item.precio_unitario ?? 0,
          item.incluye_instalacion ?? false,
          item.costo_instalacion ?? 0,
          item.precio_instalacion ?? 0,
          item.vidrio || null,
          item.premarco ?? false,
          item.origen || null,
          item.color || null,
          item.accesorios ?? [],
          item.producto_id || null,
          item.calculo_url || null,
        ]);
      }
    }

    if (b.visita_tecnica_id) {
      await client.query(`
        UPDATE visitas_tecnicas SET operacion_id=$1, estado='convertida', updated_at=now()
        WHERE id=$2 AND estado != 'convertida'
      `, [op.id, b.visita_tecnica_id]);
    }

    await client.query('COMMIT');
    return c.json(op, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

operaciones.put('/:id', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, OperacionSchema);
  if (b instanceof Response) return b;

  const { rows: [existing] } = await db.query(
    'SELECT estado FROM operaciones WHERE id=$1', [id]
  );
  if (!existing) return c.json({ error: 'No encontrada' }, 404);
  if (existing.estado === 'aprobado') {
    return c.json({ error: 'No se puede editar un presupuesto aprobado' }, 409);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [op] } = await client.query(`
      UPDATE operaciones SET
        tipo              = $1,
        tipo_proyecto     = $2,
        forma_pago        = $3,
        tiempo_entrega    = $4,
        notas             = $5,
        notas_internas    = $6,
        fecha_validez     = $7,
        forma_envio       = $8,
        costo_envio       = $9,
        incluye_instalacion = $10,
        updated_at        = now()
      WHERE id = $11
      RETURNING *
    `, [
      b.tipo ?? 'a_medida_proveedor',
      b.tipo_proyecto || null,
      b.forma_pago || null,
      b.tiempo_entrega ?? null,
      b.notas || null,
      b.notas_internas || null,
      b.fecha_validez || null,
      b.forma_envio ?? 'retiro_local',
      b.costo_envio ?? 0,
      b.items?.some((i: any) => i.incluye_instalacion) ?? false,
      id,
    ]);

    await client.query('DELETE FROM operacion_items WHERE operacion_id=$1', [id]);

    if (b.items?.length) {
      for (const [idx, item] of b.items.entries()) {
        await client.query(`
          INSERT INTO operacion_items
            (operacion_id, orden, tipo_abertura_id, sistema_id, descripcion,
             medida_ancho, medida_alto, cantidad, costo_unitario, precio_unitario,
             incluye_instalacion, costo_instalacion, precio_instalacion,
             vidrio, premarco, origen, color, accesorios, producto_id, calculo_url)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [
          id, idx,
          item.tipo_abertura_id || null,
          item.sistema_id || null,
          item.descripcion || '',
          item.medida_ancho ?? null,
          item.medida_alto  ?? null,
          item.cantidad ?? 1,
          item.costo_unitario ?? 0,
          item.precio_unitario ?? 0,
          item.incluye_instalacion ?? false,
          item.costo_instalacion ?? 0,
          item.precio_instalacion ?? 0,
          item.vidrio || null,
          item.premarco ?? false,
          item.origen || null,
          item.color || null,
          item.accesorios ?? [],
          item.producto_id || null,
          item.calculo_url || null,
        ]);
      }
    }

    await client.query('COMMIT');
    return c.json(op);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

operaciones.patch('/:id/estado', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, EstadoOperacionSchema);
  if (b instanceof Response) return b;
  const { estado } = b;

  const estadosValidos = ['presupuesto', 'enviado', 'aprobado', 'en_produccion', 'listo', 'instalado', 'entregado', 'cancelado', 'rechazado'];
  if (!estadosValidos.includes(estado)) {
    return c.json({ error: 'Estado inválido' }, 400);
  }

  const { rows: [row] } = await db.query(`
    UPDATE operaciones SET estado = $1 WHERE id = $2
    RETURNING id, numero, estado
  `, [estado, id]);

  if (!row) return c.json({ error: 'Operación no encontrada' }, 404);
  return c.json(row);
});

export default operaciones;
