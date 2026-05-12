-- Instagram en empresa + campos de rechazo en operaciones
ALTER TABLE empresa
  ADD COLUMN IF NOT EXISTS instagram text;

ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS motivo_rechazo    text,
  ADD COLUMN IF NOT EXISTS comentario_rechazo text;

INSERT INTO schema_migrations (filename)
VALUES ('20260511000001_proforma_mejoras.sql')
ON CONFLICT DO NOTHING;
