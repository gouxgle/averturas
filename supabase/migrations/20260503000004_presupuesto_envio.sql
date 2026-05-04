-- Forma y costo de envío en operaciones; producto_id en ítems para trazabilidad
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS forma_envio TEXT    NOT NULL DEFAULT 'retiro_local',
  ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN operaciones.forma_envio IS 'retiro_local | envio_bonificado | envio_destino | envio_empresa';
COMMENT ON COLUMN operaciones.costo_envio IS 'Costo de envío cuando forma_envio = envio_empresa. Se suma al total.';

ALTER TABLE operacion_items
  ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operacion_items_producto ON operacion_items(producto_id)
  WHERE producto_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260503000004_presupuesto_envio.sql')
  ON CONFLICT DO NOTHING;
