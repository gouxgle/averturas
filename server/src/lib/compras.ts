/**
 * Helpers del módulo Compras y Proveedores (SC → PC → OC). Ver docs/compras-plan.md.
 *
 * Todo lo que escribe `pedidos.estado` (legacy) o arma ítems desde un origen vive
 * acá para que las rutas de /compras y las de /pedidos (flujo viejo) no diverjan.
 */
import type { PoolClient } from 'pg';
import { db } from '../db.js';

type Queryable = Pick<PoolClient, 'query'>;

/** Fila de pg: se lee por clave dinámica (columnas de `pedido_items`, `pedidos`, …). */
type Fila = Record<string, unknown>;

const num = (v: unknown) => Number(v ?? 0);

// ── Numeración ────────────────────────────────────────────────────────────────

export type PrefijoCompra = 'SC' | 'PC' | 'OC' | 'REC';

const TABLA_POR_PREFIJO: Record<PrefijoCompra, string> = {
  SC:  'compras_solicitudes',
  PC:  'compras_cotizaciones',
  OC:  'pedidos',
  REC: 'compras_incidencias',
};

/**
 * Próximo número `XX-YYYYMM-NNNN`. Misma regla que el resto del proyecto:
 * MAX(sufijo)+1 dentro de la transacción, nunca COUNT(*) (regenera números
 * borrados → duplicate key). Los PED- viejos no participan del conteo de OC-.
 */
