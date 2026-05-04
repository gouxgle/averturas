-- Campo para marcar notificaciones de aprobación online como leídas

ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS notif_leida BOOLEAN NOT NULL DEFAULT true;

-- Las aprobaciones online existentes arrancan como no leídas
UPDATE operaciones SET notif_leida = false WHERE aprobado_online_at IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260504000002_notif_leida.sql') ON CONFLICT DO NOTHING;
