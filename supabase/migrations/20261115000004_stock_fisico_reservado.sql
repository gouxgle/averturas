-- Stock: una sola definición (2026-11-14). La reserva deja de bajar el stock FÍSICO:
--   físico     = stock_inicial + movimientos reales (todo menos 'reserva')
--   reservado  = lo comprometido por ventas señadas (movimientos 'reserva', netos)
--   disponible = físico − reservado (opcionalmente sin contar la reserva de una operación:
--                para entregar SU propia venta, su reserva no le resta)
-- La reserva nace con el primer recibo (lib/reservas.ts → reservarPorPago), ya no con la aprobación.

CREATE INDEX IF NOT EXISTS idx_stock_mov_producto_tipo ON stock_movimientos (producto_id, tipo);

CREATE OR REPLACE FUNCTION stock_fisico(p_producto uuid) RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT (COALESCE((SELECT stock_inicial FROM catalogo_productos WHERE id = p_producto), 0)
        + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos
                     WHERE producto_id = p_producto AND tipo <> 'reserva'), 0))::int
$$;

CREATE OR REPLACE FUNCTION stock_reservado(p_producto uuid, p_excluir_operacion uuid DEFAULT NULL) RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0, -COALESCE((SELECT SUM(cantidad) FROM stock_movimientos
                     WHERE producto_id = p_producto AND tipo = 'reserva'
                       AND operacion_id IS DISTINCT FROM p_excluir_operacion), 0))::int
$$;

CREATE OR REPLACE FUNCTION stock_disponible(p_producto uuid, p_excluir_operacion uuid DEFAULT NULL) RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT stock_fisico(p_producto) - stock_reservado(p_producto, p_excluir_operacion)
$$;

INSERT INTO schema_migrations (filename) VALUES ('20261115000004_stock_fisico_reservado.sql') ON CONFLICT DO NOTHING;
