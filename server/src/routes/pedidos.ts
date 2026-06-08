import { Hono } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { PedidoSchema, PedidoEstadoSchema } from '../lib/schemas.js';

const pedidos = new Hono();

async function nextNumero(): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS n FROM pedidos WHERE numero LIKE $1`,
    [`PED-${ym}-%`]
  );
  const n = parseInt((rows[0] as { n: string }).n) + 1;
  return `PED-${ym}-${String(n).padStart(4, '0')}`;
}

const WITH_PROVEEDOR = `
  SELECT p.*,
    json_build_object(
      'id', prov.id, 'nombre', prov.nombre, 'telefono', prov.telefono,
      'email', prov.email, 'contacto', prov.contacto
    ) AS proveedor,
    CASE WHEN o.id IS NOT NULL
      THEN json_build_object(
        'id', o.id, 'numero', o.numero, 'tipo', o.tipo,
        'precio_total', o.precio_total,
        'cliente', json_build_object(
          'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
          'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
          'telefono', c.telefono
        )
      )
      ELSE NULL END AS operacion
  FROM pedidos p
  JOIN  proveedores prov ON prov.id = p.proveedor_id
  LEFT JOIN operaciones o ON o.id = p.operacion_id
  LEFT JOIN clientes c ON c.id = o.cliente_id
`;

// GET /tablero
pedidos.get('/tablero', async (c) => {
  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  const [statsRow, listRows, esperandoRows, prepararRows] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'enviado')::int AS enviados,
        COUNT(*) FILTER (WHERE estado = 'recibido' AND updated_at >= $1)::int AS recibidos_semana,
        COALESCE(SUM(monto_total) FILTER (WHERE estado IN ('pendiente','enviado')), 0)::numeric AS valor_pendiente
      FROM pedidos
    `, [inicioSemana.toISOString()]),

    db.query(`
      SELECT p.id, p.numero, p.estado, p.fecha_pedido, p.fecha_entrega_est,
        p.fecha_recepcion, p.monto_total, p.notas,
        json_build_object(
          'id', prov.id, 'nombre', prov.nombre, 'telefono', prov.telefono
        ) AS proveedor,
        CASE WHEN o.id IS NOT NULL
          THEN json_build_object(
            'id', o.id, 'numero', o.numero,
            'cliente', json_build_object(
              'id', cl.id, 'nombre', cl.nombre, 'apellido', cl.apellido,
              'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona
            )
          )
          ELSE NULL END AS operacion,
        items_agg.items_resumen
      FROM pedidos p
      JOIN  proveedores prov ON prov.id = p.proveedor_id
      LEFT JOIN operaciones o  ON o.id = p.operacion_id
      LEFT JOIN clientes    cl ON cl.id = o.cliente_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object('descripcion', pi.descripcion, 'cantidad', pi.cantidad)
          ORDER BY pi.orden
        ) AS items_resumen
        FROM pedido_items pi WHERE pi.pedido_id = p.id
      ) items_agg ON true
      ORDER BY p.created_at DESC
      LIMIT 300
    `),

    db.query(`
      SELECT p.id, p.numero, p.fecha_entrega_est,
        json_build_object('nombre', prov.nombre, 'telefono', prov.telefono) AS proveedor,
        CASE WHEN o.id IS NOT NULL
          THEN json_build_object('numero', o.numero, 'cliente',
            json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
              'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona))
          ELSE NULL END AS operacion
      FROM pedidos p
      JOIN proveedores prov ON prov.id = p.proveedor_id
      LEFT JOIN operaciones o ON o.id = p.operacion_id
      LEFT JOIN clientes cl ON cl.id = o.cliente_id
      WHERE p.estado = 'enviado'
      ORDER BY p.fecha_entrega_est ASC NULLS LAST, p.created_at ASC
      LIMIT 10
    `),

    // Recibidos sin remito emitido para la misma operación
    db.query(`
      SELECT p.id, p.numero, p.fecha_recepcion,
        json_build_object('nombre', prov.nombre) AS proveedor,
        CASE WHEN o.id IS NOT NULL
          THEN json_build_object('id', o.id, 'numero', o.numero, 'cliente',
            json_build_object('nombre', cl.nombre, 'apellido', cl.apellido,
              'razon_social', cl.razon_social, 'tipo_persona', cl.tipo_persona,
              'telefono', cl.telefono))
          ELSE NULL END AS operacion
      FROM pedidos p
      JOIN proveedores prov ON prov.id = p.proveedor_id
      LEFT JOIN operaciones o ON o.id = p.operacion_id
      LEFT JOIN clientes cl ON cl.id = o.cliente_id
      WHERE p.estado = 'recibido'
        AND (
          p.operacion_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM remitos r
            WHERE r.operacion_id = p.operacion_id
              AND r.estado IN ('emitido','entregado')
          )
        )
      ORDER BY p.fecha_recepcion DESC NULLS LAST
      LIMIT 10
    `),
  ]);

  const s = statsRow.rows[0] as {
    pendientes: number; enviados: number;
    recibidos_semana: number; valor_pendiente: string;
  };

  return c.json({
    stats: {
      pendientes:       s.pendientes,
      enviados:         s.enviados,
      recibidos_semana: s.recibidos_semana,
      valor_pendiente:  parseFloat(s.valor_pendiente),
    },
    pedidos:          listRows.rows,
    esperando_recepcion: esperandoRows.rows,
    para_preparar:    prepararRows.rows,
  });
});

