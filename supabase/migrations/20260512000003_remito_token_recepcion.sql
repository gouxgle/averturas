ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS token_acceso     uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS token_acceso_at  timestamptz,
  ADD COLUMN IF NOT EXISTS recepcion_estado text,
  ADD COLUMN IF NOT EXISTS recepcion_at     timestamptz,
  ADD COLUMN IF NOT EXISTS recepcion_obs    text;

ALTER TABLE remitos
  DROP CONSTRAINT IF EXISTS remitos_recepcion_estado_check;

ALTER TABLE remitos
  ADD CONSTRAINT remitos_recepcion_estado_check
  CHECK (recepcion_estado IS NULL OR recepcion_estado IN ('conforme','con_observaciones','no_conforme'));

INSERT INTO schema_migrations (filename)
  VALUES ('20260512000003_remito_token_recepcion.sql')
  ON CONFLICT DO NOTHING;
