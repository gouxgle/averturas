ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS estado_civil            text,
  ADD COLUMN IF NOT EXISTS email_alternativo        text,
  ADD COLUMN IF NOT EXISTS codigo_postal            text,
  ADD COLUMN IF NOT EXISTS dom_alternativo          text,
  ADD COLUMN IF NOT EXISTS dom_alternativo_localidad text,
  ADD COLUMN IF NOT EXISTS dom_alternativo_cp       text,
  ADD COLUMN IF NOT EXISTS dom_alternativo_referencia text,
  ADD COLUMN IF NOT EXISTS condicion_iva            text;

INSERT INTO schema_migrations (filename)
  VALUES ('20260512000002_clientes_nuevos_campos.sql')
  ON CONFLICT DO NOTHING;
