-- Índice para lookups rápidos de cobertura de ítems de operación
CREATE INDEX IF NOT EXISTS idx_pedido_items_operacion_item
  ON pedido_items(operacion_item_id)
  WHERE operacion_item_id IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260528000001_pedido_items_coverage_idx.sql')
ON CONFLICT DO NOTHING;
