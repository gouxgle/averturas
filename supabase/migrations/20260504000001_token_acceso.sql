-- Link público de aprobación para presupuestos

ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS token_acceso       UUID UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS token_acceso_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aprobado_online_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_token_acceso ON operaciones(token_acceso) WHERE token_acceso IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260504000001_token_acceso.sql') ON CONFLICT DO NOTHING;
