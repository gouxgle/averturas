import { Hono } from 'hono';
import { db } from '../db.js';

const clientes = new Hono();

// Letra normalizada: tildes → base, no-letra → '#'
const RAW_LETRA  = (alias: string) =>
  `TRANSLATE(UPPER(LEFT(COALESCE(${alias}.apellido, ${alias}.razon_social, ${alias}.nombre, '#'), 1)), 'ÁÉÍÓÚÑ', 'AEIOÚN')`;
const LETRA_EXPR = (alias: string) =>
  `CASE WHEN ${RAW_LETRA(alias)} ~ '^[A-Z]$' THEN ${RAW_LETRA(alias)} ELSE '#' END`;

// GET /letras — índice de letras con conteo (carga inicial liviana). ANTES de /:id
clientes.get('/letras', async (c) => {
  const raw = `TRANSLATE(UPPER(LEFT(COALESCE(apellido, razon_social, nombre, '#'), 1)), 'ÁÉÍÓÚÑ', 'AEIOÚN')`;
  const { rows } = await db.query(`
    SELECT
      CASE WHEN ${raw} ~ '^[A-Z]$' THEN ${raw} ELSE '#' END AS letra,
      COUNT(*)::int AS total
    FROM clientes
    WHERE activo = true
    GROUP BY letra
    ORDER BY CASE WHEN (CASE WHEN ${raw} ~ '^[A-Z]$' THEN ${raw} ELSE '#' END) = '#' THEN 1 ELSE 0 END, letra
  `);
  return c.json(rows);
});

clientes.get('/', async (c) => {
  const search = c.req.query('search') ?? '';
  const estado = c.req.query('estado') ?? '';
  const letra  = c.req.query('letra')  ?? '';
  const params: unknown[] = [];
  let where = `WHERE c.activo = true`;

  if (letra.trim()) {
    params.push(letra.trim().toUpperCase());
    where += ` AND ${LETRA_EXPR('c')} = $${params.length}`;
  }

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    const n = params.length;
    where += ` AND (
      c.nombre          ILIKE $${n}
      OR c.apellido     ILIKE $${n}
      OR c.razon_social ILIKE $${n}
      OR c.telefono     ILIKE $${n}
      OR c.documento_nro ILIKE $${n}
      OR c.email        ILIKE $${n}
      OR c.localidad    ILIKE $${n}
      OR c.notas        ILIKE $${n}
    )`;
  }

  if (estado.trim()) {
    params.push(estado.trim());
    where += ` AND c.estado = $${params.length}`;
  }

  const { rows } = await db.query(`
    SELECT c.*,
      EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
      CASE WHEN cat.id IS NOT NULL
        THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
        ELSE NULL END AS categoria,
      CASE WHEN ref.id IS NOT NULL
        THEN json_build_object('id', ref.id, 'apellido', ref.apellido, 'nombre', ref.nombre, 'razon_social', ref.razon_social, 'tipo_persona', ref.tipo_persona)
        ELSE NULL END AS referido_por
    FROM clientes c
    LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
    LEFT JOIN clientes ref ON ref.id = c.referido_por_id
    ${where}
    ORDER BY
      COALESCE(c.apellido, c.razon_social, c.nombre) ASC NULLS LAST,
      c.nombre ASC
  `, params);

  return c.json(rows);
});

