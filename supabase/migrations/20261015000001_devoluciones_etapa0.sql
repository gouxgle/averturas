-- Etapa 0 de Devoluciones (docs: plan 2026-10-15). Dos cosas previas:
--
-- 1) Reservas de stock colgadas. La aprobación online reserva stock (tipo 'reserva' negativo) y solo
--    el remito lo liberaba: una operación cancelada, rechazada o con la aprobación deshecha dejaba el
--    stock reservado para siempre. Desde ahora las rutas lo liberan (lib/reservas.ts); acá se
--    compensan las que ya quedaron colgadas. Idempotente: tras correr, el neto por producto es 0.
INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro)
SELECT sm.producto_id, 'reserva', -SUM(sm.cantidad), 'Compensación: reserva de operación que no siguió', sm.operacion_id, o.numero
FROM stock_movimientos sm
JOIN operaciones o ON o.id = sm.operacion_id
WHERE sm.tipo = 'reserva'
  AND o.estado IN ('cancelado', 'rechazado', 'presupuesto', 'enviado')
GROUP BY sm.producto_id, sm.operacion_id, o.numero
HAVING SUM(sm.cantidad) < 0;

-- 2) Una sola definición del saldo de una operación (la fórmula estaba copiada en ~7 archivos con
--    variantes). cobrado = recibos emitidos; descuentos = bonificaciones de esos recibos (no son deuda).
--    `devuelto_a_saldo` es lo que las devoluciones aplicaron a la deuda: queda en 0 hasta la Etapa 1,
--    que reemplaza esta vista incluyéndolas.
CREATE OR REPLACE VIEW operacion_cobranza AS
SELECT
  o.id AS operacion_id,
  COALESCE(o.precio_total, 0)::numeric AS precio_total,
  COALESCE(r.cobrado, 0)::numeric      AS cobrado,
  COALESCE(r.descuentos, 0)::numeric   AS descuentos,
  0::numeric                           AS devuelto_a_saldo,
  (COALESCE(o.precio_total, 0) - COALESCE(r.cobrado, 0) - COALESCE(r.descuentos, 0))::numeric AS saldo
FROM operaciones o
LEFT JOIN LATERAL (
  SELECT SUM(monto_total) AS cobrado, SUM(monto_descuento) AS descuentos
  FROM recibos
  WHERE operacion_id = o.id AND estado = 'emitido'
) r ON true;

INSERT INTO schema_migrations (filename) VALUES ('20261015000001_devoluciones_etapa0.sql') ON CONFLICT DO NOTHING;