// GET /conteos
pedidos.get('/conteos', async (c) => {
  const { rows } = await db.query(`
    SELECT estado, COUNT(*)::int AS n FROM pedidos GROUP BY estado
  `);
  const conteos: Record<string, number> = {
    pendiente: 0, enviado: 0, recibido: 0, cancelado: 0,
  };
  for (const r of rows as { estado: string; n: number }[]) conteos[r.estado] = r.n;
  return c.json(conteos);
});

// GET / — lista con filtros
pedidos.get('/', async (c) => {
  const estado      = c.req.query('estado') ?? '';
  const proveedorId = c.req.query('proveedor_id') ?? '';
  const operacionId = c.req.query('operacion_id') ?? '';
  const search      = c.req.query('search') ?? '';
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (estado && estado !== 'todos') {
    params.push(estado);
    where += ` AND p.estado = $${params.length}`;
  }
  if (proveedorId) {
    params.push(proveedorId);
    where += ` AND p.proveedor_id = $${params.length}`;
  }
  if (operacionId) {
    params.push(operacionId);
    where += ` AND p.operacion_id = $${params.length}`;
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (p.numero ILIKE $${params.length} OR prov.nombre ILIKE $${params.length})`;
  }

  const { rows } = await db.query(`
    ${WITH_PROVEEDOR}
    ${where}
    ORDER BY p.created_at DESC
    LIMIT 200
  `, params);

  return c.json(rows);
});

// POST / — crear pedido con items
pedidos.post('/', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, PedidoSchema);
  if (b instanceof Response) return b;

  if (!b.proveedor_id)    return c.json({ error: 'proveedor_id requerido' }, 400);
  if (!b.items?.length)   return c.json({ error: 'items requeridos' }, 400);

  const numero = await nextNumero();
  const montoItems = (b.items as { costo_unitario: number; cantidad: number }[])
    .reduce((acc, i) => acc + (parseFloat(String(i.costo_unitario)) || 0) * (i.cantidad || 1), 0);
  const costoEnvio = typeof b.costo_envio === 'number' ? b.costo_envio : Math.round(montoItems * 0.10);
  const montoTotal = montoItems + costoEnvio;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [pedido] } = await client.query(`
      INSERT INTO pedidos
        (numero, proveedor_id, operacion_id, estado, fecha_pedido,
         fecha_entrega_est, monto_total, costo_envio, notas, created_by)
      VALUES ($1,$2,$3,'pendiente',$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      numero,
      b.proveedor_id,
      b.operacion_id        || null,
      b.fecha_pedido        || new Date().toISOString().split('T')[0],
      b.fecha_entrega_est   || null,
      montoTotal,
      costoEnvio,
      b.notas               || null,
      user?.id              || null,
    ]);

    for (const [idx, item] of (b.items as {
      operacion_item_id?: string; producto_id?: string;
      descripcion: string; cantidad: number; costo_unitario: number;
    }[]).entries()) {
      // Validar que el ítem de operación no esté ya cubierto por otro pedido activo
      if (item.operacion_item_id) {
        const { rows: dup } = await client.query(
          `SELECT p2.numero FROM pedido_items pi2
           JOIN pedidos p2 ON p2.id = pi2.pedido_id
           WHERE pi2.operacion_item_id = $1 AND p2.estado != 'cancelado'
           LIMIT 1`,
          [item.operacion_item_id]
        );
        if (dup.length) {
          await client.query('ROLLBACK');
          return c.json({
            error: `El ítem "${item.descripcion}" ya está incluido en el pedido ${dup[0].numero}. Refrescá la página y volvé a intentar.`
          }, 409);
        }
      }

      await client.query(`
        INSERT INTO pedido_items
          (pedido_id, operacion_item_id, producto_id, descripcion, cantidad, costo_unitario, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        pedido.id,
        item.operacion_item_id || null,
        item.producto_id       || null,
        item.descripcion,
        item.cantidad          || 1,
        parseFloat(String(item.costo_unitario)) || 0,
        idx,
      ]);
    }

    await client.query('COMMIT');
    return c.json({ id: pedido.id, numero: pedido.numero }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /operaciones-disponibles — ops con al menos un ítem sin cubrir por pedido activo
pedidos.get('/operaciones-disponibles', async (c) => {
  const { rows } = await db.query(`
    SELECT
      o.id, o.numero, o.proveedor_id, o.precio_total,
      json_build_object(
        'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
        'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona
      ) AS cliente,
      COALESCE((
        SELECT SUM(r.monto_total) FROM recibos r
        WHERE r.operacion_id = o.id AND r.estado = 'emitido'
      ), 0)::numeric AS cobrado_total,
      (SELECT nombre FROM proveedores WHERE id = o.proveedor_id LIMIT 1) AS proveedor_nombre,
      (
        SELECT COUNT(*)::int FROM pedidos p
        WHERE p.operacion_id = o.id AND p.estado != 'cancelado'
      ) AS pedidos_activos,
      (SELECT COUNT(*)::int FROM operacion_items oi WHERE oi.operacion_id = o.id) AS items_total,
      (
        SELECT COUNT(*)::int FROM operacion_items oi
        WHERE oi.operacion_id = o.id
          AND NOT EXISTS (
            SELECT 1 FROM pedido_items pi
            JOIN pedidos p ON p.id = pi.pedido_id
            WHERE pi.operacion_item_id = oi.id AND p.estado != 'cancelado'
          )
      ) AS items_pendientes
    FROM operaciones o
    LEFT JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado IN ('aprobado', 'en_produccion', 'listo')
      AND COALESCE((
        SELECT SUM(r2.monto_total) FROM recibos r2
        WHERE r2.operacion_id = o.id AND r2.estado = 'emitido'
      ), 0) > 0
      AND EXISTS (
        SELECT 1 FROM operacion_items oi2
        WHERE oi2.operacion_id = o.id
          AND NOT EXISTS (
            SELECT 1 FROM pedido_items pi2
            JOIN pedidos p2 ON p2.id = pi2.pedido_id
            WHERE pi2.operacion_item_id = oi2.id AND p2.estado != 'cancelado'
          )
      )
    ORDER BY o.created_at DESC
    LIMIT 50
  `);
  return c.json(rows);
});

// POST /:id/enviar-whatsapp — envía pedido al proveedor via Evolution API
pedidos.post('/:id/enviar-whatsapp', async (c) => {
  const { id } = c.req.param();

  const [{ rows: [pedido] }, { rows: items }] = await Promise.all([
    db.query(`${WITH_PROVEEDOR} WHERE p.id = $1`, [id]),
    db.query(`SELECT descripcion, cantidad, costo_unitario FROM pedido_items WHERE pedido_id=$1 ORDER BY orden`, [id]),
  ]);
  if (!pedido) return c.json({ error: 'Pedido no encontrado' }, 404);

  const prov = pedido.proveedor;
  if (!prov?.telefono) return c.json({ error: 'El proveedor no tiene teléfono registrado' }, 422);

  // Normalizar número Argentina → 549XXXXXXXXXX
  const digits = prov.telefono.replace(/\D/g, '');
  let numero: string;
  if (digits.startsWith('549') && digits.length >= 12) numero = digits;
  else if (digits.startsWith('54') && digits.length >= 11) numero = `549${digits.slice(2)}`;
  else if (digits.startsWith('0') && digits.length >= 10) numero = `549${digits.slice(1)}`;
  else numero = `549${digits}`;

  // Leer plantilla de DB (fallback a texto inline si no existe)
  const { rows: [tpl] } = await db.query(
    `SELECT contenido FROM mensajes_plantilla WHERE clave = 'pedido_proveedor'`
  );
  const plantilla: string = tpl?.contenido ?? '';

  // Variables de sustitución
  const opRef = pedido.operacion
    ? `\nReferencia: ${pedido.operacion.numero}${pedido.operacion.cliente ? ` — ${pedido.operacion.cliente.razon_social ?? `${pedido.operacion.cliente.apellido ?? ''} ${pedido.operacion.cliente.nombre ?? ''}`.trim()}` : ''}`
    : '';
  const detalle = items.map((i: { descripcion: string; cantidad: number; costo_unitario: number }) =>
    `• ${i.descripcion} — Cant: ${i.cantidad}`
  ).join('\n');
  const fechaEst = pedido.fecha_entrega_est
    ? `\n📅 Necesitamos para: ${new Date(pedido.fecha_entrega_est).toLocaleDateString('es-AR')}`
    : '';

  const mensaje = plantilla
    ? plantilla
        .replace(/\{\{numero\}\}/g, pedido.numero)
        .replace(/\{\{detalle\}\}/g, detalle)
        .replace(/\{\{ref_operacion\}\}/g, opRef)
        .replace(/\{\{fecha_entrega\}\}/g, fechaEst)
    : `🏠 *Pedido de Productos — César Brítez Aberturas*\nFormosa, Argentina${opRef}\n\n📋 *Detalle del pedido ${pedido.numero}:*\n\n${detalle}${fechaEst}\n\nMuchas gracias por su atención. Aguardamos confirmación de recepción.`;

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
    console.error('[whatsapp-pedido] Evolution API error:', resp.status, errText);

    // Detectar número no registrado en WhatsApp
    try {
      const errJson = JSON.parse(errText);
      const msgs: Array<{ exists?: boolean; number?: string }> = errJson?.response?.message ?? [];
      const noExiste = msgs.find(m => m.exists === false);
      if (noExiste) {
        return c.json({
          error: `El número ${noExiste.number ?? numero} no está registrado en WhatsApp. Verificá el número en la ficha del proveedor.`
        }, 422);
      }
    } catch { /* no JSON, seguir con error genérico */ }

    return c.json({ error: `Error al enviar WhatsApp (${resp.status})` }, 502);
  }

  return c.json({ enviado: true, numero, mensaje });
});

// GET /:id — detalle con items
pedidos.get('/:id', async (c) => {
  const { id } = c.req.param();
  const [{ rows: [pedido] }, { rows: items }] = await Promise.all([
    db.query(`${WITH_PROVEEDOR} WHERE p.id = $1`, [id]),
    db.query(`
      SELECT pi.*,
        CASE WHEN prod.id IS NOT NULL
          THEN json_build_object('id', prod.id, 'nombre', prod.nombre, 'codigo', prod.codigo)
          ELSE NULL END AS producto,
        prod.imagen_url AS producto_imagen_url
      FROM pedido_items pi
      LEFT JOIN catalogo_productos prod ON prod.id = pi.producto_id
      WHERE pi.pedido_id = $1
      ORDER BY pi.orden
    `, [id]),
  ]);
  if (!pedido) return c.json({ error: 'Pedido no encontrado' }, 404);
  return c.json({ ...pedido, items });
});

// PUT /:id — editar (solo pendiente)
pedidos.put('/:id', async (c) => {
  const { id } = c.req.param();
  const b      = await c.req.json();

  const { rows: [actual] } = await db.query(`SELECT estado FROM pedidos WHERE id=$1`, [id]);
  if (!actual) return c.json({ error: 'Pedido no encontrado' }, 404);
  if (actual.estado !== 'pendiente') return c.json({ error: 'Solo se puede editar un pedido pendiente' }, 409);

  const montoItemsEdit = (b.items as { costo_unitario: number; cantidad: number }[])
    .reduce((acc, i) => acc + (parseFloat(String(i.costo_unitario)) || 0) * (i.cantidad || 1), 0);
  const costoEnvioEdit = typeof b.costo_envio === 'number' ? b.costo_envio : Math.round(montoItemsEdit * 0.10);
  const montoTotalEdit = montoItemsEdit + costoEnvioEdit;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE pedidos SET
        proveedor_id     = $1, operacion_id   = $2,
        fecha_pedido     = $3, fecha_entrega_est = $4,
        monto_total      = $5, costo_envio    = $6,
        notas            = $7, updated_at     = now()
      WHERE id = $8
    `, [
      b.proveedor_id,
      b.operacion_id      || null,
      b.fecha_pedido      || new Date().toISOString().split('T')[0],
      b.fecha_entrega_est || null,
      montoTotalEdit,
      costoEnvioEdit,
      b.notas             || null,
      id,
    ]);

    await client.query(`DELETE FROM pedido_items WHERE pedido_id=$1`, [id]);
    for (const [idx, item] of (b.items ?? []).entries()) {
      await client.query(`
        INSERT INTO pedido_items
          (pedido_id, operacion_item_id, producto_id, descripcion, cantidad, costo_unitario, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        id,
        item.operacion_item_id || null,
        item.producto_id       || null,
        item.descripcion,
        item.cantidad          || 1,
        parseFloat(String(item.costo_unitario)) || 0,
        idx,
      ]);
    }

    await client.query('COMMIT');
    const { rows: [updated] } = await db.query(`${WITH_PROVEEDOR} WHERE p.id = $1`, [id]);
    return c.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id/estado — transiciones + stock en recepción
pedidos.patch('/:id/estado', async (c) => {
  const { id }  = c.req.param();
  const user    = c.get('user');
  const b = await validateBody(c, PedidoEstadoSchema);
  if (b instanceof Response) return b;
  const { estado: nuevoEstado, fecha_recepcion } = b;

  const TRANSICIONES: Record<string, string[]> = {
    pendiente: ['enviado', 'cancelado'],
    enviado:   ['recibido', 'cancelado'],
    recibido:  ['cancelado'],
    cancelado: [],
  };

  const { rows: [pedido] } = await db.query(
    `SELECT p.*, json_agg(
       json_build_object('producto_id', pi.producto_id, 'cantidad', pi.cantidad,
                         'descripcion', pi.descripcion, 'costo_unitario', pi.costo_unitario)
     ) AS items
     FROM pedidos p
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`, [id]
  );
  if (!pedido) return c.json({ error: 'Pedido no encontrado' }, 404);

  const estadoActual = pedido.estado as string;
  if (!TRANSICIONES[estadoActual]?.includes(nuevoEstado)) {
    return c.json({ error: `No se puede pasar de ${estadoActual} a ${nuevoEstado}` }, 409);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // enviado → recibido: ingresar stock por cada item con producto_id
    if (nuevoEstado === 'recibido') {
      const items = (pedido.items as {
        producto_id: string | null; cantidad: number;
        descripcion: string; costo_unitario: number;
      }[]).filter(i => i.producto_id);

      for (const item of items) {
        await client.query(`
          INSERT INTO stock_movimientos
            (producto_id, tipo, cantidad, costo_unitario, motivo,
             operacion_id, referencia_nro, created_by)
          VALUES ($1, 'ingreso', $2, $3, 'Recepción de pedido', $4, $5, $6)
        `, [
          item.producto_id,
          Math.abs(item.cantidad),
          item.costo_unitario || null,
          pedido.operacion_id || null,
          pedido.numero,
          user?.id || null,
        ]);
      }
    }

    const fechaRecepcionFinal = nuevoEstado === 'recibido'
      ? (fecha_recepcion || new Date().toISOString().split('T')[0])
      : null;

    await client.query(`
      UPDATE pedidos SET
        estado = $1,
        fecha_recepcion = COALESCE($2::date, fecha_recepcion),
        updated_at = now()
      WHERE id = $3
    `, [nuevoEstado, fechaRecepcionFinal, id]);

    await client.query('COMMIT');
    const { rows: [updated] } = await db.query(`${WITH_PROVEEDOR} WHERE p.id = $1`, [id]);
    return c.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /:id — solo pendiente
pedidos.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [p] } = await db.query(`SELECT estado FROM pedidos WHERE id=$1`, [id]);
  if (!p) return c.json({ error: 'Pedido no encontrado' }, 404);
  if (p.estado !== 'pendiente') return c.json({ error: 'Solo se puede eliminar un pedido pendiente' }, 409);
  await db.query(`DELETE FROM pedidos WHERE id=$1`, [id]);
  return c.json({ ok: true });
});

export default pedidos;
