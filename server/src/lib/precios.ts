import { db } from '../db.js';

// Revisión integral de precios: análisis de cada producto y sugerencia (funciones puras, se
// prueban solas) + la consulta que junta los datos.
//
// Criterio (aberturas, inflación, insumos atados al dólar):
// · Costo de reposición = lo que cuesta volver a comprarlo hoy: el mayor entre el costo
//   cargado, el de la lista vigente del proveedor y el de la última compra (si es posterior a
//   la última actualización del precio y no es un dato absurdo).
// · Precio sugerido = el mayor entre (a) costo de reposición × (1 + recargo de referencia) y
//   (b) precio actual × variación del dólar blue desde la última actualización. Se toma el
//   mayor y no la suma: si el costo ya subió por el dólar, sumar sería contarlo dos veces.
// · Recargo de referencia = el objetivo configurado (producto → familia → proveedor); si no
//   hay ninguno, el recargo que el producto ya tiene (mantener el recargo).
// · La inflación (IPC) se muestra como referencia, no mueve la sugerencia.

export type Estado = 'actualizar' | 'renovar' | 'al_dia' | 'sin_datos';

export interface ConfigPrecios { umbral_pct: number; dias_al_dia: number; dias_vencido: number }

export interface DatosAnalisis {
  costo: number;
  precio: number;
  recargo_objetivo: number | null;      // % sobre costo; null = sin objetivo configurado
  costo_lista: number | null;           // lista vigente del proveedor
  costo_compra: number | null;          // última compra (neto con descuento)
  compra_posterior: boolean;            // la compra es posterior a la última actualización
  dolar_al_actualizar: number | null;
  dolar_hoy: number | null;
  dias: number;                         // desde la última actualización/renovación
  ipc_pct: number | null;               // inflación acumulada desde entonces
  formula?: Formula | null;             // fórmula de precio que le corresponde (solo estándar)
}

export interface Motivo { tipo: 'lista' | 'compra' | 'dolar' | 'recargo' | 'ipc' | 'formula' | 'aviso'; texto: string; pct?: number }

