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
    topClientesResult,
    evolucionResult,
    cumpleanosResult,
    presupuestosSinRespuestaResult,
    ventasSemanalesResult,
    tareasPendientesResult,
    productosConsultadosResult,
  ] = await Promise.all([

    // 1. Pipeline completo
    db.query(`
      SELECT
        c.id, c.nombre, c.apellido, c.razon_social, c.telefono, c.email, c.tipo_persona,
        COALESCE(c.crm_etapa,
          CASE op.estado
            WHEN 'presupuesto'    THEN 'presupuestado'
            WHEN 'enviado'        THEN 'presupuestado'
            WHEN 'aprobado'       THEN 'en_decision'
            WHEN 'en_produccion'  THEN 'en_decision'
            WHEN 'listo'          THEN 'en_decision'
            WHEN 'instalado'      THEN 'cerrado_ganado'
            WHEN 'entregado'      THEN 'cerrado_ganado'
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
            WHEN 'presupuesto'   THEN 'presupuestado'
            WHEN 'enviado'       THEN 'presupuestado'
            WHEN 'aprobado'      THEN 'en_decision'
            WHEN 'en_produccion' THEN 'en_decision'
            WHEN 'listo'         THEN 'en_decision'
            WHEN 'instalado'     THEN 'cerrado_ganado'
            WHEN 'entregado'     THEN 'cerrado_ganado'
          END
        )
          WHEN 'nuevo'         THEN 1
          WHEN 'en_contacto'   THEN 2
          WHEN 'presupuestado' THEN 3
          WHEN 'en_decision'   THEN 4
          WHEN 'postventa'     THEN 5
          ELSE 6
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
        COUNT(*) FILTER (WHERE crm_etapa IN ('cerrado_ganado','cerrado_perdido'))::int AS total_cerrados,
        COUNT(*) FILTER (WHERE activo = true AND (ultima_interaccion >= now() - INTERVAL '30 days' OR crm_etapa IS NOT NULL))::int AS clientes_activos,
        COUNT(*) FILTER (WHERE activo = true AND crm_etapa = 'postventa')::int AS en_postventa
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

    // 4. Tareas de hoy
    db.query(`
      SELECT
        t.id, t.descripcion, t.tipo_accion, t.hora::text, t.prioridad,
        c.nombre, c.apellido, c.razon_social, c.tipo_persona, c.id AS cliente_id,
        c.telefono
      FROM tareas t
      JOIN clientes c ON c.id = t.cliente_id
      WHERE t.vencimiento = CURRENT_DATE AND t.completada = false
      ORDER BY t.hora ASC NULLS LAST, t.prioridad = 'alta' DESC
      LIMIT 15
    `),

    // 5. Origen de leads
    db.query(`
      SELECT
        COALESCE(NULLIF(origen, ''), 'otro') AS origen,
        COUNT(*)::int AS cant
      FROM clientes
      WHERE activo = true AND crm_etapa IS NOT NULL AND crm_etapa != 'cerrado_perdido'
      GROUP BY COALESCE(NULLIF(origen, ''), 'otro')
      ORDER BY cant DESC
    `),

    // 6. Top clientes VIP por valor histórico
    db.query(`
      SELECT
        c.id, c.nombre, c.apellido, c.razon_social, c.tipo_persona,
        c.valor_total_historico::numeric,
        c.operaciones_count,
        COALESCE((
          SELECT COUNT(*) FROM clientes ref WHERE ref.referido_por_id = c.id
        ), 0)::int AS referidos_count
      FROM clientes c
      WHERE c.activo = true AND c.valor_total_historico > 0
      ORDER BY c.valor_total_historico DESC
      LIMIT 5
    `),

    // 7. Evolución ventas por semana (últimas 5 semanas)
    db.query(`
      WITH semanas AS (
        SELECT
          generate_series AS semana_inicio,
          generate_series + INTERVAL '6 days' AS semana_fin,
          'Sem ' || ROW_NUMBER() OVER (ORDER BY generate_series) AS label
        FROM generate_series(
          date_trunc('week', now()) - INTERVAL '4 weeks',
          date_trunc('week', now()),
          '1 week'::interval
        )
      )
      SELECT
        s.label,
        COALESCE(SUM(o.precio_total), 0)::numeric AS ventas
      FROM semanas s
      LEFT JOIN estados_historial eh
        ON eh.estado_nuevo = 'aprobado'
        AND eh.created_at::date BETWEEN s.semana_inicio::date AND s.semana_fin::date
      LEFT JOIN operaciones o ON o.id = eh.operacion_id
      GROUP BY s.label, s.semana_inicio ORDER BY s.semana_inicio
    `),

    // 8. Cumpleaños próximos (7 días)
    db.query(`
      SELECT
        id, nombre, apellido, razon_social, tipo_persona, telefono,
        fecha_nacimiento,
        TO_CHAR(fecha_nacimiento, 'DD') || '/' || TO_CHAR(fecha_nacimiento, 'MM') AS cumple_label,
        CASE
          WHEN TO_CHAR(fecha_nacimiento, 'MMDD') = TO_CHAR(CURRENT_DATE, 'MMDD') THEN 0
          WHEN TO_CHAR(fecha_nacimiento, 'MMDD') > TO_CHAR(CURRENT_DATE, 'MMDD')
            THEN TO_DATE(
              EXTRACT(YEAR FROM CURRENT_DATE)::text || TO_CHAR(fecha_nacimiento, 'MMDD'), 'YYYYMMDD'
            ) - CURRENT_DATE
          ELSE
            TO_DATE(
              (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || TO_CHAR(fecha_nacimiento, 'MMDD'), 'YYYYMMDD'
            ) - CURRENT_DATE
        END AS dias_para_cumple
      FROM clientes
      WHERE activo = true
        AND fecha_nacimiento IS NOT NULL
        AND (
          CASE
            WHEN TO_CHAR(fecha_nacimiento, 'MMDD') = TO_CHAR(CURRENT_DATE, 'MMDD') THEN 0
            WHEN TO_CHAR(fecha_nacimiento, 'MMDD') > TO_CHAR(CURRENT_DATE, 'MMDD')
              THEN TO_DATE(
                EXTRACT(YEAR FROM CURRENT_DATE)::text || TO_CHAR(fecha_nacimiento, 'MMDD'), 'YYYYMMDD'
              ) - CURRENT_DATE
            ELSE
              TO_DATE(
                (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || TO_CHAR(fecha_nacimiento, 'MMDD'), 'YYYYMMDD'
              ) - CURRENT_DATE
          END
        ) <= 7
      ORDER BY dias_para_cumple ASC
      LIMIT 5
    `),

    // 9. Presupuestos sin respuesta (alertas)
    db.query(`
      SELECT
        c.id AS cliente_id, c.nombre, c.apellido, c.razon_social, c.tipo_persona, c.telefono,
        o.id AS op_id, o.numero, o.precio_total,
        FLOOR(EXTRACT(EPOCH FROM (now() - o.updated_at)) / 86400)::int AS dias_sin_respuesta
      FROM operaciones o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.estado IN ('presupuesto', 'enviado')
        AND o.updated_at < now() - INTERVAL '3 days'
      ORDER BY dias_sin_respuesta DESC
      LIMIT 5
    `),

    // 10. Ventas semanales (ya cubierto en query 7, esta es por periodo mes)
    db.query(`
      SELECT
        COALESCE(SUM(o.precio_total), 0)::numeric AS total_mes,
        COUNT(DISTINCT o.id)::int AS cant_ops
      FROM estados_historial eh
      JOIN operaciones o ON o.id = eh.operacion_id
      WHERE eh.estado_nuevo = 'aprobado'
        AND eh.created_at >= date_trunc('month', now())
    `),

    // 11. Tareas pendientes en próximos 7 días
    db.query(`
      SELECT COUNT(*)::int AS total
      FROM tareas
      WHERE completada = false
        AND (vencimiento IS NULL OR vencimiento <= CURRENT_DATE + 7)
    `),

    // 12. Productos más consultados (desde operacion_items)
    db.query(`
      SELECT
        COALESCE(p.nombre, oi.descripcion) AS producto,
        COUNT(DISTINCT o.id)::int AS presupuestos,
        COUNT(DISTINCT CASE WHEN o.estado IN ('aprobado','en_produccion','listo','instalado','entregado') THEN o.id END)::int AS ventas
      FROM operacion_items oi
      LEFT JOIN catalogo_productos p ON p.id = oi.producto_id
      JOIN operaciones o ON o.id = oi.operacion_id
      WHERE o.created_at >= now() - INTERVAL '90 days'
      GROUP BY COALESCE(p.nombre, oi.descripcion)
      ORDER BY presupuestos DESC
      LIMIT 5
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
    postventa:     allClients.filter(c => c.crm_etapa === 'postventa'),
  };

  const k = kpisResult.rows[0] as any;
  const v = ventasResult.rows[0] as any;
  const vm = ventasSemanalesResult.rows[0] as any;
  const leadsNuevos = Number(k?.leads_nuevos ?? 0);
  const leadsNuevosPrev = Number(k?.leads_nuevos_prev ?? 0);
  const ventasMes = Number(v?.ventas_mes ?? 0);
  const ventasMesPrev = Number(v?.ventas_mes_prev ?? 0);
  const ventasCerradas = Number(k?.ventas_cerradas ?? 0);
  const totalCerrados = Number(k?.total_cerrados ?? 0);

  const pct = (cur: number, prev: number) =>
    prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);

  const totalPipeline = allClients.filter(c => !['cerrado_perdido'].includes(c.crm_etapa)).length;

  // Oportunidades inactivas (sin contacto > 7 días, en pipeline activo)
  const oportunidadesInactivas = allClients
    .filter(c => !['cerrado_ganado','cerrado_perdido'].includes(c.crm_etapa) && c.dias_sin_contacto > 7)
    .slice(0, 8);

  // Embudo
  const embudo = [
    { etapa: 'Leads totales',  count: allClients.length, pct: 100 },
    { etapa: 'En seguimiento', count: pipeline.en_contacto.length, pct: allClients.length > 0 ? Math.round(pipeline.en_contacto.length / allClients.length * 100) : 0 },
    { etapa: 'Presupuestados', count: pipeline.presupuestado.length, pct: allClients.length > 0 ? Math.round(pipeline.presupuestado.length / allClients.length * 100) : 0 },
    { etapa: 'En decisión',    count: pipeline.en_decision.length, pct: allClients.length > 0 ? Math.round(pipeline.en_decision.length / allClients.length * 100) : 0 },
    { etapa: 'Cerrados',       count: pipeline.cerrado.length, pct: allClients.length > 0 ? Math.round(pipeline.cerrado.length / allClients.length * 100) : 0 },
  ];

  return c.json({
    kpis: {
      leads_nuevos:         leadsNuevos,
      leads_nuevos_vs:      pct(leadsNuevos, leadsNuevosPrev),
      en_seguimiento:       Number(k?.en_seguimiento ?? 0),
      presupuestados:       Number(k?.presupuestados ?? 0),
      ventas_cerradas:      ventasCerradas,
      tasa_cierre:          totalCerrados > 0 ? Math.round(ventasCerradas / totalCerrados * 100) : 0,
      ventas_totales:       ventasMes,
      ventas_vs_anterior:   pct(ventasMes, ventasMesPrev),
      clientes_activos:     Number(k?.clientes_activos ?? 0),
      en_postventa:         Number(k?.en_postventa ?? 0),
      tareas_pendientes:    Number(tareasPendientesResult.rows[0]?.total ?? 0),
      facturacion_mes:      Number(vm?.total_mes ?? ventasMes),
      facturacion_mes_ops:  Number(vm?.cant_ops ?? 0),
    },
    pipeline,
    embudo,
    seguimientos_hoy:         seguimientosResult.rows,
    origen_leads:             origenResult.rows,
    top_clientes:             topClientesResult.rows,
    ventas_semanales:         evolucionResult.rows,
    cumpleanos_proximos:      cumpleanosResult.rows,
    presupuestos_sin_respuesta: presupuestosSinRespuestaResult.rows,
    oportunidades_inactivas:  oportunidadesInactivas,
    productos_consultados:    productosConsultadosResult.rows,
    total_pipeline:           totalPipeline,
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
  const validas = ['nuevo','en_contacto','presupuestado','en_decision','cerrado_ganado','cerrado_perdido','postventa'];
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

// ── Registrar contacto ────────────────────────────────────────────────────────

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