export async function nextNumeroCompra(client: Queryable, prefijo: PrefijoCompra): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(numero FROM '(\\d+)$')::int), 0) AS n
     FROM ${TABLA_POR_PREFIJO[prefijo]} WHERE numero LIKE $1`,
    [`${prefijo}-${ym}-%`]
  );
  const n = Number((rows[0] as { n: number }).n) + 1;
  return `${prefijo}-${ym}-${String(n).padStart(4, '0')}`;
}

// ── Estado legacy de la OC ────────────────────────────────────────────────────

export type EstadoLogistica =
  | 'borrador' | 'enviada' | 'confirmada' | 'en_preparacion' | 'en_fabricacion' | 'terminado'
  | 'listo_despacho' | 'en_transito' | 'demorado' | 'recibida_parcial' | 'recibida' | 'cerrada'
  | 'cancelada';

export type EstadoLegacy = 'pendiente' | 'enviado' | 'recibido' | 'cancelado';

/** `estado_logistica` → `estado` legacy que leen kanban, cobertura, remitos y dashboard. */
export function estadoLegacyDesdeLogistica(l: EstadoLogistica): EstadoLegacy {
  switch (l) {
    case 'borrador':  return 'pendiente';
    case 'recibida':
    case 'cerrada':   return 'recibido';
    case 'cancelada': return 'cancelado';
    // recibida_parcial sigue "en pedido" para la cobertura
    default:          return 'enviado';
  }
}

/** Inversa para el flujo viejo (`PATCH /pedidos/:id/estado`), que sigue escribiendo el legacy. */
export function estadoLogisticaDesdeLegacy(e: EstadoLegacy): EstadoLogistica {
  switch (e) {
    case 'pendiente': return 'borrador';
    case 'enviado':   return 'enviada';
    case 'recibido':  return 'recibida';
    case 'cancelado': return 'cancelada';
  }
}

/**
 * Único lugar que escribe `pedidos.estado` a partir de `estado_logistica`.
 * Llamar después de cada cambio de logística, dentro de la misma transacción.
 */
export async function sincronizarEstadoLegacy(client: Queryable, pedidoId: string): Promise<EstadoLegacy> {
  const { rows: [p] } = await client.query(
    `SELECT estado_logistica FROM pedidos WHERE id = $1`, [pedidoId]
  );
  const legacy = estadoLegacyDesdeLogistica((p?.estado_logistica ?? 'borrador') as EstadoLogistica);
  await client.query(
    `UPDATE pedidos SET estado = $2, updated_at = now() WHERE id = $1 AND estado <> $2`,
    [pedidoId, legacy]
  );
  return legacy;
}

// ── Totales ───────────────────────────────────────────────────────────────────

export interface LineaPrecio {
  cantidad: number;
  precio_unitario_neto: number;
  descuento_pct?: number | null;
  iva_pct?: number | null;
}

export interface Totales {
  subtotal_neto: number;
  descuento_monto: number;
  iva_monto: number;
  flete: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * neto − descuento + IVA (por línea) + flete = total. El flete no lleva IVA acá:
 * en este negocio el transporte cobra aparte (contra-reembolso).
 */
export function calcularTotales(lineas: LineaPrecio[], flete = 0): Totales {
  let neto = 0, desc = 0, iva = 0;
  for (const l of lineas) {
    const cant  = Number(l.cantidad) || 0;
    const pu    = Number(l.precio_unitario_neto) || 0;
    const dPct  = Number(l.descuento_pct ?? 0) || 0;
    const iPct  = Number(l.iva_pct ?? 0) || 0;
    const bruto = cant * pu;
    const d     = bruto * dPct / 100;
    neto += bruto;
    desc += d;
    iva  += (bruto - d) * iPct / 100;
  }
  const f = Number(flete) || 0;
  return {
    subtotal_neto:   r2(neto),
    descuento_monto: r2(desc),
    iva_monto:       r2(iva),
    flete:           r2(f),
    total:           r2(neto - desc + iva + f),
  };
}

/** Recalcula y guarda los totales de una OC a partir de sus ítems. */
export async function recalcularTotalesOC(client: Queryable, pedidoId: string): Promise<Totales> {
  const [{ rows: items }, { rows: [p] }] = await Promise.all([
    client.query(
      `SELECT cantidad, precio_unitario_neto, descuento_pct, iva_pct
       FROM pedido_items WHERE pedido_id = $1 AND estado_item <> 'cancelado'`, [pedidoId]),
    client.query(`SELECT costo_envio FROM pedidos WHERE id = $1`, [pedidoId]),
  ]);
  const t = calcularTotales(items as LineaPrecio[], Number(p?.costo_envio ?? 0));
  // monto_total queda como espejo de total para los lectores actuales (dashboard, informes)
  await client.query(
    `UPDATE pedidos SET subtotal_neto = $2, descuento_monto = $3, iva_monto = $4,
       total = $5, monto_total = $5, updated_at = now()
     WHERE id = $1`,
    [pedidoId, t.subtotal_neto, t.descuento_monto, t.iva_monto, t.total]
  );
  return t;
}

// ── Autocompletado de ítems desde el origen ───────────────────────────────────

export type TipoProductoCompra =
  | 'abertura_estandar' | 'abertura_medida' | 'perfil' | 'vidrio' | 'herraje_accesorio' | 'otro';

export interface ItemSolicitudDraft {
  operacion_item_id?: string | null;
  visita_tecnica_item_id?: string | null;
  producto_id?: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  especificaciones: Record<string, unknown>;
  adjuntos: string[];
  observaciones?: string | null;
  /** Sugerido para la cabecera de la SC cuando el usuario no lo eligió. */
  tipo_producto: TipoProductoCompra;
  proveedor_sugerido_id?: string | null;
  proveedor_sku?: string | null;
  /** Costo de referencia (costo del presupuesto o costo_base del catálogo). */
  costo_referencia?: number | null;
  /** Solo para el selector de la UI: ya está cubierto por otra OC activa. */
  ya_pedido?: boolean;
}

type Atributos = Record<string, unknown>;

function limpiar(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  return out;
}

/** Ficha técnica de una abertura a partir de columnas del ítem + atributos del catálogo. */
function especAbertura(src: {
  ancho_m?: number | null; alto_m?: number | null; sistema?: string | null; color?: string | null;
  vidrio?: string | null; premarco?: boolean | null; accesorios?: string[] | null; notas?: string | null;
  tipo_abertura?: string | null;
}, atr: Atributos | null): Record<string, unknown> {
  const a = atr ?? {};
  const herrajes: string[] = [];
  if (Array.isArray(a.componentes)) herrajes.push(...(a.componentes as string[]));
  if (typeof a.herrajes === 'string' && a.herrajes) herrajes.push(a.herrajes);
  if (typeof a.cerradura === 'string' && a.cerradura && a.cerradura !== 'no') herrajes.push(`cerradura ${a.cerradura}`);
  const mosquitero = a.mosquitero === 'si' || a.mosquitero === true || a.configuracion_especial === 'con_mosquitero';
  return limpiar({
    tipo_abertura: src.tipo_abertura ?? null,
    ancho_m:  src.ancho_m != null ? Number(src.ancho_m) : null,
    alto_m:   src.alto_m  != null ? Number(src.alto_m)  : null,
    sistema:  src.sistema ?? (typeof a.sistema === 'string' ? a.sistema : null),
    color:    src.color ?? null,
    vidrio:   src.vidrio ?? (typeof a.vidrio_tipo === 'string' ? a.vidrio_tipo : null),
    apertura: (a.apertura ?? a.tipo_ventana ?? a.tipo_mosquitera ?? null) as string | null,
    hojas:    (a.config_hojas ?? null) as string | null,
    herrajes: herrajes.length ? herrajes.join(', ') : null,
    mosquitero: mosquitero ? true : null,
    premarco:  src.premarco ? true : null,
    accesorios: src.accesorios ?? null,
    observaciones: src.notas ?? null,
  });
}

/** Ítems de una operación (venta / proforma) que faltan pedir. */
export async function itemsDesdeOperacion(client: Queryable, operacionId: string): Promise<ItemSolicitudDraft[]> {
  const { rows } = await client.query(`
    SELECT oi.id, oi.descripcion, oi.cantidad, oi.costo_unitario, oi.producto_id, oi.tipo_item,
      oi.medida_ancho, oi.medida_alto, oi.color, oi.vidrio, oi.premarco, oi.accesorios, oi.notas,
      oi.calculo_url,
      ta.nombre AS tipo_abertura_nombre, s.nombre AS sistema_nombre,
      prod.atributos AS producto_atributos, prod.proveedor_id AS producto_proveedor_id,
      prod.proveedor_sku, prod.costo_base, prod.imagen_url AS producto_imagen_url,
      EXISTS (
        SELECT 1 FROM pedido_items pi2 JOIN pedidos p2 ON p2.id = pi2.pedido_id
        WHERE pi2.operacion_item_id = oi.id AND p2.estado <> 'cancelado' AND pi2.es_reposicion = false
      ) AS ya_pedido
    FROM operacion_items oi
    LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
    LEFT JOIN sistemas s ON s.id = oi.sistema_id
    LEFT JOIN catalogo_productos prod ON prod.id = oi.producto_id
    WHERE oi.operacion_id = $1 AND oi.tipo_item <> 'servicio'
    ORDER BY oi.orden
  `, [operacionId]);

  return (rows as Record<string, unknown>[]).map(r => ({
    operacion_item_id: r.id as string,
    producto_id: (r.producto_id as string | null) ?? null,
    descripcion: r.descripcion as string,
    cantidad: Number(r.cantidad) || 1,
    unidad: 'u',
    especificaciones: especAbertura({
      tipo_abertura: r.tipo_abertura_nombre as string | null,
      ancho_m: r.medida_ancho as number | null, alto_m: r.medida_alto as number | null,
      sistema: r.sistema_nombre as string | null, color: r.color as string | null,
      vidrio: r.vidrio as string | null, premarco: r.premarco as boolean,
      accesorios: r.accesorios as string[], notas: r.notas as string | null,
    }, r.producto_atributos as Atributos | null),
    adjuntos: [r.calculo_url as string | null].filter((u): u is string => !!u),
    tipo_producto: r.producto_id ? 'abertura_estandar' : 'abertura_medida',
    proveedor_sugerido_id: (r.producto_proveedor_id as string | null) ?? null,
    proveedor_sku: (r.proveedor_sku as string | null) ?? null,
    costo_referencia: Number(r.costo_unitario) || Number(r.costo_base) || null,
    ya_pedido: !!r.ya_pedido,
  }));
}

/** Ítems de un relevamiento (orden de trabajo): medidas en mm → m. */
export async function itemsDesdeVisita(client: Queryable, visitaId: string): Promise<ItemSolicitudDraft[]> {
  const [{ rows }, { rows: [vt] }] = await Promise.all([
    client.query(`
      SELECT vi.*, ta.nombre AS tipo_abertura_nombre, s.nombre AS sistema_nombre,
        prod.atributos AS producto_atributos, prod.proveedor_id AS producto_proveedor_id,
        prod.proveedor_sku, prod.costo_base
      FROM visita_tecnica_items vi
      LEFT JOIN tipos_abertura ta ON ta.id = vi.tipo_abertura_id
      LEFT JOIN sistemas s ON s.id = vi.sistema_id
      LEFT JOIN catalogo_productos prod ON prod.id = vi.producto_id
      WHERE vi.visita_tecnica_id = $1 AND vi.tipo_item <> 'servicio'
      ORDER BY vi.orden
    `, [visitaId]),
    client.query(`SELECT imagenes FROM visitas_tecnicas WHERE id = $1`, [visitaId]),
  ]);
  const fotos: string[] = (vt?.imagenes as string[] | null) ?? [];

  return (rows as Record<string, unknown>[]).map(r => ({
    visita_tecnica_item_id: r.id as string,
    producto_id: (r.producto_id as string | null) ?? null,
    descripcion: [r.ambiente, r.descripcion].filter(Boolean).join(' — ') || 'Abertura a medida',
    cantidad: 1,
    unidad: 'u',
    especificaciones: especAbertura({
      tipo_abertura: r.tipo_abertura_nombre as string | null,
      ancho_m: r.ancho_mm != null ? Number(r.ancho_mm) / 1000 : null,
      alto_m:  r.alto_mm  != null ? Number(r.alto_mm)  / 1000 : null,
      sistema: r.sistema_nombre as string | null, color: r.color as string | null,
      vidrio: r.vidrio as string | null, premarco: r.premarco as boolean,
      accesorios: r.accesorios as string[],
    }, r.producto_atributos as Atributos | null),
    adjuntos: [r.calculo_url as string | null, ...fotos].filter((u): u is string => !!u),
    tipo_producto: r.producto_id ? 'abertura_estandar' : 'abertura_medida',
    proveedor_sugerido_id: (r.producto_proveedor_id as string | null) ?? null,
    proveedor_sku: (r.proveedor_sku as string | null) ?? null,
    costo_referencia: Number(r.costo_base) || null,
  }));
}

/** Un producto del catálogo (reposición de stock / faltante). Medidas del catálogo en cm. */
export async function itemDesdeProducto(client: Queryable, productoId: string, cantidad = 1): Promise<ItemSolicitudDraft | null> {
  const { rows: [p] } = await client.query(`
    SELECT p.*, ta.nombre AS tipo_abertura_nombre, s.nombre AS sistema_nombre
    FROM catalogo_productos p
    LEFT JOIN tipos_abertura ta ON ta.id = p.tipo_abertura_id
    LEFT JOIN sistemas s ON s.id = p.sistema_id
    WHERE p.id = $1
  `, [productoId]);
  if (!p) return null;
  return {
    producto_id: p.id,
    descripcion: p.nombre,
    cantidad,
    unidad: 'u',
    especificaciones: especAbertura({
      tipo_abertura: p.tipo_abertura_nombre,
      ancho_m: p.ancho != null ? Number(p.ancho) / 100 : null,
      alto_m:  p.alto  != null ? Number(p.alto)  / 100 : null,
      sistema: p.sistema_nombre, color: p.color, vidrio: p.vidrio,
      premarco: p.premarco, accesorios: p.accesorios,
    }, p.atributos),
    adjuntos: [],
    tipo_producto: 'abertura_estandar',
    proveedor_sugerido_id: p.proveedor_id ?? null,
    proveedor_sku: p.proveedor_sku ?? null,
    costo_referencia: Number(p.costo_base) || null,
  };
}

/**
 * Arma los ítems de una SC según su origen. Para `garantia` / `reposicion_falla` se
 * copia la ficha del ítem de OC original; `produccion_propia` / manual vienen del form.
 */
export async function armarItemDesde(client: Queryable, origen: {
  operacion_id?: string | null;
  visita_tecnica_id?: string | null;
  producto_id?: string | null;
  pedido_item_id?: string | null;
  cantidad?: number;
}): Promise<ItemSolicitudDraft[]> {
  if (origen.operacion_id)      return itemsDesdeOperacion(client, origen.operacion_id);
  if (origen.visita_tecnica_id) return itemsDesdeVisita(client, origen.visita_tecnica_id);
  if (origen.producto_id) {
    const it = await itemDesdeProducto(client, origen.producto_id, origen.cantidad ?? 1);
    return it ? [it] : [];
  }
  if (origen.pedido_item_id) {
    const { rows: [pi] } = await client.query(
      `SELECT pi.*, p.proveedor_id FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id WHERE pi.id = $1`,
      [origen.pedido_item_id]
    );
    if (!pi) return [];
    return [{
      producto_id: pi.producto_id ?? null,
      operacion_item_id: null,
      descripcion: pi.descripcion,
      cantidad: origen.cantidad ?? (Number(pi.cantidad) || 1),
      unidad: pi.unidad ?? 'u',
      especificaciones: pi.especificaciones ?? {},
      adjuntos: [],
      tipo_producto: pi.producto_id ? 'abertura_estandar' : 'abertura_medida',
      proveedor_sugerido_id: pi.proveedor_id ?? null,
      proveedor_sku: pi.proveedor_sku ?? null,
      costo_referencia: Number(pi.precio_unitario_neto) || null,
    }];
  }
  return [];
}

// ── Solicitud implícita (flujo viejo POST /pedidos) ───────────────────────────

/**
 * El camino corto (pedido directo desde la operación o para stock propio) también deja
 * trazabilidad: crea una SC ya `con_oc` con los mismos ítems y devuelve el mapa
 * operacion_item_id/producto_id → solicitud_item_id para vincular los pedido_items.
 */
export async function crearSolicitudImplicita(client: Queryable, p: {
  operacion_id: string | null;
  es_stock_propio: boolean;
  proveedor_id: string;
  fecha_necesaria: string | null;
  notas: string | null;
  created_by: string | null;
  items: { operacion_item_id?: string | null; producto_id?: string | null; descripcion: string; cantidad: number }[];
}): Promise<{ solicitud_id: string; numero: string; item_ids: string[] }> {
  const numero = await nextNumeroCompra(client, 'SC');
  let clienteId: string | null = null;
  if (p.operacion_id) {
    const { rows: [o] } = await client.query(`SELECT cliente_id FROM operaciones WHERE id = $1`, [p.operacion_id]);
    clienteId = o?.cliente_id ?? null;
  }
  const { rows: [sc] } = await client.query(`
    INSERT INTO compras_solicitudes
      (numero, origen, operacion_id, cliente_id, tipo_producto, fecha_necesaria, observaciones,
       estado, proveedor_sugerido_id, created_by)
    VALUES ($1, $2, $3, $4, 'abertura_estandar', $5, $6, 'con_oc', $7, $8)
    RETURNING id
  `, [
    numero, p.es_stock_propio ? 'reposicion_stock' : 'venta', p.operacion_id, clienteId,
    p.fecha_necesaria, p.notas, p.proveedor_id, p.created_by,
  ]);

  // Ficha técnica desde el origen, si se puede (mismos datos que la SC explícita)
  const drafts = p.operacion_id ? await itemsDesdeOperacion(client, p.operacion_id) : [];
  const porOpItem = new Map(drafts.map(d => [d.operacion_item_id, d]));

  const item_ids: string[] = [];
  for (const [idx, it] of p.items.entries()) {
    const d = it.operacion_item_id ? porOpItem.get(it.operacion_item_id) : null;
    const { rows: [row] } = await client.query(`
      INSERT INTO compras_solicitud_items
        (solicitud_id, orden, operacion_item_id, producto_id, descripcion, cantidad, especificaciones,
         adjuntos, costo_referencia, proveedor_sku, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'comprado')
      RETURNING id
    `, [
      sc.id, idx, it.operacion_item_id ?? null, it.producto_id ?? null, it.descripcion,
      it.cantidad || 1, JSON.stringify(d?.especificaciones ?? {}), JSON.stringify(d?.adjuntos ?? []),
      d?.costo_referencia ?? null, d?.proveedor_sku ?? null,
    ]);
    item_ids.push(row.id);
  }
  return { solicitud_id: sc.id, numero, item_ids };
}

// ── Estado derivado de la SC ──────────────────────────────────────────────────

/**
 * La SC refleja lo que pasa con sus ítems: si todos están comprados → con_oc; si alguno
 * está en cotización → en_cotizacion; si todos cancelados → cancelada; si no → abierta.
 * No pisa `cerrada` (cierre manual).
 */
export async function recalcularEstadoSolicitud(client: Queryable, solicitudId: string): Promise<void> {
  const { rows: [s] } = await client.query(`
    SELECT sc.estado,
      COUNT(*) FILTER (WHERE i.estado = 'comprado')::int      AS comprados,
      COUNT(*) FILTER (WHERE i.estado = 'en_cotizacion')::int AS cotizando,
      COUNT(*) FILTER (WHERE i.estado = 'cancelado')::int     AS cancelados,
      COUNT(i.id)::int AS total
    FROM compras_solicitudes sc
    LEFT JOIN compras_solicitud_items i ON i.solicitud_id = sc.id
    WHERE sc.id = $1
    GROUP BY sc.estado
  `, [solicitudId]);
  if (!s || s.estado === 'cerrada') return;
  const vivos = s.total - s.cancelados;
  let nuevo: string;
  if (s.total > 0 && s.cancelados === s.total) nuevo = 'cancelada';
  else if (vivos > 0 && s.comprados === vivos) nuevo = 'con_oc';
  else if (s.cotizando > 0)                     nuevo = 'en_cotizacion';
  else                                          nuevo = 'abierta';
  if (nuevo !== s.estado) {
    await client.query(`UPDATE compras_solicitudes SET estado = $2, updated_at = now() WHERE id = $1`, [solicitudId, nuevo]);
  }
}

// ── Empresa para PDFs / mensajes ──────────────────────────────────────────────

export async function empresaActual(client: Queryable = db) {
  const { rows: [emp] } = await client.query(
    `SELECT nombre, cuit, telefono, email, direccion FROM empresa ORDER BY updated_at DESC LIMIT 1`
  );
  return emp ?? { nombre: 'César Brítez Aberturas', cuit: null, telefono: null, email: null, direccion: null };
}

/** Texto corto de la ficha técnica para mensajes y PDFs ("1,20 × 1,50 m · Blanco · DVH"). */
export function resumenEspecificaciones(e: Record<string, unknown> | null | undefined): string {
  if (!e) return '';
  const partes: string[] = [];
  const num = (v: unknown) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (e.ancho_m && e.alto_m) partes.push(`${num(e.ancho_m)} × ${num(e.alto_m)} m`);
  if (e.largo_mm) partes.push(`${e.largo_mm} mm`);
  if (e.ancho_mm && e.alto_mm) partes.push(`${e.ancho_mm} × ${e.alto_mm} mm`);
  if (e.espesor_mm) partes.push(`${e.espesor_mm} mm`);
  // Valores que vienen como claves del catálogo ("de_abrir", "herrajes_completos") → texto legible
  const hum = (v: unknown) => String(v).replace(/_/g, ' ');
  for (const k of ['tipo_abertura', 'sistema', 'color', 'vidrio', 'apertura', 'hojas', 'tipo', 'marca', 'codigo'] as const) {
    if (typeof e[k] === 'string' && e[k]) partes.push(hum(e[k]));
  }
  if (e.mosquitero === true) partes.push('con mosquitero');
  if (e.premarco === true) partes.push('con premarco');
  if (typeof e.herrajes === 'string' && e.herrajes) partes.push(`herrajes: ${hum(e.herrajes)}`);
  if (Array.isArray(e.accesorios) && e.accesorios.length) partes.push((e.accesorios as string[]).join(', '));
  return partes.join(' · ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Etapa 2 — logística, recepción por ítem, reclamos
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Transiciones válidas de `estado_logistica`. Misma idea que la tabla de
 * `pedidos.ts` para el estado legacy, pero con el detalle del circuito real del
 * proveedor. `recibida_parcial`/`recibida` las decide la recepción, no el usuario.
 */
export const TRANSICIONES_LOGISTICA: Record<EstadoLogistica, EstadoLogistica[]> = {
  borrador:         ['enviada', 'cancelada'],
  enviada:          ['confirmada', 'en_preparacion', 'en_fabricacion', 'demorado', 'cancelada'],
  confirmada:       ['en_preparacion', 'en_fabricacion', 'terminado', 'listo_despacho', 'en_transito', 'demorado', 'cancelada'],
  en_preparacion:   ['en_fabricacion', 'terminado', 'listo_despacho', 'en_transito', 'demorado', 'cancelada'],
  en_fabricacion:   ['terminado', 'listo_despacho', 'en_transito', 'demorado', 'cancelada'],
  terminado:        ['listo_despacho', 'en_transito', 'demorado', 'cancelada'],
  listo_despacho:   ['en_transito', 'demorado', 'cancelada'],
  en_transito:      ['demorado', 'cancelada'],
  demorado:         ['confirmada', 'en_preparacion', 'en_fabricacion', 'terminado', 'listo_despacho', 'en_transito', 'cancelada'],
  recibida_parcial: ['demorado', 'cancelada'],
  recibida:         ['cerrada', 'cancelada'],
  cerrada:          [],
  cancelada:        [],
};

/** Estados en los que la OC ya no espera mercadería. */
export const LOGISTICA_TERMINAL: EstadoLogistica[] = ['recibida', 'cerrada', 'cancelada'];

/** Etiqueta corta para bitácora y mensajes (el frontend tiene su propio mapa). */
export const LOGISTICA_LABEL: Record<EstadoLogistica, string> = {
  borrador: 'Borrador', enviada: 'Enviada al proveedor', confirmada: 'Confirmada',
  en_preparacion: 'En preparación', en_fabricacion: 'En fabricación', terminado: 'Terminado',
  listo_despacho: 'Listo para despacho', en_transito: 'En tránsito', demorado: 'Demorado',
  recibida_parcial: 'Recibida parcial', recibida: 'Recibida', cerrada: 'Cerrada', cancelada: 'Cancelada',
};

/** Anota un movimiento en la bitácora de la OC. */
export async function registrarSeguimiento(client: Queryable, p: {
  pedido_id: string;
  tipo: 'envio' | 'confirmacion' | 'estado' | 'seguimiento' | 'demora' | 'nota' | 'recepcion' | 'reclamo';
  estado_logistica_nuevo?: string | null;
  respuesta_proveedor?: string | null;
  nueva_fecha_prometida?: string | null;
  observaciones?: string | null;
  created_by?: string | null;
}): Promise<void> {
  await client.query(`
    INSERT INTO compras_seguimientos
      (pedido_id, tipo, estado_logistica_nuevo, respuesta_proveedor, nueva_fecha_prometida, observaciones, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [p.pedido_id, p.tipo, p.estado_logistica_nuevo ?? null, p.respuesta_proveedor ?? null,
    p.nueva_fecha_prometida ?? null, p.observaciones ?? null, p.created_by ?? null]);
}