// POST /importar — importación masiva de clientes desde CSV/JSON
clientes.post('/importar', async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as unknown[];

  if (!Array.isArray(body) || body.length === 0) {
    return c.json({ error: 'Se esperaba un array de clientes' }, 400);
  }
  if (body.length > 5000) {
    return c.json({ error: 'Máximo 5000 registros por lote' }, 400);
  }

  let importados = 0;
  let duplicados = 0;
  let errores = 0;
  const detalleErrores: { fila: number; nombre: string; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const r = body[i] as Record<string, string>;

    const nombre     = r.nombre?.trim() || null;
    const apellido   = r.apellido?.trim() || null;
    const razon      = r.razon_social?.trim() || null;
    const telefono   = r.telefono?.trim() || null;
    const nombreDisp = [apellido, nombre].filter(Boolean).join(', ') || razon || `fila ${i + 1}`;

    // Detectar duplicado por teléfono principal
    if (telefono) {
      const { rows: dup } = await db.query(
        `SELECT id FROM clientes WHERE telefono = $1 LIMIT 1`, [telefono]
      );
      if (dup.length > 0) {
        duplicados++;
        continue;
      }
    }

    try {
      await db.query(`
        INSERT INTO clientes
          (tipo_persona, nombre, apellido, razon_social,
           telefono, telefono_fijo, email, notas, origen, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        r.tipo_persona?.trim() || 'fisica',
        nombre,
        apellido,
        razon,
        telefono,
        r.telefono_fijo?.trim() || null,
        r.email?.trim() || null,
        r.notas?.trim() || null,
        r.origen?.trim() || 'importacion',
        user.id,
      ]);
      importados++;
    } catch (err: any) {
      errores++;
      detalleErrores.push({ fila: i + 1, nombre: nombreDisp, error: err.message ?? String(err) });
      if (detalleErrores.length >= 20) break;
    }
  }

  return c.json({ importados, duplicados, errores, detalleErrores });
});

// GET /panel — CRM completo: stats, lista enriquecida, oportunidades, sidebar (ANTES de /:id)
clientes.get('/panel', async (c) => {
  const mesStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    statsRows,
    facturadoMes,
    clientesRows,
    oportunidadesRows,
    porLocalidad,
    actividadReciente,
    mayorCompraRows,
    mejorClienteMesRows,
    ticketMesRows,
  ] = await Promise.all([

    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado IN ('activo','recurrente'))::int AS activos,
        COUNT(*) FILTER (WHERE ultima_interaccion IS NULL OR EXTRACT(DAY FROM now() - ultima_interaccion) >= 60)::int AS sin_actividad,
        COUNT(*) FILTER (WHERE created_at >= $1::timestamp)::int AS nuevos_mes,
        (SELECT COUNT(*)::int FROM (
          SELECT cl2.id FROM clientes cl2
          JOIN operaciones o ON o.cliente_id = cl2.id AND o.estado NOT IN ('presupuesto','enviado','cancelado')
          WHERE cl2.activo = true GROUP BY cl2.id HAVING COUNT(o.id) >= 3
        ) sub) AS clientes_top
      FROM clientes WHERE activo = true
    `, [mesStr]),

    db.query(`
      SELECT COALESCE(SUM(monto_total), 0)::numeric AS total
      FROM recibos WHERE estado = 'emitido' AND fecha >= $1::date
    `, [mesStr]),

    db.query(`
      SELECT
        c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
        c.telefono, c.email, c.documento_nro, c.localidad, c.estado,
        c.created_at, c.ultima_interaccion,
        COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion)::int, 999) AS dias_sin_contacto,
        cat.nombre AS categoria_nombre, cat.color AS categoria_color,
        ops.operaciones_count,
        ops.valor_total_historico,
        CASE WHEN ops.operaciones_count > 0
          THEN (ops.valor_total_historico / ops.operaciones_count)
          ELSE 0
        END AS ticket_promedio,
        deuda.total_deuda,
        deuda.count_deuda,
        CASE
          WHEN c.created_at >= NOW() - INTERVAL '30 days' THEN 'nuevo'
          WHEN c.estado IN ('inactivo','perdido')
            OR COALESCE(EXTRACT(DAY FROM now() - c.ultima_interaccion), 999) >= 60 THEN 'inactivo'
          WHEN c.estado = 'prospecto' THEN 'seguimiento'
          WHEN ops.operaciones_count >= 3 THEN 'frecuente'
          ELSE 'activo'
        END AS segmento
      FROM clientes c
      LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE o.estado NOT IN ('presupuesto','enviado','cancelado'))::int AS operaciones_count,
          COALESCE(SUM(o.precio_total) FILTER (WHERE o.estado NOT IN ('presupuesto','enviado','cancelado')), 0)::numeric AS valor_total_historico
        FROM operaciones o WHERE o.cliente_id = c.id
      ) ops ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(cp.monto), 0)::numeric AS total_deuda,
          COUNT(*)::int AS count_deuda
        FROM compromisos_pago cp WHERE cp.cliente_id = c.id AND cp.estado = 'pendiente'
      ) deuda ON true
      WHERE c.activo = true
      ORDER BY c.ultima_interaccion DESC NULLS LAST, c.created_at DESC
      LIMIT 500
    `, []),

    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM clientes
          WHERE activo = true AND (ultima_interaccion IS NULL OR EXTRACT(DAY FROM now() - ultima_interaccion) >= 30)
        ) AS sin_contacto_30d,
        (SELECT COUNT(*)::int FROM operaciones WHERE estado = 'enviado' AND updated_at < NOW() - INTERVAL '3 days') AS presupuestos_sin_respuesta,
        (SELECT COUNT(*)::int FROM compromisos_pago WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE) AS pagos_vencidos,
        (SELECT COUNT(*)::int FROM clientes WHERE activo = true AND estado = 'prospecto') AS para_seguimiento
    `, []),

    db.query(`
      SELECT localidad, COUNT(*)::int AS count,
        ROUND(COUNT(*) * 100.0 / NULLIF(
          (SELECT COUNT(*) FROM clientes WHERE activo = true AND localidad IS NOT NULL AND localidad != ''), 0
        ))::int AS pct
      FROM clientes
      WHERE activo = true AND localidad IS NOT NULL AND localidad != ''
      GROUP BY localidad ORDER BY count DESC LIMIT 6
    `, []),

    db.query(`
      WITH acts AS (
        (SELECT 'interaccion'::text AS tipo,
          CASE i.tipo
            WHEN 'llamada' THEN 'Llamada con '
            WHEN 'whatsapp' THEN 'Mensaje enviado a '
            WHEN 'email' THEN 'Email a '
            WHEN 'visita' THEN 'Visita a '
            WHEN 'presupuesto_enviado' THEN 'Presupuesto enviado a '
            WHEN 'operacion_completada' THEN 'Operación con '
            ELSE 'Nota de '
          END || COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)) AS descripcion,
          COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)) AS cliente_nombre,
          i.created_at AS fecha
        FROM interacciones i JOIN clientes cl ON cl.id = i.cliente_id
        WHERE i.created_at >= NOW() - INTERVAL '14 days'
        ORDER BY i.created_at DESC LIMIT 10)
        UNION ALL
        (SELECT 'recibo'::text,
          'Pago recibido de ' || COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)),
          COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)),
          r.created_at
        FROM recibos r JOIN clientes cl ON cl.id = r.cliente_id
        WHERE r.estado = 'emitido' AND r.created_at >= NOW() - INTERVAL '14 days'
        ORDER BY r.created_at DESC LIMIT 10)
        UNION ALL
        (SELECT 'operacion'::text,
          'Presupuesto creado para ' || COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)),
          COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)),
          o.created_at
        FROM operaciones o JOIN clientes cl ON cl.id = o.cliente_id
        WHERE o.created_at >= NOW() - INTERVAL '14 days' AND o.estado = 'presupuesto'
        ORDER BY o.created_at DESC LIMIT 10)
      )
      SELECT * FROM acts ORDER BY fecha DESC LIMIT 8
    `, []),

    db.query(`
      SELECT
        COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)) AS cliente_nombre,
        SUM(o.precio_total)::numeric AS monto_total,
        COUNT(*)::int AS operaciones_count
      FROM clientes cl
      JOIN operaciones o ON o.cliente_id = cl.id
        AND o.estado NOT IN ('presupuesto','enviado','cancelado')
      WHERE cl.activo = true
      GROUP BY cl.id, cl.nombre, cl.apellido, cl.razon_social
      ORDER BY monto_total DESC LIMIT 1
    `, []),

    db.query(`
      SELECT
        COALESCE(cl.razon_social, CONCAT_WS(', ', cl.apellido, cl.nombre)) AS cliente_nombre,
        SUM(r.monto_total)::numeric AS monto_mes,
        COUNT(*)::int AS compras_mes
      FROM recibos r JOIN clientes cl ON cl.id = r.cliente_id
      WHERE r.estado = 'emitido' AND r.fecha >= $1::date
      GROUP BY cl.id, cl.nombre, cl.apellido, cl.razon_social
      ORDER BY monto_mes DESC LIMIT 1
    `, [mesStr]),

    db.query(`
      SELECT
        COALESCE(AVG(monto_total) FILTER (WHERE fecha >= $1::date), 0)::numeric AS ticket_promedio_mes,
        COALESCE(AVG(monto_total) FILTER (
          WHERE fecha < $1::date AND fecha >= ($1::date - INTERVAL '1 month')
        ), 0)::numeric AS ticket_mes_anterior
      FROM recibos
      WHERE estado = 'emitido' AND fecha >= ($1::date - INTERVAL '1 month')
    `, [mesStr]),
  ]);

  const st  = statsRows.rows[0] as Record<string, string>;
  const opo = oportunidadesRows.rows[0] as Record<string, string>;
  const tm  = ticketMesRows.rows[0] as Record<string, string>;
  const ticketActual   = Number(tm?.ticket_promedio_mes ?? 0);
  const ticketAnterior = Number(tm?.ticket_mes_anterior ?? 0);
  const ticketTrend    = ticketAnterior > 0
    ? Math.round((ticketActual - ticketAnterior) / ticketAnterior * 100) : 0;

  return c.json({
    stats: {
      total:               Number(st.total),
      activos:             Number(st.activos),
      sin_actividad:       Number(st.sin_actividad),
      nuevos_mes:          Number(st.nuevos_mes),
      total_facturado_mes: Number(facturadoMes.rows[0]?.total ?? 0),
      clientes_top:        Number(st.clientes_top ?? 0),
    },
    clientes: (clientesRows.rows as Record<string, unknown>[]).map(r => ({
      id:                   r.id,
      nombre:               r.nombre,
      apellido:             r.apellido,
      razon_social:         r.razon_social,
      tipo_persona:         r.tipo_persona,
      telefono:             r.telefono,
      email:                r.email,
      documento_nro:        r.documento_nro,
      localidad:            r.localidad,
      estado:               r.estado,
      created_at:           r.created_at,
      ultima_interaccion:   r.ultima_interaccion,
      dias_sin_contacto:    Number(r.dias_sin_contacto),
      categoria_nombre:     r.categoria_nombre,
      categoria_color:      r.categoria_color,
      operaciones_count:    Number(r.operaciones_count),
      valor_total_historico:Number(r.valor_total_historico),
      ticket_promedio:      Number(r.ticket_promedio),
      total_deuda:          Number(r.total_deuda),
      count_deuda:          Number(r.count_deuda),
      segmento:             r.segmento,
    })),
    oportunidades: {
      sin_contacto_30d:            Number(opo.sin_contacto_30d),
      presupuestos_sin_respuesta:  Number(opo.presupuestos_sin_respuesta),
      pagos_vencidos:              Number(opo.pagos_vencidos),
      para_seguimiento:            Number(opo.para_seguimiento),
    },
    por_localidad: (porLocalidad.rows as Record<string, unknown>[]).map(r => ({
      localidad: r.localidad,
      count:     Number(r.count),
      pct:       Number(r.pct),
    })),
    actividad_reciente: (actividadReciente.rows as Record<string, unknown>[]).map(r => ({
      tipo:           r.tipo,
      descripcion:    r.descripcion,
      cliente_nombre: r.cliente_nombre,
      fecha:          r.fecha,
    })),
    resumen: {
      sin_actividad_60d:   Number(st.sin_actividad),
      mayor_compra: mayorCompraRows.rows[0] ? {
        cliente_nombre:  (mayorCompraRows.rows[0] as Record<string, unknown>).cliente_nombre,
        monto:           Number((mayorCompraRows.rows[0] as Record<string, unknown>).monto_total),
        operaciones:     Number((mayorCompraRows.rows[0] as Record<string, unknown>).operaciones_count),
      } : null,
      mejor_cliente_mes: mejorClienteMesRows.rows[0] ? {
        cliente_nombre:  (mejorClienteMesRows.rows[0] as Record<string, unknown>).cliente_nombre,
        monto:           Number((mejorClienteMesRows.rows[0] as Record<string, unknown>).monto_mes),
        compras:         Number((mejorClienteMesRows.rows[0] as Record<string, unknown>).compras_mes),
      } : null,
      ticket_promedio_mes: ticketActual,
      ticket_trend:        ticketTrend,
    },
  });
});

// Debe estar ANTES de /:id — Hono matchea en orden de registro
clientes.get('/validar-dni', async (c) => {
  const dni = c.req.query('dni')?.trim();
  const excluirId = c.req.query('excluir_id');
  if (!dni) return c.json({ existe: false });
  let q = `SELECT id, nombre, apellido, razon_social FROM clientes WHERE documento_nro = $1`;
  const params: unknown[] = [dni];
  if (excluirId) { params.push(excluirId); q += ` AND id != $2`; }
  const { rows } = await db.query(q, params);
  return c.json({ existe: rows.length > 0, cliente: rows[0] ?? null });
});

// GET /:id/estado-cuenta — resumen financiero completo del cliente (ANTES de /:id)
clientes.get('/:id/estado-cuenta', async (c) => {
  const { id } = c.req.param();

  const [
    { rows: [cliente] },
    { rows: operaciones },
    { rows: recibos_all },
    { rows: remitos_all },
    { rows: compromisos_all },
  ] = await Promise.all([
    db.query(`
      SELECT c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
        c.telefono, c.email, c.direccion, c.localidad, c.documento_nro
      FROM clientes c WHERE c.id = $1
    `, [id]),
    db.query(`
      SELECT o.id, o.numero, o.tipo, o.estado, o.precio_total, o.costo_total,
        o.created_at, o.fecha_validez, o.notas, o.forma_pago,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id, 'descripcion', oi.descripcion,
              'cantidad', oi.cantidad,
              'precio_unitario', oi.precio_unitario,
              'precio_instalacion', oi.precio_instalacion,
              'incluye_instalacion', oi.incluye_instalacion,
              'precio_total', (oi.precio_unitario + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion ELSE 0 END) * oi.cantidad,
              'medida_ancho', oi.medida_ancho, 'medida_alto', oi.medida_alto,
              'color', oi.color, 'vidrio', oi.vidrio,
              'tipo_abertura', ta.nombre, 'sistema', s.nombre
            ) ORDER BY oi.orden
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM operaciones o
      LEFT JOIN operacion_items oi ON oi.operacion_id = o.id
      LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
      LEFT JOIN sistemas s ON s.id = oi.sistema_id
      WHERE o.cliente_id = $1 AND o.estado != 'cancelado'
      GROUP BY o.id
      ORDER BY
        CASE WHEN o.estado IN ('aprobado','en_produccion','listo','instalado','entregado') THEN 0 ELSE 1 END,
        o.created_at DESC
    `, [id]),
    db.query(`
      SELECT r.id, r.numero, r.fecha, r.monto_total, r.forma_pago,
        r.concepto, r.estado, r.operacion_id,
        COALESCE(
          json_agg(
            json_build_object(
              'descripcion', ri.descripcion,
              'monto', ri.monto,
              'cantidad', ri.cantidad
            ) ORDER BY ri.orden
          ) FILTER (WHERE ri.id IS NOT NULL),
          '[]'
        ) AS items
      FROM recibos r
      LEFT JOIN recibo_items ri ON ri.recibo_id = r.id
      WHERE r.cliente_id = $1 AND r.estado != 'anulado'
      GROUP BY r.id
      ORDER BY r.fecha ASC, r.created_at ASC
    `, [id]),
    db.query(`
      SELECT id, numero, fecha_emision, estado, operacion_id, medio_envio,
        fecha_entrega_real
      FROM remitos
      WHERE cliente_id = $1 AND estado != 'cancelado'
      ORDER BY fecha_emision ASC
    `, [id]),
    db.query(`
      SELECT cp.*,
        CASE WHEN o.id IS NOT NULL
          THEN json_build_object('id', o.id, 'numero', o.numero)
          ELSE NULL END AS operacion
      FROM compromisos_pago cp
      LEFT JOIN operaciones o ON o.id = cp.operacion_id
      WHERE cp.cliente_id = $1
      ORDER BY cp.fecha_vencimiento ASC, cp.created_at ASC
    `, [id]),
  ]);

  if (!cliente) return c.json({ error: 'Cliente no encontrado' }, 404);

  // Agrupar recibos y remitos por operacion
  const recibosMap: Record<string, typeof recibos_all> = {};
  const recibosDirectos: typeof recibos_all = [];
  for (const r of recibos_all) {
    if (r.operacion_id) {
      if (!recibosMap[r.operacion_id]) recibosMap[r.operacion_id] = [];
      recibosMap[r.operacion_id].push(r);
    } else {
      recibosDirectos.push(r);
    }
  }
  const remitosMap: Record<string, typeof remitos_all> = {};
  for (const rm of remitos_all) {
    if (rm.operacion_id) {
      if (!remitosMap[rm.operacion_id]) remitosMap[rm.operacion_id] = [];
      remitosMap[rm.operacion_id].push(rm);
    }
  }

  const ESTADOS_APROBADOS = new Set(['aprobado','en_produccion','listo','instalado','entregado']);

  // Calcular totales por operacion y globales
  let totalPresupuestado = 0;
  let totalCobrado = 0;
  let totalPendienteAprobacion = 0;

  const operacionesConDetalle = operaciones.map((op: any) => {
    const recibosOp = recibosMap[op.id] ?? [];
    const remitosOp = remitosMap[op.id] ?? [];
    const generaSaldo = ESTADOS_APROBADOS.has(op.estado);
    const cobrado = recibosOp.reduce((s: number, r: any) => s + Number(r.monto_total), 0);
    // saldo financiero solo aplica a operaciones aprobadas
    const saldo = generaSaldo ? Number(op.precio_total) - cobrado : null;
    if (generaSaldo) {
      totalPresupuestado += Number(op.precio_total);
      totalCobrado += cobrado;
    } else {
      totalPendienteAprobacion += Number(op.precio_total);
    }
    return { ...op, recibos: recibosOp, remitos: remitosOp, cobrado: generaSaldo ? cobrado : null, saldo, genera_saldo: generaSaldo };
  });

  const cobradoDirecto = recibosDirectos.reduce((s, r) => s + Number(r.monto_total), 0);
  totalCobrado += cobradoDirecto;

  return c.json({
    cliente,
    operaciones: operacionesConDetalle,
    recibos_directos: recibosDirectos,
    compromisos: compromisos_all,
    totales: {
      presupuestado: totalPresupuestado,
      cobrado: totalCobrado,
      saldo: totalPresupuestado - totalCobrado,
      pendiente_aprobacion: totalPendienteAprobacion,
    },
  });
});

clientes.get('/:id', async (c) => {
  const { id } = c.req.param();

  const [
    { rows: [cliente] },
    { rows: operaciones },
    { rows: interacciones },
    { rows: tareas },
    { rows: recibos },
    { rows: remitos },
  ] = await Promise.all([
    db.query(`
      SELECT c.*,
        EXTRACT(DAY FROM now() - c.ultima_interaccion)::int AS dias_sin_contacto,
        CASE WHEN cat.id IS NOT NULL
          THEN json_build_object('id', cat.id, 'nombre', cat.nombre, 'color', cat.color)
          ELSE NULL END AS categoria,
        CASE WHEN ref.id IS NOT NULL
          THEN json_build_object('id', ref.id, 'apellido', ref.apellido, 'nombre', ref.nombre, 'razon_social', ref.razon_social, 'tipo_persona', ref.tipo_persona)
          ELSE NULL END AS referido_por
      FROM clientes c
      LEFT JOIN categorias_cliente cat ON cat.id = c.categoria_id
      LEFT JOIN clientes ref ON ref.id = c.referido_por_id
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
    db.query(`
      SELECT r.id, r.numero, r.fecha, r.monto_total, r.forma_pago, r.estado,
        r.operacion_id,
        CASE WHEN op.id IS NOT NULL
          THEN json_build_object('id', op.id, 'numero', op.numero)
          ELSE NULL END AS operacion
      FROM recibos r
      LEFT JOIN operaciones op ON op.id = r.operacion_id
      WHERE r.cliente_id = $1 AND r.estado != 'anulado'
      ORDER BY r.fecha DESC, r.created_at DESC
      LIMIT 50
    `, [id]),
    db.query(`
      SELECT r.id, r.numero, r.fecha_emision, r.estado, r.operacion_id,
        CASE WHEN op.id IS NOT NULL
          THEN json_build_object('id', op.id, 'numero', op.numero)
          ELSE NULL END AS operacion
      FROM remitos r
      LEFT JOIN operaciones op ON op.id = r.operacion_id
      WHERE r.cliente_id = $1 AND r.estado != 'cancelado'
      ORDER BY r.fecha_emision DESC, r.created_at DESC
      LIMIT 50
    `, [id]),
  ]);

  if (!cliente) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json({ ...cliente, operaciones, interacciones, tareas, recibos, remitos });
});

