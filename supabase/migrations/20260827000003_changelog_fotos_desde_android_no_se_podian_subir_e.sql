-- Changelog: Fotos desde Android no se podian subir en Visita de Relevamiento
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Fotos desde Android no se podian subir en Visita de Relevamiento', 'Algunos celulares Android entregaban la foto capturada con un nombre de archivo sin extension reconocible, y se rechazaba antes de procesarla. Ahora se valida primero por el tipo de imagen real que informa el navegador.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260827000003_changelog_fotos_desde_android_no_se_podian_subir_e.sql') ON CONFLICT DO NOTHING;
