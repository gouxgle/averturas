-- Changelog: Actividad ahora muestra también el historial anterior
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Actividad ahora muestra también el historial anterior', 'La sección arrancaba vacía porque solo registraba desde el día que se activó. Se cargó el historial que ya existía en el sistema: creación de presupuestos, recibos y remitos, ediciones de presupuesto y cambios de estado, con su autor y fecha reales.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260910000007_changelog_actividad_ahora_muestra_tambien_el_histo.sql') ON CONFLICT DO NOTHING;