clientes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const { rows: [row] } = await db.query(`
    INSERT INTO clientes
      (tipo_persona, nombre, apellido, razon_social, documento_nro,
       telefono, telefono_fijo, email, email_alternativo, direccion, localidad, codigo_postal,
       categoria_id, estado, origen, fecha_nacimiento, genero, estado_civil,
       preferencia_contacto, acepta_marketing, referido_por_id, notas, created_by,
       dom_obra, dom_obra_localidad,
       dom_alternativo, dom_alternativo_localidad, dom_alternativo_cp, dom_alternativo_referencia,
       condicion_iva, crm_etapa, interes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
    RETURNING *
  `, [
    body.tipo_persona?.trim()       || 'fisica',
    body.nombre?.trim()             || null,
    body.apellido?.trim()           || null,
    body.razon_social?.trim()       || null,
    body.documento_nro?.trim()      || null,
    body.telefono?.trim()           || null,
    body.telefono_fijo?.trim()      || null,
    body.email?.trim()              || null,
    body.email_alternativo?.trim()  || null,
    body.direccion?.trim()          || null,
    body.localidad?.trim()          || null,
    body.codigo_postal?.trim()      || null,
    body.categoria_id               || null,
    body.estado?.trim()             || 'activo',
    body.origen?.trim()             || null,
    body.fecha_nacimiento           || null,
    body.genero?.trim()             || null,
    body.estado_civil?.trim()       || null,
    body.preferencia_contacto?.trim() || null,
    body.acepta_marketing           ?? true,
    body.referido_por_id            || null,
    body.notas?.trim()              || null,
    user.id,
    body.dom_obra?.trim()               || null,
    body.dom_obra_localidad?.trim()     || null,
    body.dom_alternativo?.trim()        || null,
    body.dom_alternativo_localidad?.trim() || null,
    body.dom_alternativo_cp?.trim()     || null,
    body.dom_alternativo_referencia?.trim() || null,
    body.condicion_iva?.trim()          || null,
    body.crm_etapa?.trim()              || null,
    body.interes?.trim()                || null,
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
      telefono_fijo   = $7,
      email           = $8,
      email_alternativo = $9,
      direccion       = $10,
      localidad       = $11,
      codigo_postal   = $12,
      categoria_id    = $13,
      estado          = $14,
      origen          = $15,
      fecha_nacimiento= $16,
      genero               = $17,
      estado_civil         = $18,
      preferencia_contacto = $19,
      acepta_marketing     = $20,
      referido_por_id      = $21,
      notas                = $22,
      dom_obra             = $23,
      dom_obra_localidad   = $24,
      dom_alternativo              = $25,
      dom_alternativo_localidad    = $26,
      dom_alternativo_cp           = $27,
      dom_alternativo_referencia   = $28,
      condicion_iva                = $29,
      crm_etapa                    = $30,
      interes                      = $31
    WHERE id = $32 RETURNING *
  `, [
    body.tipo_persona?.trim() || 'fisica',
    body.nombre?.trim() || null,
    body.apellido?.trim() || null,
    body.razon_social?.trim() || null,
    body.documento_nro?.trim() || null,
    body.telefono?.trim() || null,
    body.telefono_fijo?.trim() || null,
    body.email?.trim() || null,
    body.email_alternativo?.trim()  || null,
    body.direccion?.trim()          || null,
    body.localidad?.trim()          || null,
    body.codigo_postal?.trim()      || null,
    body.categoria_id               || null,
    body.estado?.trim()             || 'activo',
    body.origen?.trim()             || null,
    body.fecha_nacimiento           || null,
    body.genero?.trim()             || null,
    body.estado_civil?.trim()       || null,
    body.preferencia_contacto?.trim() || null,
    body.acepta_marketing           ?? true,
    body.referido_por_id            || null,
    body.notas?.trim()              || null,
    body.dom_obra?.trim()               || null,
    body.dom_obra_localidad?.trim()     || null,
    body.dom_alternativo?.trim()        || null,
    body.dom_alternativo_localidad?.trim() || null,
    body.dom_alternativo_cp?.trim()     || null,
    body.dom_alternativo_referencia?.trim() || null,
    body.condicion_iva?.trim()          || null,
    body.crm_etapa?.trim()              || null,
    body.interes?.trim()                || null,
    id,
  ]);

  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json(row);
});

clientes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [op] } = await db.query(
    `SELECT COUNT(*) AS n FROM operaciones WHERE cliente_id = $1`, [id]
  );
  if (parseInt(op.n) > 0) {
    return c.json({ error: 'El cliente tiene operaciones asociadas y no puede eliminarse' }, 409);
  }
  const { rows: [row] } = await db.query(
    `DELETE FROM clientes WHERE id = $1 RETURNING id`, [id]
  );
  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404);
  return c.json({ ok: true });
});

export default clientes;
