-- Changelog: Corregido: editar un cliente partía el apellido compuesto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corregido: editar un cliente partía el apellido compuesto', 'Al abrir y guardar un cliente cuyo apellido tiene dos o más palabras (Ruiz Diaz, De la Fuente), el apellido quedaba cortado en la primera palabra y el resto se pasaba al nombre. El campo ahora muestra "Apellido, Nombre" con la coma y el dato sobrevive a la edición.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260910000002_changelog_corregido_editar_un_cliente_partia_el_ap.sql') ON CONFLICT DO NOTHING;
