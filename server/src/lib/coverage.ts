/**
 * Regla de "cobertura" de los ítems de una operación — ÚNICA fuente de verdad.
 *
 * Antes estaba copiada cinco veces (pedidos.ts ×3, operaciones.ts ×2) con
 * diferencias sutiles entre copias. Acá viven los predicados SQL como fragmentos
 * de texto que se interpolan en las queries; todos asumen que el ítem se llama
 * `oi` (alias de `operacion_items`) en el scope donde se usan.
 *
 * Tres hechos sobre un ítem:
 *   - está en un pedido al proveedor activo (no cancelado)
 *   - hay stock suficiente para cumplirlo sin pedir
 *   - es un servicio (mano de obra: nunca se pide al proveedor)
 *
 * Un ítem está CUBIERTO si se cumple cualquiera de los tres.
 */

/** Stock actual del producto del ítem, con la fórmula canónica del proyecto. */
const STOCK_ACTUAL_DEL_ITEM = `(
  COALESCE((SELECT stock_inicial FROM catalogo_productos WHERE id = oi.producto_id), 0)
  + COALESCE((SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = oi.producto_id), 0)
)`;

/** El ítem tiene producto de catálogo y stock suficiente para su cantidad. */
export const ITEM_STOCK_SUFICIENTE =
  `(oi.producto_id IS NOT NULL AND ${STOCK_ACTUAL_DEL_ITEM} >= oi.cantidad)`;

/**
 * El ítem está en un pedido al proveedor no cancelado, sin contar las líneas de
 * reposición (esas se piden "de más" para reponer stock, no para cumplir el ítem).
 */
export const ITEM_EN_PEDIDO = `EXISTS (
  SELECT 1 FROM pedido_items pi2
  JOIN pedidos p2 ON p2.id = pi2.pedido_id
  WHERE pi2.operacion_item_id = oi.id AND p2.estado != 'cancelado' AND pi2.es_reposicion = false
)`;

/**
 * Variante que SÍ cuenta reposiciones. Es la semántica histórica de
 * `items_en_pedido` en el panel de ventas (badge "Envío total/parcial al
 * proveedor"): ahí la pregunta es "¿se le pidió algo al proveedor por este ítem?",
 * no "¿está cubierto?". Se mantiene aparte a propósito para no cambiar ese badge.
 */
export const ITEM_EN_PEDIDO_INCLUYENDO_REPOSICION = `EXISTS (
  SELECT 1 FROM pedido_items pi2
  JOIN pedidos p2 ON p2.id = pi2.pedido_id
  WHERE pi2.operacion_item_id = oi.id AND p2.estado != 'cancelado'
)`;

export const ITEM_ES_SERVICIO = `oi.tipo_item = 'servicio'`;

/** Cubierto = en pedido activo, o con stock, o servicio. */
export const ITEM_CUBIERTO =
  `(${ITEM_EN_PEDIDO} OR ${ITEM_STOCK_SUFICIENTE} OR ${ITEM_ES_SERVICIO})`;

/** Total de ítems de la operación `opRef` (expresión SQL que resuelve a su id). */
export function sqlItemsTotal(opRef: string): string {
  return `(SELECT COUNT(*)::int FROM operacion_items oi WHERE oi.operacion_id = ${opRef})`;
}

/** Cuántos ítems de `opRef` están cubiertos. */
export function sqlItemsCubiertos(opRef: string): string {
  return `(SELECT COUNT(*)::int FROM operacion_items oi
    WHERE oi.operacion_id = ${opRef} AND ${ITEM_CUBIERTO})`;
}

/** Cuántos ítems de `opRef` todavía hay que pedir (el complemento de cubiertos). */
export function sqlItemsPendientes(opRef: string): string {
  return `(SELECT COUNT(*)::int FROM operacion_items oi
    WHERE oi.operacion_id = ${opRef} AND NOT ${ITEM_CUBIERTO})`;
}

/** Cuántos ítems de `opRef` tienen algo pedido al proveedor (incluye reposiciones). */
export function sqlItemsEnPedidoInclReposicion(opRef: string): string {
  return `(SELECT COUNT(*)::int FROM operacion_items oi
    WHERE oi.operacion_id = ${opRef} AND ${ITEM_EN_PEDIDO_INCLUYENDO_REPOSICION})`;
}

/**
 * La operación `opRef` se cumple 100% desde stock: tiene al menos un ítem y ninguno
 * (salvo servicios) le falta stock. Estas operaciones no necesitan pedido al
 * proveedor y van directo a "Lista para entregar".
 */
export function sqlStockCubreTodo(opRef: string): string {
  return `(
    EXISTS (SELECT 1 FROM operacion_items oi WHERE oi.operacion_id = ${opRef})
    AND NOT EXISTS (
      SELECT 1 FROM operacion_items oi
      WHERE oi.operacion_id = ${opRef}
        AND NOT ${ITEM_ES_SERVICIO}
        AND NOT ${ITEM_STOCK_SUFICIENTE}
    )
  )`;
}
