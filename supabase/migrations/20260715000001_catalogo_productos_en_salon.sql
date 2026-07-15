ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS en_salon BOOLEAN NOT NULL DEFAULT false;
INSERT INTO schema_migrations (filename) VALUES ('20260715000001_catalogo_productos_en_salon.sql') ON CONFLICT DO NOTHING;
