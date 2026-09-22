/**
 * Helpers del módulo Compras y Proveedores (SC → PC → OC). Ver docs/compras-plan.md.
 *
 * Todo lo que escribe `pedidos.estado` (legacy) o arma ítems desde un origen vive
 * acá para que las rutas de /compras y las de /pedidos (flujo viejo) no diverjan.
 */
import type { PoolClient } from 'pg';
import { db } from '../db.js';

type Queryable = Pick<PoolClient, 'query'>;

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
