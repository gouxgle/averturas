-- Regla nueva (20261115000004): sin pago no hay reserva. Las reservas que quedaron de aprobaciones
-- online sin ningún recibo del cliente (o de presupuestos ya cancelados/rechazados) se liberan.
INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro)
SELECT m.producto_id, 'reserva', -SUM(m.cantidad), 'Reserva liberada: sin pago (regla de reserva con seña)', m.operacion_id, o.numero
FROM stock_movimientos m
JOIN operaciones o ON o.id = m.operacion_id
WHERE m.tipo = 'reserva'
  AND (o.estado IN ('cancelado', 'rechazado')
       OR NOT EXISTS (SELECT 1 FROM recibos r WHERE r.operacion_id = o.id AND r.estado = 'emitido'
                        AND NOT EXISTS (SELECT 1 FROM visitas_tecnicas vt WHERE vt.recibo_id = r.id)))
GROUP BY m.producto_id, m.operacion_id, o.numero
HAVING SUM(m.cantidad) < 0;

INSERT INTO schema_migrations (filename) VALUES ('20261115000006_liberar_reservas_sin_pago.sql') ON CONFLICT DO NOTHING;
