-- Campos específicos para productos a medida / fabricación propia
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS vidrio    TEXT,
  ADD COLUMN IF NOT EXISTS premarco  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accesorios TEXT[]  NOT NULL DEFAULT '{}';

INSERT INTO schema_migrations (filename) VALUES ('20260421000001_productos_medida_fields.sql')
  ON CONFLICT DO NOTHING;
