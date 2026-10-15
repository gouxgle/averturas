-- Devoluciones etapa 4: cambio de producto. El producto nuevo es una operación aparte (entregada en el
-- momento, con su remito y su egreso de stock) enlazada a la devolución que la origina; la operación
-- original no se toca (sigue siendo la base de su factura o nota de crédito).
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS es_cambio BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS devolucion_origen_id UUID REFERENCES devoluciones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_operaciones_devolucion_origen ON operaciones(devolucion_origen_id) WHERE devolucion_origen_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20261015000006_cambios.sql') ON CONFLICT DO NOTHING;
