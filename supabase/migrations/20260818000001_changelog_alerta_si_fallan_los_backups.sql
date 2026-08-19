-- Changelog: Alerta si fallan los backups
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Alerta si fallan los backups', 'Si los backups automaticos dejan de subir a Google Drive, ahora aparece un aviso destacado en el Dashboard (solo para administradores) en vez de quedar en silencio. Antes habia que entrar a Configuracion a revisarlo a mano.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260818000001_changelog_alerta_si_fallan_los_backups.sql') ON CONFLICT DO NOTHING;
