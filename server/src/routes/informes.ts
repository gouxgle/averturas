import { Hono } from 'hono';
import { db } from '../db.js';

const informes = new Hono();

informes.get('/resumen', async (c) => {
  const ahora = new Date();
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const desde = c.req.query('desde') ?? primerDiaMes.toISOString().slice(0, 10);
  const hasta = c.req.query('hasta') ?? ahora.toISOString().slice(0, 10);

  // Período anterior (misma duración, inmediatamente antes)
  const desdeDate = new Date(desde + 'T12:00:00');
  const hastaDate = new Date(hasta + 'T12:00:00');
  const duracionMs = hastaDate.getTime() - desdeDate.getTime() + 86400000;
  const desdePrev = new Date(desdeDate.getTime() - duracionMs).toISOString().slice(0, 10);
  const hastaPrev = new Date(desdeDate.getTime() - 86400000).toISOString().slice(0, 10);

  const [
    statsResult,
    statsPrevResult,
    evolucionResult,
    evolucionPrevResult,
    comercialResult,
    finanzasResult,
    topTiposResult,
    stockCountsResult,
    opsEstadosResult,
    comprasResult,
    topClientesResult,
    metodospagoResult,
    objetivoResult,
  ] = await Promise.all([

    // 1. KPIs principales (período actual)
    db.query(`
      SELECT
        (SELECT COALESCE(SUM(o.precio_total), 0)::numeric
         FROM estados_historial eh JOIN operaciones o ON o.id = eh.operacion_id
         WHERE eh.estado_nuevo = 'aprobado' AND eh.created_at::date BETWEEN $1::date AND $2::date
        ) AS ventas_periodo,
        (SELECT COALESCE(SUM(monto_total), 0)::numeric FROM recibos
         WHERE estado = 'emitido' AND fecha BETWEEN $1::date AND $2::date
        ) AS cobrado_periodo,
        (SELECT COALESCE(SUM(monto), 0)::numeric FROM compromisos_pago WHERE estado = 'pendiente') AS pendiente_cobro,
        (SELECT COUNT(*)::int FROM catalogo_productos cp
         WHERE cp.activo = true AND cp.stock_minimo > 0
           AND (cp.stock_inicial + COALESCE(
             (SELECT SUM(sm.cantidad) FROM stock_movimientos sm WHERE sm.producto_id = cp.id), 0
           )) <= cp.stock_minimo
        ) AS stock_critico,
        (SELECT COUNT(*)::int FROM remitos
         WHERE estado = 'emitido' AND fecha_entrega_est IS NOT NULL AND fecha_entrega_est < CURRENT_DATE
        ) AS entregas_atrasadas
    `, [desde, hasta]),

    // 2. KPIs período anterior (solo ventas y cobrado para % cambio)
    db.query(`
      SELECT
        (SELECT COALESCE(SUM(o.precio_total), 0)::numeric
         FROM estados_historial eh JOIN operaciones o ON o.id = eh.operacion_id
         WHERE eh.estado_nuevo = 'aprobado' AND eh.created_at::date BETWEEN $1::date AND $2::date
        ) AS ventas_periodo,
        (SELECT COALESCE(SUM(monto_total), 0)::numeric FROM recibos
         WHERE estado = 'emitido' AND fecha BETWEEN $1::date AND $2::date
        ) AS cobrado_periodo
    `, [desdePrev, hastaPrev]),

    // 3. Evolución diaria actual (para chart)
    db.query(`
      WITH aprobaciones AS (
        SELECT DISTINCT ON (o.id) o.id, eh.created_at::date AS fecha, o.precio_total
        FROM estados_historial eh
        JOIN operaciones o ON o.id = eh.operacion_id
        WHERE eh.estado_nuevo = 'aprobado' AND eh.created_at::date BETWEEN $1::date AND $2::date
        ORDER BY o.id, eh.created_at ASC
      )
      SELECT gs::date AS fecha, COALESCE(SUM(a.precio_total), 0)::numeric AS ventas
      FROM generate_series($1::date, $2::date, '1 day'::interval) gs
      LEFT JOIN aprobaciones a ON a.fecha = gs::date
      GROUP BY gs ORDER BY gs
    `, [desde, hasta]),

    // 4. Evolución diaria período anterior
    db.query(`
      WITH aprobaciones AS (
        SELECT DISTINCT ON (o.id) o.id, eh.created_at::date AS fecha, o.precio_total
        FROM estados_historial eh
        JOIN operaciones o ON o.id = eh.operacion_id
        WHERE eh.estado_nuevo = 'aprobado' AND eh.created_at::date BETWEEN $1::date AND $2::date
        ORDER BY o.id, eh.created_at ASC
      )
      SELECT gs::date AS fecha, COALESCE(SUM(a.precio_total), 0)::numeric AS ventas
      FROM generate_series($1::date, $2::date, '1 day'::interval) gs
      LEFT JOIN aprobaciones a ON a.fecha = gs::date
      GROUP BY gs ORDER BY gs
    `, [desdePrev, hastaPrev]),

    // 5. Bloque Comercial
    db.query(`
      SELECT
        COUNT(*)::int AS total_generados,
        COUNT(*) FILTER (WHERE estado NOT IN ('presupuesto','enviado','cancelado'))::int AS aprobados,
        COUNT(*) FILTER (WHERE estado = 'cancelado')::int AS cancelados,
        COUNT(*) FILTER (WHERE estado IN ('presupuesto','enviado'))::int AS en_proceso
      FROM operaciones
      WHERE created_at::date BETWEEN $1::date AND $2::date
    `, [desde, hasta]),

    // 6. Bloque Finanzas
    db.query(`
      SELECT
        (SELECT COALESCE(SUM(monto), 0)::numeric FROM compromisos_pago
         WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE) AS vencido,
        (SELECT ROUND(COALESCE(AVG(
           EXTRACT(EPOCH FROM (r.fecha::timestamp - o.created_at)) / 86400
         ), 0)::numeric, 1)
         FROM recibos r JOIN operaciones o ON o.id = r.operacion_id
         WHERE r.estado = 'emitido' AND r.fecha BETWEEN $1::date AND $2::date
        ) AS dias_promedio_cobro
    `, [desde, hasta]),

    // 7. Top tipos abertura por ventas en el período
    db.query(`
      SELECT
        COALESCE(ta.nombre, 'Sin clasificar') AS tipo,
        COALESCE(SUM(
          oi.precio_unitario * oi.cantidad
          + CASE WHEN oi.incluye_instalacion THEN COALESCE(oi.precio_instalacion,0) * oi.cantidad ELSE 0 END
        ), 0)::numeric AS monto_total,
        COALESCE(SUM(oi.cantidad), 0)::int AS cant_total
      FROM estados_historial eh
      JOIN operaciones o ON o.id = eh.operacion_id
      JOIN operacion_items oi ON oi.operacion_id = o.id
      LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
      WHERE eh.estado_nuevo = 'aprobado' AND eh.created_at::date BETWEEN $1::date AND $2::date
      GROUP BY ta.nombre
      ORDER BY monto_total DESC
      LIMIT 5
    `, [desde, hasta]),

    // 8. Conteos de stock
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM catalogo_productos cp
         WHERE cp.activo = true
           AND NOT EXISTS (
             SELECT 1 FROM stock_movimientos sm
             WHERE sm.producto_id = cp.id AND sm.tipo LIKE 'egreso%'
               AND sm.created_at >= now() - INTERVAL '30 days'
           )
        ) AS sin_movimiento_30d,
        (SELECT COUNT(*)::int FROM catalogo_productos cp
         WHERE cp.activo = true AND cp.stock_minimo > 0
           AND (cp.stock_inicial + COALESCE(
             (SELECT SUM(sm.cantidad) FROM stock_movimientos sm WHERE sm.producto_id = cp.id), 0
           )) <= 0
        ) AS sin_stock
    `),

    // 9. Operaciones estados + cumplimiento remitos
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM operaciones WHERE estado = 'en_produccion') AS en_produccion,
        (SELECT COUNT(*)::int FROM operaciones WHERE estado = 'listo') AS listo,
        (SELECT COUNT(*)::int FROM operaciones
         WHERE estado IN ('en_produccion','listo')
           AND fecha_entrega_estimada IS NOT NULL AND fecha_entrega_estimada < CURRENT_DATE
        ) AS atrasadas,
        (SELECT COUNT(*)::int FROM remitos
         WHERE fecha_emision BETWEEN $1::date AND $2::date AND estado != 'cancelado') AS remitos_total,
        (SELECT COUNT(*)::int FROM remitos
         WHERE fecha_emision BETWEEN $1::date AND $2::date AND estado = 'entregado') AS remitos_entregados,
        (SELECT ROUND(COALESCE(AVG(
           EXTRACT(EPOCH FROM ((fecha_entrega_real::timestamp) - (fecha_emision::timestamp))) / 86400
         ), 0)::numeric, 1)
         FROM remitos
         WHERE fecha_emision BETWEEN $1::date AND $2::date
           AND estado = 'entregado' AND fecha_entrega_real IS NOT NULL
        ) AS dias_promedio_entrega
    `, [desde, hasta]),

    // 10. Compras del período
    db.query(`
      SELECT
        COALESCE(SUM(sm.cantidad * COALESCE(sm.costo_unitario, 0)), 0)::numeric AS compras_periodo,
        (SELECT COALESCE(SUM(deuda_actual), 0)::numeric FROM proveedores WHERE activo = true) AS deuda_proveedores
      FROM stock_lotes l
      JOIN stock_movimientos sm ON sm.lote_id = l.id AND sm.tipo = 'ingreso'
      WHERE l.fecha_ingreso::date BETWEEN $1::date AND $2::date
    `, [desde, hasta]),

    // 11. Top clientes
    db.query(`
      SELECT
        c.id, c.nombre, c.apellido, c.razon_social,
        COALESCE(SUM(o.precio_total), 0)::numeric AS total_ventas,
        COUNT(DISTINCT o.id)::int AS cant_ops
      FROM estados_historial eh
      JOIN operaciones o ON o.id = eh.operacion_id
      JOIN clientes c ON c.id = o.cliente_id
      WHERE eh.estado_nuevo = 'aprobado' AND eh.created_at::date BETWEEN $1::date AND $2::date
      GROUP BY c.id, c.nombre, c.apellido, c.razon_social
      ORDER BY total_ventas DESC
      LIMIT 5
    `, [desde, hasta]),

    // 12. Métodos de pago cobrado
    db.query(`
      SELECT
        forma_pago,
        COUNT(*)::int AS cant,
        COALESCE(SUM(monto_total), 0)::numeric AS monto_total
      FROM recibos
      WHERE estado = 'emitido' AND fecha BETWEEN $1::date AND $2::date
      GROUP BY forma_pago
      ORDER BY monto_total DESC
    `, [desde, hasta]),

    // 13. Objetivo ventas mensual
    db.query(`SELECT COALESCE(objetivo_ventas_mensual, 0)::numeric AS objetivo FROM empresa LIMIT 1`),
  ]);

  const pct = (cur: number, prev: number) =>
    prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);

  const stats    = statsResult.rows[0]    as any;
  const statsPrev = statsPrevResult.rows[0] as any;

  const ventas_periodo   = Number(stats?.ventas_periodo   ?? 0);
  const ventas_prev      = Number(statsPrev?.ventas_periodo ?? 0);
  const cobrado_periodo  = Number(stats?.cobrado_periodo  ?? 0);
  const cobrado_prev     = Number(statsPrev?.cobrado_periodo ?? 0);

  // Chart: alinear por índice (día 0, 1, 2...)
  const evolucion = evolucionResult.rows.map((row: any, i: number) => ({
    fecha:    String(row.fecha).slice(0, 10),
    actual:   Number(row.ventas),
    anterior: Number(evolucionPrevResult.rows[i]?.ventas ?? 0),
  }));

  // Comercial
  const com = comercialResult.rows[0] as any;
  const total_gen = Number(com?.total_generados ?? 0);
  const aprobados = Number(com?.aprobados ?? 0);
  const tasa_cierre = total_gen > 0 ? Math.round(aprobados / total_gen * 100) : 0;

  // Operaciones
  const ops = opsEstadosResult.rows[0] as any;
  const remitos_total      = Number(ops?.remitos_total ?? 0);
  const remitos_entregados = Number(ops?.remitos_entregados ?? 0);
  const cumplimiento_pct   = remitos_total > 0 ? Math.round(remitos_entregados / remitos_total * 100) : 100;

  const fin     = finanzasResult.rows[0] as any;
  const compras = comprasResult.rows[0]  as any;

  const objetivo_ventas    = Number(objetivoResult.rows[0]?.objetivo ?? 0);
  const cumplimiento_obj   = objetivo_ventas > 0 ? Math.round(ventas_periodo / objetivo_ventas * 100) : 0;

  // Alertas dinámicas
  const alertas: Array<{ tipo: string; mensaje: string; accion: string; ruta: string }> = [];

  if (Number(stats?.entregas_atrasadas ?? 0) > 0) {
    const n = stats.entregas_atrasadas;
    alertas.push({ tipo: 'entregas', mensaje: `${n} ${n === 1 ? 'entrega atrasada' : 'entregas atrasadas'} — fecha estimada vencida`, accion: 'Ver remitos', ruta: '/remitos' });
  }
  if (Number(fin?.vencido ?? 0) > 0) {
    alertas.push({ tipo: 'deuda', mensaje: `$${Number(fin.vencido).toLocaleString('es-AR')} en compromisos de pago vencidos`, accion: 'Ver cobranzas', ruta: '/estado-cuenta' });
  }
  if (Number(stats?.stock_critico ?? 0) > 0) {
    const n = stats.stock_critico;
    alertas.push({ tipo: 'stock', mensaje: `${n} ${n === 1 ? 'producto' : 'productos'} bajo el stock mínimo`, accion: 'Ver stock', ruta: '/stock' });
  }
  if (cobrado_prev > 0 && pct(cobrado_periodo, cobrado_prev) < -10) {
    alertas.push({ tipo: 'cobro', mensaje: `La cobranza bajó un ${Math.abs(pct(cobrado_periodo, cobrado_prev))}% vs el período anterior`, accion: 'Ver recibos', ruta: '/recibos' });
  }

  return c.json({
    periodo: { desde, hasta },
    kpis: {
      ventas_periodo,
      ventas_vs_anterior:   pct(ventas_periodo, ventas_prev),
      cobrado_periodo,
      cobrado_vs_anterior:  pct(cobrado_periodo, cobrado_prev),
      pendiente_cobro:      Number(stats?.pendiente_cobro  ?? 0),
      stock_critico:        Number(stats?.stock_critico     ?? 0),
      entregas_atrasadas:   Number(stats?.entregas_atrasadas ?? 0),
      tasa_cierre,
    },
    evolucion,
    comercial: {
      total_generados: total_gen,
      aprobados,
      cancelados:  Number(com?.cancelados ?? 0),
      en_proceso:  Number(com?.en_proceso ?? 0),
      tasa_cierre,
    },
    finanzas: {
      cobrado:             cobrado_periodo,
      pendiente:           Number(stats?.pendiente_cobro ?? 0),
      vencido:             Number(fin?.vencido ?? 0),
      dias_promedio_cobro: Number(fin?.dias_promedio_cobro ?? 0),
    },
    top_tipos: topTiposResult.rows.map((r: any) => ({
      tipo:        r.tipo,
      monto_total: Number(r.monto_total),
      cant_total:  r.cant_total,
    })),
    stock_counts: {
      critico:            Number(stats?.stock_critico ?? 0),
      sin_movimiento_30d: Number(stockCountsResult.rows[0]?.sin_movimiento_30d ?? 0),
      sin_stock:          Number(stockCountsResult.rows[0]?.sin_stock ?? 0),
    },
    operaciones: {
      en_produccion:        Number(ops?.en_produccion ?? 0),
      listo:                Number(ops?.listo ?? 0),
      atrasadas:            Number(ops?.atrasadas ?? 0),
      remitos_total,
      remitos_entregados,
      cumplimiento_pct,
      dias_promedio_entrega: Number(ops?.dias_promedio_entrega ?? 0),
    },
    compras: {
      compras_periodo:    Number(compras?.compras_periodo ?? 0),
      deuda_proveedores:  Number(compras?.deuda_proveedores ?? 0),
    },
    top_clientes: topClientesResult.rows.map((r: any) => ({
      id:           r.id,
      nombre:       r.nombre,
      apellido:     r.apellido,
      razon_social: r.razon_social,
      total_ventas: Number(r.total_ventas),
      cant_ops:     r.cant_ops,
    })),
    metodos_pago: metodospagoResult.rows.map((r: any) => ({
      forma_pago:  r.forma_pago,
      cant:        r.cant,
      monto_total: Number(r.monto_total),
    })),
    objetivo: {
      objetivo_ventas,
      ventas_actuales:  ventas_periodo,
      cumplimiento_pct: cumplimiento_obj,
    },
    alertas,
  });
});

export default informes;
