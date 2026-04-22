-- Campos extendidos para proveedores del rubro aberturas
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS tipo        TEXT,        -- fabricante | revendedor | importador
  ADD COLUMN IF NOT EXISTS cuit        TEXT,
  ADD COLUMN IF NOT EXISTS direccion   TEXT,
  ADD COLUMN IF NOT EXISTS localidad   TEXT,
  ADD COLUMN IF NOT EXISTS provincia   TEXT,
  ADD COLUMN IF NOT EXISTS web         TEXT,
  ADD COLUMN IF NOT EXISTS materiales  TEXT[] NOT NULL DEFAULT '{}';
  -- aluminio, PVC, vidrio, herrajes, mosquiteros, persianas, etc.

INSERT INTO schema_migrations (filename) VALUES ('20260421000003_proveedores_campos.sql')
  ON CONFLICT DO NOTHING;
