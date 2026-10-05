-- Facturar desde un remito: el comprobante guarda de qué remito sale (además del presupuesto).
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS remito_id UUID REFERENCES remitos(id) ON DELETE SET NULL;
ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_origen_check;
ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_origen_check CHECK (origen IN ('manual', 'operacion', 'recibo', 'remito'));
CREATE INDEX IF NOT EXISTS idx_comprobantes_remito ON comprobantes (remito_id) WHERE remito_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20261005000010_facturacion_desde_remito.sql') ON CONFLICT DO NOTHING;
