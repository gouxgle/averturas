-- Para que la campanita de notificaciones también avise cuando un cliente confirma
-- la recepción de un remito "con observaciones" o "no conforme" — hoy ese aviso solo
-- se ve entrando manualmente al listado de Remitos.
ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS notif_leida boolean NOT NULL DEFAULT false;

-- Remitos ya confirmados antes de esta feature: no generar notificaciones retroactivas
-- de eventos que ya pasaron y probablemente ya se atendieron.
UPDATE remitos SET notif_leida = true WHERE recepcion_estado IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260805000002_remitos_notif_leida.sql') ON CONFLICT DO NOTHING;
