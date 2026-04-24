-- Agrega domicilio de obra a clientes (para entregas en obra)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS dom_obra          TEXT,
  ADD COLUMN IF NOT EXISTS dom_obra_localidad TEXT;

INSERT INTO schema_migrations (filename) VALUES ('20260424000001_clientes_domicilio_obra.sql')
  ON CONFLICT DO NOTHING;
