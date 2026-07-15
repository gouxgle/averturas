ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS enviado_wa_at TIMESTAMPTZ;
INSERT INTO schema_migrations (filename) VALUES ('20260714000002_operaciones_enviado_wa.sql') ON CONFLICT DO NOTHING;
