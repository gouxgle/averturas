-- Devoluciones etapa 5: aviso al administrador cuando una devolución la registra alguien que no es admin
-- (mismo patrón que reintegros/remitos: flag global notif_leida). Las que ya existen no avisan.
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS notif_leida BOOLEAN NOT NULL DEFAULT false;
UPDATE devoluciones SET notif_leida = true;

INSERT INTO schema_migrations (filename) VALUES ('20261015000007_devoluciones_cierre.sql') ON CONFLICT DO NOTHING;
