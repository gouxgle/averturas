-- Campos de logística y evaluación para proveedores
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS forma_entrega  text    DEFAULT 'propia',
  ADD COLUMN IF NOT EXISTS plazo_entrega_dias integer,
  ADD COLUMN IF NOT EXISTS costo_flete    numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calificacion   smallint CHECK (calificacion BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS deuda_actual   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_principal   boolean NOT NULL DEFAULT false;

INSERT INTO schema_migrations (filename)
VALUES ('20260509000001_proveedores_logistica.sql')
ON CONFLICT DO NOTHING;
