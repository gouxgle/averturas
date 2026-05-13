import { Hono } from 'hono';
import { db } from '../db.js';

const crm = new Hono();

// ── Tablero principal ─────────────────────────────────────────────────────────

crm.get('/tablero', async (c) => {
  const [
    pipelineResult,
    kpisResult,
    ventasResult,
    seguimientosResult,
    origenResult,
    productosResult,
    topClientesResult,
    evolucionResult,
    evolucionPrevResult,
  ] = await Promise.all([

    // 1. Pipeline: clientes con etapa asignada + inferida de última operación
    db.query(`
      SELECT
        c.id, c.nombre, c.apellido, c.razon_social, c.telefono, c.email,
        COALESCE(c.crm_etapa,
          CASE op.estado
            WHEN 'presupuesto' THEN 'presupuestado'
            WHEN 'enviado'     THEN 'presupuestado'
            WHEN 'aprobado'    THEN 'en_decision'
            WHEN 'en_produccion' THEN 'en_decision'
            WHEN 'listo'       THEN 'en_decision'
            WHEN 'instalado'   THEN 'cerrado_ganado'
            WHEN 'entregado'   THEN 'cerrado_ganado'
          END
        ) AS crm_etapa,
        c.interes, c.producto_interes, c.monto_estimado,
        c.probabilidad, c.motivo_perdida, c.origen, c.ultima_interaccion,
        c.valor_total_historico, c.proxima_accion, c.proxima_accion_fecha,
        CASE
          WHEN c.ultima_interaccion IS NULL THEN 999
          ELSE FLOOR(EXTRACT(EPOCH FROM (now() - c.ultima_interaccion)) / 86400)
        END::int AS dias_sin_contacto,
        u.nombre AS asignado_nombre,
        op.precio_total  AS ultimo_op_monto,
        op.estado        AS ultimo_op_estado,
        op.created_at    AS ultimo_op_fecha,
        op.fecha_validez AS ultimo_op_validez
      FROM clientes c
      LEFT JOIN usuarios u ON u.id = c.asignado_a
      LEFT JOIN LATERAL (
        SELECT o.precio_total, o.estado, o.created_at, o.fecha_validez
        FROM operaciones o
        WHERE o.cliente_id = c.id
        ORDER BY o.created_at DESC
        LIMIT 1
      ) op ON true
      WHERE c.activo = true
        AND (
          c.crm_etapa IS NOT NULL
          OR op.estado IN ('presupuesto','enviado','aprobado','en_produccion','listo','instalado','entregado')
        )
      ORDER BY
        CASE COALESCE(c.crm_etapa,
          CASE op.estado
            WHEN 'presupuesto' THEN 'presupuestado'
            WHEN 'enviado'     THEN 'presupuestado'
            WHEN 'aprobado'    THEN 'en_decision'
            WHEN 'en_produccion' THEN 'en_decision'
            WHEN 'listo'       THEN 'en_decision'
            WHEN 'instalado'   THEN 'cerrado_ganado'
            WHEN 'entregado'   THEN 'cerrado_ganado'
          END
        )
          WHEN 'nuevo'        THEN 1
          WHEN 'en_contacto'  THEN 2
          WHEN 'presupuestado' THEN 3
          WHEN 'en_decision'  THEN 4
          ELSE 5
        END,
        c.ultima_interaccion DESC NULLS LAST
    `),

    // 2. KPIs del pipeline
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE crm_etapa = 'nuevo'
          AND created_at >= date_trunc('month', now()))::int AS leads_nuevos,
        COUNT(*) FILTER (WHERE crm_etapa = 'nuevo'
          AND created_at >= date_trunc('month', now()) - INTERVAL '1 month'
          AND created_at < date_trunc('month', now()))::int AS leads_nuevos_prev,
        COUNT(*) FILTER (WHERE crm_etapa IN ('en_contacto','presupuestado','en_decision'))::int AS en_seguimiento,
        COUNT(*) FILTER (WHERE crm_etapa = 'presupuestado')::int AS presupuestados,
        COUNT(*) FILTER (WHERE crm_etapa = 'cerrado_ganado')::int AS ventas_cerradas,
        COUNT(*) FILTER (WHERE crm_etapa IN ('cerrado_ganado','cerrado_perdido'))::int AS total_cerrados
      FROM clientes WHERE activo = true
    `),

    // 3. Ventas del mes actual y anterior
    db.query(`
      SELECT
        COALESCE(SUM(o.precio_total) FILTER (
          WHERE eh.created_at >= date_trunc('month', now())
        ), 0)::numeric AS ventas_mes,
        COALESCE(SUM(o.precio_total) FILTER (
          WHERE eh.created_at >= date_trunc('month', now()) - INTERVAL '1 month'
            AND eh.created_at < date_trunc('month', now())
        ), 0)::numeric AS ventas_mes_prev
      FROM estados_historial eh
      JOIN operaciones o ON o.id = eh.operacion_id
      WHERE eh.estado_nuevo = 'aprobado'
        AND eh.created_at >= date_trunc('month', now()) - INTERVAL '1 month'
    `),

    // 4. Seguimientos de hoy
    db.query(`
      SELECT
        t.id, t.descripcion, t.tipo_accion, t.hora::text, t.prioridad,
        c.nombre, c.apellido, c.razon_social, c.id AS cliente_id
      FROM tareas t
      JOIN clientes c ON c.id = t.cliente_id
      WHERE t.vencimiento = CURRENT_DATE AND t.completada = false
      ORDER BY t.hora ASC NULLS LAST, t.prioridad = 'alta' DESC
      LIMIT 10
    `),

    // 5. Origen de leads (activos en pipeline)
    db.query(`
      SELECT
        COALESCE(NULLIF(origen, ''), 'otro') AS origen,
        COUNT(*)::int AS cant
      FROM clientes
      WHERE activo = true AND crm_etapa IS NOT NULL AND crm_etapa != 'cerrado_perdido'
      GROUP BY COALESCE(NULLIF(origen, ''), 'otro')
      ORDER BY cant DESC
    `),

    // 6. Productos más consultados
    db.query(`
      SELECT
        producto_interes AS producto,
        COUNT(*)::int AS cant
      FROM clientes
      WHERE activo = true AND crm_etapa IS NOT NULL AND producto_interes IS NOT NULL AND producto_interes != ''
      GROUP BY producto_interes
      ORDER BY cant DESC
      LIMIT 5
    `),

    // 7. Top clientes por valor histórico
    db.query(`
      SELECT id, nombre, apellido, razon_social, valor_total_historico::numeric, operaciones_count
      FROM clientes
      WHERE activo = true AND valor_total_historico > 0
      ORDER BY valor_total_historico DESC
      LIMIT 5
    `),

    // 8. Evolución ventas mes actual (diario)
    db.query(`
      WITH aprobaciones AS (
        SELECT DISTINCT ON (o.id) o.id, eh.created_at::date AS fecha, o.precio_total
        FROM estados_historial eh
        JOIN operaciones o ON o.id = eh.operacion_id
        WHERE eh.estado_nuevo = 'aprobado'
          AND eh.created_at::date >= date_trunc('month', now())::date
        ORDER BY o.id, eh.created_at ASC
      )
      SELECT gs::date AS fecha, COALESCE(SUM(a.precio_total), 0)::numeric AS ventas
      FROM generate_series(date_trunc('month', now())::date, now()::date, '1 day'::interval) gs
      LEFT JOIN aprobaciones a ON a.fecha = gs::date
      GROUP BY gs ORDER BY gs
    `),

    // 9. Evolución ventas mes anterior
    db.query(`
      WITH aprobaciones AS (
        SELECT DISTINCT ON (o.id) o.id, eh.created_at::date AS fecha, o.precio_total
        FROM estados_historial eh
        JOIN operaciones o ON o.id = eh.operacion_id
        WHERE eh.estado_nuevo = 'aprobado'
          AND eh.created_at::date >= (date_trunc('month', now()) - INTERVAL '1 month')::date
          AND eh.created_at::date < date_trunc('month', now())::date
        ORDER BY o.id, eh.created_at ASC
      )
      SELECT gs::date AS fecha, COALESCE(SUM(a.precio_total), 0)::numeric AS ventas
      FROM generate_series(
        (date_trunc('month', now()) - INTERVAL '1 month')::date,
        (date_trunc('month', now()) - INTERVAL '1 day')::date,
        '1 day'::interval
      ) gs
      LEFT JOIN aprobaciones a ON a.fecha = gs::date
      GROUP BY gs ORDER BY gs
    `),
  ]);

  // Procesar pipeline por etapa
  const allClients = pipelineResult.rows as any[];
  const pipeline = {
    nuevo:         allClients.filter(c => c.crm_etapa === 'nuevo'),
    en_contacto:   allClients.filter(c => c.crm_etapa === 'en_contacto'),
    presupuestado: allClients.filter(c => c.crm_etapa === 'presupuestado'),
    en_decision:   allClients.filter(c => c.crm_etapa === 'en_decision'),
    cerrado:       allClients.filter(c => ['cerrado_ganado','cerrado_perdido'].includes(c.crm_etapa)),
  };

  const k = kpisResult.rows[0] as any;
  const v = ventasResult.rows[0] as any;
  const leadsNuevos = Number(k?.leads_nuevos ?? 0);
  const leadsNuevosPrev = Number(k?.leads_nuevos_prev ?? 0);
  const ventasMes = Number(v?.ventas_mes ?? 0);
  const ventasMesPrev = Number(v?.ventas_mes_prev ?? 0);
  const ventasCerradas = Number(k?.ventas_cerradas ?? 0);
  const totalCerrados = Number(k?.total_cerrados ?? 0);

  const pct = (cur: number, prev: number) =>
    prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);

  // Embudo: conteos para visualización
  const totalPipeline = allClients.filter(c => c.crm_etapa !== 'cerrado_perdido').length;
  const embudo = [
    { etapa: 'Leads totales',  count: allClients.length, pct: 100 },
    { etapa: 'En seguimiento', count: pipeline.en_contacto.length, pct: allClients.length > 0 ? Math.round(pipeline.en_contacto.length / allClients.length * 100) : 0 },
    { etapa: 'Presupuestados', count: pipeline.presupuestado.length, pct: allClients.length > 0 ? Math.round(pipeline.presupuestado.length / allClients.length * 100) : 0 },
    { etapa: 'En decisión',    count: pipeline.en_decision.length, pct: allClients.length > 0 ? Math.round(pipeline.en_decision.length / allClients.length * 100) : 0 },
    { etapa: 'Cerrados',       count: pipeline.cerrado.length, pct: allClients.length > 0 ? Math.round(pipeline.cerrado.length / allClients.length * 100) : 0 },
  ];

  // Evolución chart
  const evolucion = evolucionResult.rows.map((row: any, i: number) => ({
    fecha:    String(row.fecha).slice(0, 10),
    actual:   Number(row.ventas),
    anterior: Number(evolucionPrevResult.rows[i]?.ventas ?? 0),
  }));

  return c.json({
    kpis: {
      leads_nuevos:          leadsNuevos,
      leads_nuevos_vs:       pct(leadsNuevos, leadsNuevosPrev),
      en_seguimiento:        Number(k?.en_seguimiento ?? 0),
      presupuestados:        Number(k?.presupuestados ?? 0),
      ventas_cerradas:       ventasCerradas,
      tasa_cierre:           totalCerrados > 0 ? Math.round(ventasCerradas / totalCerrados * 100) : 0,
      ventas_totales:        ventasMes,
      ventas_vs_anterior:    pct(ventasMes, ventasMesPrev),
    },
    pipeline,
    embudo,
    seguimientos_hoy: seguimientosResult.rows,
    origen_leads:     origenResult.rows,
    top_productos:    productosResult.rows,
    top_clientes:     topClientesResult.rows,
    evolucion,
    ultimas_oportunidades: allClients
      .filter(c => !['cerrado_ganado','cerrado_perdido'].includes(c.crm_etapa))
      .slice(0, 6),
    total_pipeline: totalPipeline,
  });
});

// ── Nuevo lead ────────────────────────────────────────────────────────────────

crm.post('/leads', async (c) => {
  const b = await c.req.json();
  if (!b.nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(`
    INSERT INTO clientes
      (nombre, apellido, telefono, origen, crm_etapa, interes, producto_interes, monto_estimado, estado, notas)
    VALUES ($1, $2, $3, $4, 'nuevo', $5, $6, $7, 'prospecto', $8)
    RETURNING *
  `, [
    b.nombre.trim(), b.apellido || null, b.telefono || null,
    b.origen || null, b.interes || 'medio', b.producto_interes || null,
    b.monto_estimado ? parseFloat(b.monto_estimado) : null, b.notas || null,
  ]);
  return c.json(rows[0], 201);
});

// ── Mover etapa ───────────────────────────────────────────────────────────────

crm.patch('/clientes/:id/etapa', async (c) => {
  const { etapa, motivo_perdida } = await c.req.json();
  const validas = ['nuevo','en_contacto','presupuestado','en_decision','cerrado_ganado','cerrado_perdido'];
  if (!validas.includes(etapa)) return c.json({ error: 'etapa inválida' }, 400);

  const estadoMap: Record<string, string> = {
    cerrado_ganado:  'activo',
    cerrado_perdido: 'perdido',
  };

  const { rows } = await db.query(`
    UPDATE clientes SET
      crm_etapa      = $1,
      motivo_perdida = $2,
      estado         = COALESCE($3, estado),
      updated_at     = now()
    WHERE id = $4 RETURNING *
  `, [etapa, motivo_perdida || null, estadoMap[etapa] || null, c.req.param('id')]);

  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

// ── Actualizar info CRM ───────────────────────────────────────────────────────

crm.patch('/clientes/:id', async (c) => {
  const b = await c.req.json();
  const { rows } = await db.query(`
    UPDATE clientes SET
      interes              = COALESCE($1, interes),
      producto_interes     = $2,
      monto_estimado       = $3,
      probabilidad         = COALESCE($4, probabilidad),
      proxima_accion       = $5,
      proxima_accion_fecha = $6,
      asignado_a           = $7,
      updated_at           = now()
    WHERE id = $8 RETURNING *
  `, [
    b.interes || null, b.producto_interes || null,
    b.monto_estimado !== undefined ? (b.monto_estimado ? parseFloat(b.monto_estimado) : null) : undefined,
    b.probabilidad || null, b.proxima_accion || null,
    b.proxima_accion_fecha || null, b.asignado_a || null,
    c.req.param('id'),
  ]);
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

// ── Registrar contacto (interacción + tarea opcional) ─────────────────────────

crm.post('/contacto', async (c) => {
  const b = await c.req.json();
  if (!b.cliente_id || !b.descripcion?.trim()) return c.json({ error: 'cliente_id y descripcion requeridos' }, 400);

  const [intResult] = await Promise.all([
    db.query(`
      INSERT INTO interacciones (cliente_id, tipo, descripcion)
      VALUES ($1, $2, $3) RETURNING *
    `, [b.cliente_id, b.tipo || 'nota', b.descripcion.trim()]),
  ]);

  if (b.tarea_descripcion?.trim() && b.tarea_vencimiento) {
    await db.query(`
      INSERT INTO tareas (cliente_id, descripcion, vencimiento, prioridad, tipo_accion, hora)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      b.cliente_id, b.tarea_descripcion.trim(), b.tarea_vencimiento,
      b.tarea_prioridad || 'normal', b.tarea_tipo || 'nota',
      b.tarea_hora || null,
    ]);
  }

  return c.json(intResult.rows[0], 201);
});

// ── Completar tarea ───────────────────────────────────────────────────────────

crm.patch('/tareas/:id/completar', async (c) => {
  const { rows } = await db.query(`
    UPDATE tareas SET completada = true, completada_at = now()
    WHERE id = $1 RETURNING *
  `, [c.req.param('id')]);
  if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
  return c.json(rows[0]);
});

export default crm;
