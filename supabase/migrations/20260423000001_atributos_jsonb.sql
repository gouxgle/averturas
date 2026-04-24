-- Atributos específicos por tipo de producto (JSONB flexible)
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS atributos JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_catalogo_atributos ON catalogo_productos USING gin(atributos);

INSERT INTO schema_migrations (filename) VALUES ('20260423000001_atributos_jsonb.sql')
  ON CONFLICT DO NOTHING;
