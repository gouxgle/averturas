-- Changelog: Fotos de iPhone no se subían en Visita de Relevamiento de Datos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Fotos de iPhone no se subían en Visita de Relevamiento de Datos', 'El iPhone guarda las fotos de cámara en formato HEIC por defecto, que el servidor no podía procesar y devolvía ''no se pudo subir la foto''. Ahora se convierte a JPEG automáticamente antes de subir, y si algo falla igual se muestra un mensaje concreto en vez de uno genérico.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260826000003_changelog_fotos_de_iphone_no_se_subian_en_visita_d.sql') ON CONFLICT DO NOTHING;