/**
 * Si la operación no tiene más OC activas, queda lista para entregar. Era la regla
 * inline de `pedidos.ts`; ahora la comparten el flujo viejo y las recepciones.
 */
export async function marcarOperacionListoSiCorresponde(client: Queryable, operacionId: string | null, pedidoId: string): Promise<void> {
  if (!operacionId) return;
  const { rows: [row] } = await client.query(`
    SELECT COUNT(*)::int AS pendientes FROM pedidos
    WHERE operacion_id = $1 AND id <> $2 AND estado NOT IN ('cancelado', 'recibido')
  `, [operacionId, pedidoId]);
  if (row.pendientes === 0) {
    await client.query(`
      UPDATE operaciones SET estado = 'listo', updated_at = now()
      WHERE id = $1 AND estado NOT IN ('listo', 'instalado', 'entregado', 'cancelado', 'rechazado')
    `, [operacionId]);
  }
}

/** `estado_calidad` de la OC según sus incidencias (sin reclamos / abiertas / resueltas). */
export async function recalcularEstadoCalidad(client: Queryable, pedidoId: string): Promise<void> {
  const { rows: [r] } = await client.query(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado NOT IN ('resuelta','rechazada'))::int AS abiertas
    FROM compras_incidencias WHERE pedido_id = $1
  `, [pedidoId]);
  const estado = r.total === 0 ? 'sin_reclamos' : r.abiertas > 0 ? 'reclamo_pendiente' : 'resuelto';
  await client.query(`UPDATE pedidos SET estado_calidad = $2, updated_at = now() WHERE id = $1 AND estado_calidad <> $2`, [pedidoId, estado]);
}

/**
 * Recalcula `estado_item` de cada línea y el estado de recepción de la OC.
 *
 * Un ítem está completo cuando lo conforme cubre lo pedido **o** cuando lo que faltó
 * quedó saldado por un reclamo ya cerrado: la reposición llegó (y se contabilizó en su
 * propia línea), o se acordó descuento / nota de crédito / rechazo. Sin esto, el ítem
 * que llegó roto quedaba "parcial" para siempre y la OC nunca pasaba a `recibida`.
 *
 * Devuelve el estado de recepción resultante, o null si todavía no se recibió nada.
 */
export async function recalcularRecepcionOC(client: Queryable, pedidoId: string): Promise<EstadoLogistica | null> {
  const { rows } = await client.query(`
    SELECT pi.id, pi.cantidad, pi.cantidad_recibida, pi.cantidad_conforme, pi.estado_item,
      pi.es_reposicion_reclamo,
      COALESCE((SELECT SUM(inc.cantidad_afectada) FROM compras_incidencias inc
                WHERE inc.pedido_item_id = pi.id AND inc.estado IN ('resuelta','rechazada')), 0) AS cubierto_por_reclamos
    FROM pedido_items pi WHERE pi.pedido_id = $1
  `, [pedidoId]);

  let pendientes = 0, vivos = 0, conMovimiento = 0;
  for (const r of rows as Fila[]) {
    if (r.estado_item === 'cancelado') continue;
    const pedida    = num(r.cantidad);
    const conforme  = num(r.cantidad_conforme);
    const recibida  = num(r.cantidad_recibida);
    const saldado   = conforme + num(r.cubierto_por_reclamos);
    const completo  = saldado + 0.001 >= pedida;
    const estado    = completo ? 'recibido' : recibida > 0 ? 'parcial' : 'pendiente';
    if (estado !== r.estado_item) {
      await client.query(`UPDATE pedido_items SET estado_item = $2 WHERE id = $1`, [r.id, estado]);
    }
    if (recibida > 0) conMovimiento++;
    // Las líneas de reposición no deciden si la OC está completa: son el remedio de otra
    if (r.es_reposicion_reclamo) continue;
    vivos++;
    if (!completo) pendientes++;
  }

  if (conMovimiento === 0) return null;
  return vivos > 0 && pendientes === 0 ? 'recibida' : 'recibida_parcial';
}

export interface RecepcionItemInput {
  pedido_item_id: string;
  cantidad_recibida?: number;
  cantidad_conforme?: number;
  cantidad_problema?: number;
  no_recibido?: boolean;
  observaciones?: string | null;
  /** Datos del reclamo cuando la UI ya sabe qué pasó (si no, la incidencia nace 'otro'). */
  incidencia_tipo?: string | null;
  incidencia_descripcion?: string | null;
  incidencia_adjuntos?: string[];
}

export interface RecepcionInput {
  fecha?: string | null;
  remito_proveedor_nro?: string | null;
  transportista_id?: string | null;
  costo_envio_real?: number | null;
  adjuntos?: string[];
  notas?: string | null;
  items: RecepcionItemInput[];
}

export class ErrorRecepcion extends Error {
  constructor(public status: 404 | 409 | 422, message: string) { super(message); }
}

/**
 * ÚNICO camino de ingreso a stock del módulo (lo usan `/compras/.../recepciones` y el
 * flujo viejo `PATCH /pedidos/:id/estado recibido`).
 *
 * Por cada ítem: valida que lo recibido acumulado no supere lo pedido, ingresa a
 * `stock_movimientos` **solo la cantidad conforme** (antes se ingresaba la cantidad
 * pedida entera al marcar "recibido"), actualiza acumulados y `estado_item`, y crea
 * una incidencia `abierta` por cada ítem con problema. Después decide
 * `recibida_parcial` / `recibida`, sincroniza el estado legacy, cierra las incidencias
 * cuyo ítem de reposición llegó conforme y deja la operación lista si corresponde.
 */
export async function crearRecepcion(client: Queryable, pedidoId: string, b: RecepcionInput, userId: string | null): Promise<{
  recepcion_id: string; numero_secuencia: number; estado_logistica: EstadoLogistica; incidencias: { id: string; numero: string; pedido_item_id: string }[];
}> {
  const { rows: [pedido] } = await client.query(
    `SELECT * FROM pedidos WHERE id = $1 FOR UPDATE`, [pedidoId]);
  if (!pedido) throw new ErrorRecepcion(404, 'Orden no encontrada');
  if (['cancelada'].includes(pedido.estado_logistica)) throw new ErrorRecepcion(409, 'La orden está cancelada');
  if (['cerrada'].includes(pedido.estado_logistica)) throw new ErrorRecepcion(409, 'La orden ya está cerrada');
  if (pedido.estado_logistica === 'borrador') throw new ErrorRecepcion(409, 'Enviá la orden al proveedor antes de registrar la recepción');
  if (!b.items?.length) throw new ErrorRecepcion(422, 'Marcá al menos un ítem recibido');

  const { rows: itemsOC } = await client.query(
    `SELECT * FROM pedido_items WHERE pedido_id = $1 FOR UPDATE`, [pedidoId]);
  const porId = new Map((itemsOC as Fila[]).map(i => [String(i.id), i]));

  // Validación previa: nada se escribe si un renglón no cierra
  for (const it of b.items) {
    const pi = porId.get(it.pedido_item_id);
    if (!pi) throw new ErrorRecepcion(422, 'Hay ítems que no pertenecen a esta orden');
    const recibida = num(it.cantidad_recibida);
    const conforme = num(it.cantidad_conforme);
    const problema = num(it.cantidad_problema);
    if (recibida < 0 || conforme < 0 || problema < 0) throw new ErrorRecepcion(422, 'Las cantidades no pueden ser negativas');
    if (Math.abs(conforme + problema - recibida) > 0.001) {
      throw new ErrorRecepcion(422, `En "${pi.descripcion}" lo conforme (${conforme}) más lo que tiene problema (${problema}) tiene que dar lo recibido (${recibida})`);
    }
    const yaRecibida = num(pi.cantidad_recibida);
    if (yaRecibida + recibida > num(pi.cantidad) + 0.001) {
      throw new ErrorRecepcion(422, `En "${pi.descripcion}" estás recibiendo ${recibida} y ya había ${yaRecibida} de ${num(pi.cantidad)} pedidas`);
    }
    // `stock_movimientos.cantidad` es INT en todo el sistema: un decimal se redondearía
    // en silencio y dejaría el stock mal. Los productos de catálogo se cuentan por unidad;
    // lo que va en metros/m2 (perfiles, vidrios) no tiene producto_id y no toca stock.
    if (pi.producto_id && !Number.isInteger(conforme)) {
      throw new ErrorRecepcion(422, `"${pi.descripcion}" es un producto de catálogo: la cantidad conforme tiene que ser un número entero de unidades (recibiste ${conforme})`);
    }
  }

  const { rows: [seq] } = await client.query(
    `SELECT COALESCE(MAX(numero_secuencia), 0) + 1 AS n FROM compras_recepciones WHERE pedido_id = $1`, [pedidoId]);
  const numeroSecuencia = Number(seq.n);

  const { rows: [recepcion] } = await client.query(`
    INSERT INTO compras_recepciones
      (pedido_id, numero_secuencia, fecha, remito_proveedor_nro, transportista_id, costo_envio_real, adjuntos, notas, created_by)
    VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [pedidoId, numeroSecuencia, b.fecha ?? null, b.remito_proveedor_nro ?? null, b.transportista_id ?? null,
    b.costo_envio_real ?? null, JSON.stringify(b.adjuntos ?? []), b.notas ?? null, userId]);

  const incidencias: { id: string; numero: string; pedido_item_id: string }[] = [];

  for (const it of b.items) {
    const pi = porId.get(it.pedido_item_id)!;
    const recibida = num(it.cantidad_recibida);
    const conforme = num(it.cantidad_conforme);
    const problema = num(it.cantidad_problema);
    const noRecibido = !!it.no_recibido;

    const { rows: [ri] } = await client.query(`
      INSERT INTO compras_recepcion_items
        (recepcion_id, pedido_item_id, cantidad_recibida, cantidad_conforme, cantidad_problema, no_recibido, observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
    `, [recepcion.id, pi.id, recibida, conforme, problema, noRecibido, it.observaciones ?? null]);

    // Stock: SOLO lo conforme, y solo si el ítem tiene producto de catálogo
    if (conforme > 0 && pi.producto_id) {
      await client.query(`
        INSERT INTO stock_movimientos
          (producto_id, tipo, cantidad, costo_unitario, motivo, operacion_id, referencia_nro, created_by)
        VALUES ($1, 'ingreso', $2, $3, $4, $5, $6, $7)
      `, [pi.producto_id, Math.abs(conforme), num(pi.precio_unitario_neto) || num(pi.costo_unitario) || null,
        `Recepción de compra (${numeroSecuencia === 1 ? 'entrega' : `entrega ${numeroSecuencia}`})`,
        pedido.operacion_id ?? null, pedido.numero, userId]);
    }

    // Acumulados de la línea; `estado_item` lo decide recalcularRecepcionOC() al final,
    // que además tiene en cuenta lo saldado por reclamos cerrados.
    await client.query(`
      UPDATE pedido_items SET cantidad_recibida = $2, cantidad_conforme = $3, cantidad_problema = $4
      WHERE id = $1
    `, [pi.id, num(pi.cantidad_recibida) + recibida, num(pi.cantidad_conforme) + conforme, num(pi.cantidad_problema) + problema]);

    if (problema > 0) {
      const numero = await nextNumeroCompra(client, 'REC');
      const { rows: [inc] } = await client.query(`
        INSERT INTO compras_incidencias
          (numero, pedido_id, pedido_item_id, recepcion_item_id, tipo, cantidad_afectada, descripcion, adjuntos, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, numero
      `, [numero, pedidoId, pi.id, ri.id, it.incidencia_tipo || 'otro', problema,
        it.incidencia_descripcion ?? it.observaciones ?? null, JSON.stringify(it.incidencia_adjuntos ?? []), userId]);
      incidencias.push({ id: inc.id, numero: inc.numero, pedido_item_id: String(pi.id) });
    }
  }

  // Una incidencia con reposición se cierra sola cuando su ítem de reposición llegó
  // conforme (se compara contra las cantidades, no contra estado_item: ese se recalcula
  // después y dependería del orden).
  await client.query(`
    UPDATE compras_incidencias inc SET estado = 'resuelta', resuelta_at = now(), updated_at = now()
    FROM pedido_items rep
    WHERE rep.id = inc.reposicion_pedido_item_id AND inc.pedido_id = $1
      AND inc.estado = 'en_reposicion' AND rep.cantidad_conforme + 0.001 >= rep.cantidad
  `, [pedidoId]);

  // Reflejo en la carpeta digital: el remito y las fotos del reclamo quedan archivados
  // sin que nadie los vuelva a subir (idempotente por url).
  await registrarDocs(client, b.adjuntos, {
    pedido_id: pedidoId, tipo: 'remito',
    nombre: b.remito_proveedor_nro ? `Remito ${b.remito_proveedor_nro}` : `Remito de entrega ${numeroSecuencia}`,
    numero: b.remito_proveedor_nro ?? null, fecha: b.fecha ?? null, origen_id: recepcion.id, created_by: userId,
  });
  for (const it of b.items) {
    if (!it.incidencia_adjuntos?.length) continue;
    await registrarDocs(client, it.incidencia_adjuntos, {
      pedido_id: pedidoId, tipo: 'foto_incidencia', nombre: 'Foto del problema',
      fecha: b.fecha ?? null, created_by: userId,
    });
  }

  // Flete real: reemplaza el estimado y recalcula el total (igual que el flujo viejo)
  if (b.costo_envio_real != null) {
    await client.query(`UPDATE pedidos SET costo_envio = $2 WHERE id = $1`, [pedidoId, b.costo_envio_real]);
    await recalcularTotalesOC(client, pedidoId);
  }

  const nuevoLogistica = (await recalcularRecepcionOC(client, pedidoId)) ?? 'recibida_parcial';
  const todoRecibido = nuevoLogistica === 'recibida';

  await client.query(`
    UPDATE pedidos SET estado_logistica = $2, fecha_recepcion = COALESCE($3::date, CURRENT_DATE),
      transportista_id = COALESCE($4::uuid, transportista_id), updated_at = now()
    WHERE id = $1
  `, [pedidoId, nuevoLogistica, b.fecha ?? null, b.transportista_id ?? null]);
  await sincronizarEstadoLegacy(client, pedidoId);
  await recalcularEstadoCalidad(client, pedidoId);

  await registrarSeguimiento(client, {
    pedido_id: pedidoId, tipo: 'recepcion', estado_logistica_nuevo: nuevoLogistica,
    observaciones: `Entrega ${numeroSecuencia}${b.remito_proveedor_nro ? ` · remito ${b.remito_proveedor_nro}` : ''}` +
      (incidencias.length ? ` · ${incidencias.length} ítem${incidencias.length === 1 ? '' : 's'} con problema` : ''),
    created_by: userId,
  });

  if (todoRecibido) {
    await marcarOperacionListoSiCorresponde(client, pedido.operacion_id, pedidoId);
    // Proveedores que no facturan (`factura_al_recibir`): la compra se asienta en la cuenta
    // corriente al recibir, porque no va a llegar ninguna factura que la dispare. Una sola vez.
    const { rows: [prov] } = await client.query(
      `SELECT factura_al_recibir FROM proveedores WHERE id = $1`, [pedido.proveedor_id]);
    if (prov?.factura_al_recibir) {
      const { rows: [ya] } = await client.query(
        `SELECT 1 FROM proveedor_cc_movimientos WHERE pedido_id = $1 AND tipo = 'compra' LIMIT 1`, [pedidoId]);
      if (!ya) {
        const { rows: [oc] } = await client.query(`SELECT total FROM pedidos WHERE id = $1`, [pedidoId]);
        await asentarMovimiento(client, {
          proveedor_id: pedido.proveedor_id, tipo: 'compra', monto: num(oc?.total),
          fecha: b.fecha ?? null, pedido_id: pedidoId,
          concepto: `Compra ${pedido.numero} (proveedor sin factura)`, created_by: userId,
        });
      }
    }
    await recalcularEstadoFinanzas(client, pedidoId);
    await actualizarCierreTotal(client, pedidoId);
  }

  return { recepcion_id: recepcion.id, numero_secuencia: numeroSecuencia, estado_logistica: nuevoLogistica, incidencias };
}

