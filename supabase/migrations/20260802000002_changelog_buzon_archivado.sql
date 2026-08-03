-- Changelog: Archivar comentarios del buzón
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Archivar comentarios del buzón', 'Opción manual para archivar comentarios ya leídos (pendientes o resueltos), independiente del estado de resolución. Sección "Archivados" en el panel para verlos y restaurarlos.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260802000002_changelog_buzon_archivado.sql') ON CONFLICT DO NOTHING;
