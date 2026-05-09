-- Objetivo de ventas mensual configurable en empresa
ALTER TABLE empresa
  ADD COLUMN IF NOT EXISTS objetivo_ventas_mensual numeric(14,2) NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (filename)
VALUES ('20260509000002_empresa_objetivo.sql')
ON CONFLICT DO NOTHING;
