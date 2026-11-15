-- Anulación de presupuestos: quién, cuándo, por qué. El estado sigue siendo 'cancelado'
-- (la UI lo muestra como "Anulado"); estas columnas guardan el registro de la anulación.
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS anulado_at        timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_por       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulacion_motivo  text,
  ADD COLUMN IF NOT EXISTS anulacion_detalle text,
  ADD COLUMN IF NOT EXISTS anulado_desde     text;  -- estado que tenía al anularse

INSERT INTO schema_migrations (filename) VALUES ('20261115000002_anulacion_presupuestos.sql') ON CONFLICT DO NOTHING;