export interface Analisis {
  estado: Estado;
  costo_reposicion: number;
  recargo_actual: number | null;        // %
  recargo_referencia: number | null;    // %
  var_lista: number | null;             // %
  var_compra: number | null;            // %
  var_dolar: number | null;             // %
  precio_por_costo: number | null;
  precio_por_dolar: number | null;
  precio_sugerido: number;
  pct_sugerido: number;                 // %
  precio_por_formula: number | null;    // con el costo cargado
  desvio_formula_pct: number | null;    // precio actual contra la fórmula (%)
  posible_error_carga: boolean;
  motivos: Motivo[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (nuevo: number, viejo: number) => r2((nuevo / viejo - 1) * 100);
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

// ── Fórmula de precio (productos estándar) ──────────────────────
// precio = (costo ÷ divisor × (1 + recargo)) + costo × adicional, redondeado hacia arriba a un
// número terminado en `terminación`. Ej.: 100.000 ÷ 0,60 × 1,15 + 12.000 = 203.666,67 → 203.900.

export interface Formula {
  id: string; nombre: string; divisor: number; recargo_pct: number; adicional_costo_pct: number;
  redondeo_paso: number; redondeo_terminacion: number;
  tipo_abertura_id: string | null; proveedor_id: string | null; activa: boolean;
}

/** El menor número ≥ x que termina en `terminacion` (paso 1000, terminación 900: 203.666 → 203.900). */
export function redondearTerminacion(x: number, paso: number, terminacion: number): number {
  if (!(paso > 0)) return r2(x);
  return Math.ceil((r2(x) - terminacion) / paso - 1e-9) * paso + terminacion;
}

export interface PasoFormula { texto: string; valor: number }

/** Precio por fórmula y el cálculo paso a paso (para mostrarlo tal como lo hace el negocio). */
export function precioPorFormula(costo: number, f: Pick<Formula, 'divisor' | 'recargo_pct' | 'adicional_costo_pct' | 'redondeo_paso' | 'redondeo_terminacion'>):
  { precio: number; pasos: PasoFormula[] } {
  const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const reserva = r2(costo * f.adicional_costo_pct / 100);
  const dividido = r2(costo / f.divisor);
  const conRecargo = r2(dividido * (1 + f.recargo_pct / 100));
  const suma = r2(conRecargo + reserva);
  const precio = redondearTerminacion(suma, f.redondeo_paso, f.redondeo_terminacion);
  return {
    precio,
    pasos: [
      { texto: `${num(f.adicional_costo_pct)} % del costo (se reserva)`, valor: reserva },
      { texto: `Costo ÷ ${num(f.divisor)}`, valor: dividido },
      { texto: `+ ${num(f.recargo_pct)} %`, valor: conRecargo },
      { texto: `+ el ${num(f.adicional_costo_pct)} % reservado`, valor: suma },
      { texto: f.redondeo_paso > 0 ? `Redondeo hacia arriba terminado en ${f.redondeo_terminacion}` : 'Sin redondeo', valor: precio },
    ],
  };
}

/** La fórmula que le toca a un producto estándar: la más específica (familia + proveedor > familia > proveedor > general). */
export function elegirFormula(formulas: Formula[], p: { tipo?: string | null; tipo_abertura_id: string | null; proveedor_id: string | null }): Formula | null {
  if (p.tipo !== 'estandar') return null;
  const puntaje = (f: Formula) => {
    if (!f.activa) return -1;
    if (f.tipo_abertura_id && f.tipo_abertura_id !== p.tipo_abertura_id) return -1;
    if (f.proveedor_id && f.proveedor_id !== p.proveedor_id) return -1;
    return (f.tipo_abertura_id ? 2 : 0) + (f.proveedor_id ? 1 : 0);
  };
  let mejor: Formula | null = null;
  let max = -1;
  for (const f of formulas) { const s = puntaje(f); if (s > max) { max = s; mejor = f; } }
  return mejor;
}

/**
 * Costo o precio con pinta de mal cargado: el precio es menos de 1,2 o más de 4 veces el costo,
 * o el costo es de $10 o menos (ej. una puerta con costo $175,80 en vez de $175.800).
 */
export function posibleErrorCarga(costo: number, precio: number): boolean {
  if (!(costo > 0) || !(precio > 0)) return false;
  if (costo <= 10) return true;
  const m = precio / costo;
  return m < 1.2 || m > 4;
}

export function analizarProducto(d: DatosAnalisis, cfg: ConfigPrecios): Analisis {
  const motivos: Motivo[] = [];
  const vacio: Analisis = {
    estado: 'sin_datos', costo_reposicion: d.costo, recargo_actual: null, recargo_referencia: null,
    var_lista: null, var_compra: null, var_dolar: null, precio_por_costo: null, precio_por_dolar: null,
    precio_sugerido: d.precio, pct_sugerido: 0, precio_por_formula: null, desvio_formula_pct: null,
    posible_error_carga: false, motivos,
  };
  if (!(d.precio > 0)) { motivos.push({ tipo: 'aviso', texto: 'Sin precio de venta' }); return vacio; }

  const umbral = cfg.umbral_pct;
  const varDolar = d.dolar_al_actualizar && d.dolar_hoy ? pct(d.dolar_hoy, d.dolar_al_actualizar) : null;
  const precioPorDolar = varDolar !== null && varDolar > 0 ? r2(d.precio * (1 + varDolar / 100)) : null;

  if (!(d.costo > 0)) {
    // Sin costo cargado no se puede analizar el recargo; el dólar sí orienta.
    motivos.push({ tipo: 'aviso', texto: 'Sin costo cargado: no se puede calcular el recargo' });
    return { ...vacio, var_dolar: varDolar, precio_por_dolar: precioPorDolar };
  }

  const varLista = d.costo_lista && d.costo_lista > 0 ? pct(d.costo_lista, d.costo) : null;
  // La última compra solo cuenta si es posterior a la última actualización y razonable
  // (entre la mitad y el doble del costo cargado: fuera de eso suele ser un error de carga
  // o una compra de otra presentación).
  let varCompra: number | null = null;
  if (d.costo_compra && d.costo_compra > 0 && d.compra_posterior) {
    const ratio = d.costo_compra / d.costo;
    if (ratio >= 0.5 && ratio <= 2) varCompra = pct(d.costo_compra, d.costo);
    else motivos.push({ tipo: 'aviso', texto: `La última compra (${fmtPct(pct(d.costo_compra, d.costo))}) difiere mucho del costo cargado: revisar` });
  }

  const costoRep = Math.max(
    d.costo,
    varLista !== null && varLista > 0 ? d.costo_lista! : 0,
    varCompra !== null && varCompra > 0 ? d.costo_compra! : 0,
  );
  const recargoActual = pct(d.precio, d.costo);
  // Recargo de referencia: el mayor entre el que ya tiene y el objetivo. Si el producto ya
  // gana más que el objetivo, se conserva (bajar al objetivo haría bajar el precio aunque el
  // costo suba); si gana menos, se lleva al objetivo.
  const objetivo = d.recargo_objetivo !== null && d.recargo_objetivo > 0 ? d.recargo_objetivo : null;
  const recargoRef = objetivo !== null && objetivo > recargoActual ? objetivo : recargoActual;
  // Manteniendo el recargo actual es proporcional exacto (sin centavos de redondeo del %).
  const precioPorCosto = recargoRef === recargoActual
    ? r2(d.precio * costoRep / d.costo)
    : r2(costoRep * (1 + recargoRef / 100));

  // Fórmula de precio (productos estándar): sobre el costo cargado para medir el desvío, y sobre
  // el costo de reposición para sugerir. Un precio por encima de la fórmula nunca se baja.
  const errorCarga = posibleErrorCarga(d.costo, d.precio);
  const precioFormula = d.formula ? precioPorFormula(d.costo, d.formula).precio : null;
  const precioFormulaRep = d.formula && !errorCarga ? precioPorFormula(costoRep, d.formula).precio : null;
  const desvioFormula = precioFormula ? pct(d.precio, precioFormula) : null;

  const precioSugerido = Math.max(d.precio, precioPorCosto, precioPorDolar ?? 0, precioFormulaRep ?? 0);
  const pctSugerido = pct(precioSugerido, d.precio);

  if (varLista !== null && Math.abs(varLista) >= umbral) {
    motivos.push({ tipo: 'lista', texto: `Lista del proveedor ${fmtPct(varLista)}`, pct: varLista });
  }
  if (varCompra !== null && Math.abs(varCompra) >= umbral) {
    motivos.push({ tipo: 'compra', texto: `Última compra ${fmtPct(varCompra)}`, pct: varCompra });
  }
  if (varDolar !== null && varDolar >= umbral) {
    motivos.push({ tipo: 'dolar', texto: `Dólar ${fmtPct(varDolar)}`, pct: varDolar });
  }
  if (objetivo !== null && recargoActual < objetivo - umbral) {
    motivos.push({ tipo: 'recargo', texto: `Recargo ${fmtPct(recargoActual).replace('+', '')} (objetivo ${d.recargo_objetivo} %)`, pct: recargoActual });
  }
  if (d.ipc_pct !== null && d.ipc_pct >= umbral) {
    motivos.push({ tipo: 'ipc', texto: `Inflación ${fmtPct(d.ipc_pct)} desde la última actualización`, pct: d.ipc_pct });
  }
  if (errorCarga) {
    motivos.push({ tipo: 'aviso', texto: `Posible error de carga: el precio es ${(d.precio / d.costo).toLocaleString('es-AR', { maximumFractionDigits: 2 })} veces el costo` });
  } else if (desvioFormula !== null && desvioFormula <= -umbral) {
    motivos.push({ tipo: 'formula', texto: `Debajo de la fórmula (${fmtPct(desvioFormula)})`, pct: desvioFormula });
  } else if (desvioFormula !== null && desvioFormula >= umbral) {
    motivos.push({ tipo: 'aviso', texto: `Por encima de la fórmula (${fmtPct(desvioFormula)}): revisar` });
  }
  if (varLista !== null && varLista <= -umbral) {
    motivos.push({ tipo: 'aviso', texto: `El proveedor bajó el precio ${fmtPct(varLista)}: ¿conviene bajar?` });
  }

  const estado: Estado = pctSugerido >= umbral ? 'actualizar' : d.dias <= cfg.dias_al_dia ? 'al_dia' : 'renovar';
  return {
    estado, costo_reposicion: costoRep, recargo_actual: recargoActual, recargo_referencia: recargoRef,
    var_lista: varLista, var_compra: varCompra, var_dolar: varDolar,
    precio_por_costo: precioPorCosto, precio_por_dolar: precioPorDolar,
    precio_sugerido: precioSugerido, pct_sugerido: pctSugerido,
    precio_por_formula: precioFormula, desvio_formula_pct: desvioFormula, posible_error_carga: errorCarga, motivos,
  };
}

// ── Criterios para aplicar una actualización ────────────────────

export type Criterio =
  | { tipo: 'sugerido' }
  | { tipo: 'porcentaje'; pct: number }
  | { tipo: 'dolar' }
  | { tipo: 'costo'; actualizar_costo: boolean }
  | { tipo: 'grupos'; por: 'familia' | 'linea' | 'proveedor' | 'medida'; pcts: Record<string, number> }
  | { tipo: 'formula'; base: 'cargado' | 'reposicion'; actualizar_costo: boolean };

/**
 * Paso de redondeo en pesos (0 = sin redondeo). Se redondea hacia arriba para no perder margen.
 * Con `terminacion` el precio termina en ese número (paso 1000 + 900 → …900).
 */
export function redondearPrecio(precio: number, paso: number, terminacion = 0): number {
  if (!(paso > 0)) return r2(precio);
  if (terminacion > 0) return redondearTerminacion(precio, paso, terminacion);
  return Math.ceil(r2(precio) / paso - 1e-9) * paso;
}

export function precioSegunCriterio(precio: number, a: Analisis, criterio: Criterio, grupo: string | null,
  ctx: { costo?: number; formula?: Formula | null } = {}): { precio: number; costo: number | null } {
  switch (criterio.tipo) {
    case 'formula': {
      // Sin fórmula (a medida, precio manual) o con un costo mal cargado, el precio no cambia.
      if (!ctx.formula || a.posible_error_carga) return { precio, costo: null };
      const costo = criterio.base === 'reposicion' ? a.costo_reposicion : ctx.costo ?? 0;
      if (!(costo > 0)) return { precio, costo: null };
      return {
        precio: precioPorFormula(costo, ctx.formula).precio,
        costo: criterio.base === 'reposicion' && criterio.actualizar_costo && costo !== ctx.costo ? costo : null,
      };
    }
    case 'sugerido': return { precio: a.precio_sugerido, costo: null };
    case 'porcentaje': return { precio: precio * (1 + criterio.pct / 100), costo: null };
    case 'dolar': return { precio: a.precio_por_dolar ?? precio, costo: null };
    case 'costo': return {
      precio: a.precio_por_costo ?? precio,
      costo: criterio.actualizar_costo && a.costo_reposicion > 0 ? a.costo_reposicion : null,
    };
    case 'grupos': {
      const p = grupo !== null ? criterio.pcts[grupo] : undefined;
      return { precio: p !== undefined ? precio * (1 + p / 100) : precio, costo: null };
    }
  }
}

// ── Consulta ────────────────────────────────────────────────────

export async function leerFormulas(): Promise<Formula[]> {
  const { rows } = await db.query(
    `SELECT id, nombre, divisor::float, recargo_pct::float, adicional_costo_pct::float, redondeo_paso, redondeo_terminacion,
            tipo_abertura_id, proveedor_id, activa
       FROM formulas_precio ORDER BY (tipo_abertura_id IS NULL AND proveedor_id IS NULL) DESC, nombre`);
  return rows as Formula[];
}

export async function leerConfigPrecios(): Promise<ConfigPrecios> {
  const { rows: [c] } = await db.query(`SELECT umbral_pct, dias_al_dia, dias_vencido FROM precios_config WHERE id = 1`);
  return c
    ? { umbral_pct: Number(c.umbral_pct), dias_al_dia: Number(c.dias_al_dia), dias_vencido: Number(c.dias_vencido) }
    : { umbral_pct: 3, dias_al_dia: 7, dias_vencido: 10 };
}

/**
 * Datos de cada producto activo para la revisión. El dólar "al actualizar" es el último
 * registrado en o antes de esa fecha; la inflación acumulada compone los meses cerrados
 * posteriores a la actualización.
 */
export async function filasRevision(ids?: string[]) {
  const { rows } = await db.query(`
    WITH hoy AS (SELECT venta FROM cotizacion_dolar_historial ORDER BY fecha DESC LIMIT 1)
    SELECT cp.id, cp.nombre, cp.codigo, cp.color, cp.tipo::text AS tipo, cp.costo_base::float AS costo, cp.precio_base::float AS precio,
           cp.precio_por_m2, cp.precio_manual, cp.en_salon, cp.precio_actualizado_at,
           cp.tipo_abertura_id, ta.nombre AS familia, cp.sistema_id, s.nombre AS sistema, cp.linea_id, li.nombre AS linea,
           cp.proveedor_id, pr.nombre AS proveedor,
           NULLIF(COALESCE(cp.margen_venta, ta.margen_venta, NULLIF(pr.margen_venta, 0)), 0)::float AS recargo_objetivo,
           lista.precio::float AS costo_lista, lista.updated_at AS costo_lista_fecha, lista.sku AS proveedor_sku_lista,
           compra.costo::float AS costo_compra, compra.fecha AS costo_compra_fecha,
           (compra.fecha IS NOT NULL AND compra.fecha >= cp.precio_actualizado_at::date) AS compra_posterior,
           dact.venta::float AS dolar_al_actualizar, (SELECT venta FROM hoy)::float AS dolar_hoy,
           (CURRENT_DATE - cp.precio_actualizado_at::date) AS dias,
           (SELECT (exp(sum(ln(1 + variacion / 100))) - 1) * 100 FROM indice_ipc
             WHERE mes > (date_trunc('month', cp.precio_actualizado_at) + interval '1 month - 1 day')::date)::float AS ipc_pct,
           COALESCE(ventas.unidades, 0)::int AS ventas_90d,
           COALESCE(abiertas.n, 0)::int AS proformas_abiertas,
           cp.stock_inicial + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos sm WHERE sm.producto_id = cp.id), 0) AS stock
      FROM catalogo_productos cp
      LEFT JOIN tipos_abertura ta ON ta.id = cp.tipo_abertura_id
      LEFT JOIN sistemas s ON s.id = cp.sistema_id
      LEFT JOIN lineas li ON li.id = cp.linea_id
      LEFT JOIN proveedores pr ON pr.id = cp.proveedor_id
      LEFT JOIN LATERAL (
        SELECT pp.precio, pp.updated_at, pp.sku FROM proveedor_precios pp
         WHERE pp.activo AND (pp.producto_id = cp.id OR (cp.proveedor_sku IS NOT NULL AND pp.proveedor_id = cp.proveedor_id AND pp.sku = cp.proveedor_sku))
         ORDER BY (pp.producto_id = cp.id) DESC, pp.updated_at DESC LIMIT 1) lista ON true
      LEFT JOIN LATERAL (
        SELECT (pi.precio_unitario_neto * (1 - pi.descuento_pct / 100)) AS costo, p.fecha_pedido AS fecha
          FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
         WHERE pi.producto_id = cp.id AND pi.precio_unitario_neto > 0
           AND p.estado <> 'cancelado' AND p.estado_logistica NOT IN ('cancelada', 'borrador') AND pi.estado_item <> 'cancelado'
         ORDER BY p.fecha_pedido DESC, p.created_at DESC LIMIT 1) compra ON true
      LEFT JOIN LATERAL (
        SELECT venta FROM cotizacion_dolar_historial h WHERE h.fecha <= cp.precio_actualizado_at::date
         ORDER BY h.fecha DESC LIMIT 1) dact ON true
      LEFT JOIN LATERAL (
        SELECT SUM(oi.cantidad) AS unidades FROM operacion_items oi JOIN operaciones o ON o.id = oi.operacion_id
         WHERE oi.producto_id = cp.id AND o.created_at >= now() - interval '90 days'
           AND o.estado IN ('aprobado', 'en_produccion', 'listo', 'instalado', 'entregado')) ventas ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT o.id) AS n FROM operacion_items oi JOIN operaciones o ON o.id = oi.operacion_id
         WHERE oi.producto_id = cp.id AND o.estado IN ('presupuesto', 'enviado')
           AND (o.fecha_validez IS NULL OR o.fecha_validez >= CURRENT_DATE)) abiertas ON true
     WHERE cp.activo ${ids ? 'AND cp.id = ANY($1::uuid[])' : ''}
     ORDER BY cp.nombre`, ids ? [ids] : []);
  return rows;
}

type FilaRevision = Awaited<ReturnType<typeof filasRevision>>[number];

export function analizarFila(f: FilaRevision, cfg: ConfigPrecios, formula: Formula | null = null): Analisis {
  return analizarProducto({
    formula: f.precio_manual ? null : formula,
    costo: Number(f.costo), precio: Number(f.precio), recargo_objetivo: f.recargo_objetivo,
    costo_lista: f.costo_lista, costo_compra: f.costo_compra, compra_posterior: !!f.compra_posterior,
    dolar_al_actualizar: f.dolar_al_actualizar, dolar_hoy: f.dolar_hoy, dias: Number(f.dias), ipc_pct: f.ipc_pct,
  }, cfg);
}

/** Clave del grupo de un producto para "porcentaje por grupo" y para agrupar el análisis. */
export function grupoDe(f: { tipo_abertura_id: string | null; linea_id: string | null; sistema_id: string | null; proveedor_id: string | null; precio_por_m2: boolean },
  por: 'familia' | 'linea' | 'proveedor' | 'medida'): string {
  if (por === 'familia') return f.tipo_abertura_id ?? 'sin';
  if (por === 'linea') return f.linea_id ?? f.sistema_id ?? 'sin';
  if (por === 'proveedor') return f.proveedor_id ?? 'sin';
  return f.precio_por_m2 ? 'm2' : 'unidad';
}

// ── Historial ───────────────────────────────────────────────────

type Q = { query: typeof db.query };

export interface CambioHistorial {
  producto_id: string; tipo: 'renovacion' | 'cambio_precio' | 'cambio_costo';
  precio_anterior?: number | null; precio_nuevo?: number | null; costo_anterior?: number | null; costo_nuevo?: number | null;
  criterio?: string | null; origen: string; detalle?: string | null;
}

/** Registra cambios de precio/costo/validez con el dólar del día. */
export async function registrarHistorial(q: Q, cambios: CambioHistorial[], usuarioId: string | null): Promise<void> {
  if (!cambios.length) return;
  const col = <K extends keyof CambioHistorial>(k: K) => cambios.map(c => c[k] ?? null);
  await q.query(`
    INSERT INTO producto_precio_historial
      (producto_id, tipo, precio_anterior, precio_nuevo, costo_anterior, costo_nuevo, criterio, origen, detalle, usuario_id, dolar_blue)
    SELECT u.*, $10::uuid, (SELECT venta FROM cotizacion_dolar_historial ORDER BY fecha DESC LIMIT 1)
      FROM unnest($1::uuid[], $2::text[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $7::text[], $8::text[], $9::text[]) u`,
    [col('producto_id'), col('tipo'), col('precio_anterior'), col('precio_nuevo'), col('costo_anterior'), col('costo_nuevo'),
     col('criterio'), col('origen'), col('detalle'), usuarioId]);
}