/**
 * Cancelar una OC que ya recibió mercadería devuelve al stock lo que había ingresado
 * (movimientos `devolucion`). Antes el ingreso al recibir no tenía contrapartida al
 * cancelar: el stock quedaba inflado.
 */
export async function revertirStockDeRecepciones(client: Queryable, pedidoId: string, userId: string | null): Promise<number> {
  const { rows } = await client.query(`
    SELECT pi.id, pi.producto_id, pi.descripcion, pi.cantidad_conforme, pi.precio_unitario_neto, pi.costo_unitario,
      p.numero, p.operacion_id
    FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
    WHERE pi.pedido_id = $1 AND pi.producto_id IS NOT NULL AND pi.cantidad_conforme > 0
  `, [pedidoId]);
  for (const r of rows as Fila[]) {
    await client.query(`
      INSERT INTO stock_movimientos
        (producto_id, tipo, cantidad, costo_unitario, motivo, operacion_id, referencia_nro, created_by)
      VALUES ($1, 'devolucion', $2, $3, 'Cancelación de orden de compra recibida', $4, $5, $6)
    `, [r.producto_id, -Math.abs(num(r.cantidad_conforme)), num(r.precio_unitario_neto) || num(r.costo_unitario) || null,
      r.operacion_id ?? null, r.numero, userId]);
  }
  return rows.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Etapa 3 — documentos, facturas, cuenta corriente, pagos, cierre
// ═══════════════════════════════════════════════════════════════════════════════

export type TipoDocumento =
  | 'cotizacion' | 'orden_compra' | 'remito' | 'factura' | 'nota_credito' | 'nota_debito'
  | 'comprobante_pago' | 'foto_incidencia' | 'otro';

/**
 * Guarda un archivo en la carpeta digital de la OC. Es idempotente por (pedido_id, url):
 * los adjuntos cargados en la cotización, la recepción, un reclamo o un pago se reflejan
 * acá automáticamente, sin que nadie tenga que subirlos dos veces.
 */
export async function registrarDoc(client: Queryable, d: {
  pedido_id: string;
  tipo: TipoDocumento;
  url: string;
  nombre?: string | null;
  numero?: string | null;
  fecha?: string | null;
  monto?: number | null;
  origen_id?: string | null;
  notas?: string | null;
  created_by?: string | null;
}): Promise<void> {
  if (!d.url) return;
  await client.query(`
    INSERT INTO compras_documentos (pedido_id, tipo, url, nombre, numero, fecha, monto, origen_id, notas, created_by)
    VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8,$9,$10)
    ON CONFLICT (pedido_id, url) DO UPDATE SET
      tipo = EXCLUDED.tipo, nombre = COALESCE(EXCLUDED.nombre, compras_documentos.nombre),
      numero = COALESCE(EXCLUDED.numero, compras_documentos.numero),
      monto = COALESCE(EXCLUDED.monto, compras_documentos.monto)
  `, [d.pedido_id, d.tipo, d.url, d.nombre ?? null, d.numero ?? null, d.fecha ?? null,
    d.monto ?? null, d.origen_id ?? null, d.notas ?? null, d.created_by ?? null]);
  await recalcularEstadoDocs(client, d.pedido_id);
}

/** Varios adjuntos del mismo origen (fotos de un reclamo, comprobantes de un pago). */
export async function registrarDocs(client: Queryable, urls: string[] | null | undefined, base: Omit<Parameters<typeof registrarDoc>[1], 'url'>): Promise<void> {
  for (const url of urls ?? []) await registrarDoc(client, { ...base, url });
}

/**
 * La carpeta está completa cuando están la OC, la factura y —si hubo recepción— el remito.
 * Es lo mínimo para poder archivar la compra sin tener que buscar papeles después.
 */
export async function recalcularEstadoDocs(client: Queryable, pedidoId: string): Promise<'completa' | 'incompleta'> {
  const { rows: [r] } = await client.query(`
    SELECT
      EXISTS (SELECT 1 FROM compras_documentos d WHERE d.pedido_id = $1 AND d.tipo = 'orden_compra') AS tiene_oc,
      EXISTS (SELECT 1 FROM compras_facturas f WHERE f.pedido_id = $1) AS tiene_factura,
      EXISTS (SELECT 1 FROM compras_recepciones r WHERE r.pedido_id = $1) AS hubo_recepcion,
      EXISTS (SELECT 1 FROM compras_documentos d WHERE d.pedido_id = $1 AND d.tipo = 'remito') AS tiene_remito
  `, [pedidoId]);
  const completa = r.tiene_oc && r.tiene_factura && (!r.hubo_recepcion || r.tiene_remito);
  const estado = completa ? 'completa' : 'incompleta';
  await client.query(`UPDATE pedidos SET estado_docs = $2, updated_at = now() WHERE id = $1 AND estado_docs <> $2`, [pedidoId, estado]);
  return estado;
}

// ── Cuenta corriente ──────────────────────────────────────────────────────────

export type TipoMovimientoCC = 'saldo_inicial' | 'compra' | 'debito' | 'pago' | 'credito' | 'anticipo' | 'ajuste';

/**
 * ÚNICO lugar que escribe el libro mayor del proveedor. Convención: monto positivo
 * aumenta lo que le debemos (compra, débito), negativo lo reduce (pago, crédito,
 * anticipo). Ninguna ruta escribe `proveedor_cc_movimientos` directamente.
 */
export async function asentarMovimiento(client: Queryable, m: {
  proveedor_id: string;
  tipo: TipoMovimientoCC;
  monto: number;
  fecha?: string | null;
  pedido_id?: string | null;
  factura_id?: string | null;
  pago_id?: string | null;
  nota_id?: string | null;
  incidencia_id?: string | null;
  concepto?: string | null;
  created_by?: string | null;
}): Promise<string> {
  // Los tipos que reducen la deuda se guardan siempre en negativo, venga como venga
  const reduce = ['pago', 'credito', 'anticipo'].includes(m.tipo);
  const monto = reduce ? -Math.abs(m.monto) : m.monto;
  const { rows: [row] } = await client.query(`
    INSERT INTO proveedor_cc_movimientos
      (proveedor_id, fecha, tipo, monto, pedido_id, factura_id, pago_id, nota_id, incidencia_id, concepto, created_by)
    VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [m.proveedor_id, m.fecha ?? null, m.tipo, monto, m.pedido_id ?? null, m.factura_id ?? null,
    m.pago_id ?? null, m.nota_id ?? null, m.incidencia_id ?? null, m.concepto ?? null, m.created_by ?? null]);
  return row.id;
}

export interface SaldoOC {
  facturado: number;
  pagado: number;
  creditos: number;
  /** Lo que todavía se le debe por esta OC. */
  saldo: number;
  orden: number;
  cotizado: number;
}

/** Números del control económico de una OC: cotizado / orden / facturado y su saldo. */
export async function saldoDeOC(client: Queryable, pedidoId: string): Promise<SaldoOC> {
  const { rows: [r] } = await client.query(`
    SELECT
      p.total::numeric AS orden,
      COALESCE((SELECT cp.total FROM compras_cotizacion_proveedores cp WHERE cp.id = p.cotizacion_proveedor_id), 0)::numeric AS cotizado,
      COALESCE((SELECT SUM(f.total) FROM compras_facturas f WHERE f.pedido_id = p.id), 0)::numeric AS facturado,
      COALESCE((SELECT SUM(a.monto) FROM proveedor_pago_aplicaciones a WHERE a.pedido_id = p.id), 0)::numeric AS pagado,
      COALESCE((SELECT SUM(n.monto) FROM proveedor_notas n WHERE n.pedido_id = p.id AND n.tipo = 'credito'), 0)::numeric AS creditos
    FROM pedidos p WHERE p.id = $1
  `, [pedidoId]);
  const facturado = num(r?.facturado);
  const pagado = num(r?.pagado);
  const creditos = num(r?.creditos);
  return {
    orden: num(r?.orden), cotizado: num(r?.cotizado), facturado, pagado, creditos,
    saldo: Math.round((facturado - pagado - creditos) * 100) / 100,
  };
}

/**
 * `estado_finanzas` de la OC. `con_credito` es el caso en que se pagó o acreditó de más
 * (una nota de crédito posterior al pago): queda saldo a favor contra esa compra.
 */
export async function recalcularEstadoFinanzas(client: Queryable, pedidoId: string): Promise<string> {
  const s = await saldoDeOC(client, pedidoId);
  let estado: string;
  if (s.facturado <= 0) estado = 'sin_factura';
  else if (s.saldo <= -0.01) estado = 'con_credito';
  else if (s.saldo <= 0.01) estado = 'pagada';
  else if (s.pagado + s.creditos > 0.01) estado = 'pago_parcial';
  else estado = 'pendiente';
  await client.query(`UPDATE pedidos SET estado_finanzas = $2, updated_at = now() WHERE id = $1 AND estado_finanzas <> $2`, [pedidoId, estado]);
  return estado;
}

// ── Cierre de la compra ───────────────────────────────────────────────────────

export interface ChecklistCierre {
  puede_cerrar: boolean;
  cerrada_totalmente: boolean;
  items: { clave: string; label: string; ok: boolean; detalle?: string }[];
}

/**
 * Qué falta para cerrar la compra. El cierre logístico (`cerrada`) pide mercadería
 * completa, sin reclamos abiertos y el control hecho; el sello "cerrada totalmente"
 * suma saldo 0 y la carpeta de documentos completa.
 */
export async function checklistCierre(client: Queryable, pedidoId: string): Promise<ChecklistCierre> {
  const [{ rows: [p] }, saldo] = await Promise.all([
    client.query(`
      SELECT p.*,
        (SELECT COUNT(*)::int FROM pedido_items pi WHERE pi.pedido_id = p.id
           AND pi.estado_item NOT IN ('recibido','cancelado')) AS items_pendientes,
        (SELECT COUNT(*)::int FROM compras_incidencias i WHERE i.pedido_id = p.id
           AND i.estado NOT IN ('resuelta','rechazada')) AS reclamos_abiertos
      FROM pedidos p WHERE p.id = $1
    `, [pedidoId]),
    saldoDeOC(client, pedidoId),
  ]);
  if (!p) return { puede_cerrar: false, cerrada_totalmente: false, items: [] };

  const recibida = ['recibida', 'cerrada'].includes(p.estado_logistica);
  const items = [
    { clave: 'mercaderia', label: 'Mercadería recibida completa', ok: recibida && p.items_pendientes === 0,
      detalle: p.items_pendientes > 0 ? `${p.items_pendientes} ítem(s) sin recibir` : undefined },
    { clave: 'reclamos', label: 'Sin reclamos abiertos', ok: p.reclamos_abiertos === 0,
      detalle: p.reclamos_abiertos > 0 ? `${p.reclamos_abiertos} reclamo(s) pendiente(s)` : undefined },
    { clave: 'control', label: 'Control realizado', ok: !!p.control_realizado_at },
    { clave: 'factura', label: 'Factura cargada', ok: saldo.facturado > 0 },
    { clave: 'saldo', label: 'Saldo en cero', ok: Math.abs(saldo.saldo) <= 0.01,
      detalle: Math.abs(saldo.saldo) > 0.01 ? `Falta pagar ${saldo.saldo.toFixed(2)}` : undefined },
    { clave: 'docs', label: 'Documentación completa', ok: p.estado_docs === 'completa' },
  ];
  const puede_cerrar = items.filter(i => ['mercaderia', 'reclamos', 'control'].includes(i.clave)).every(i => i.ok);
  const cerrada_totalmente = items.every(i => i.ok);
  return { puede_cerrar, cerrada_totalmente, items };
}

/**
 * Pone el sello "cerrada totalmente" cuando ya no queda nada pendiente (mercadería,
 * reclamos, control, factura, saldo y documentos). Se llama después de cada pago,
 * factura, nota o documento nuevo: el cierre no depende de que alguien se acuerde.
 */
export async function actualizarCierreTotal(client: Queryable, pedidoId: string): Promise<boolean> {
  const chk = await checklistCierre(client, pedidoId);
  if (chk.cerrada_totalmente) {
    await client.query(
      `UPDATE pedidos SET cerrada_totalmente_at = COALESCE(cerrada_totalmente_at, now()), updated_at = now() WHERE id = $1`,
      [pedidoId]);
  } else {
    await client.query(
      `UPDATE pedidos SET cerrada_totalmente_at = NULL, updated_at = now() WHERE id = $1 AND cerrada_totalmente_at IS NOT NULL`,
      [pedidoId]);
  }
  return chk.cerrada_totalmente;
}
