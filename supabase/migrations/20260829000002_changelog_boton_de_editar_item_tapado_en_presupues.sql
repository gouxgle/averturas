-- Changelog: Boton de editar item tapado en presupuestos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Boton de editar item tapado en presupuestos', 'Al agregar el boton de Duplicar a cada linea del carrito, la columna de acciones quedo muy angosta para los 3 botones (editar, duplicar, eliminar) y el de editar quedaba superpuesto/dificil de usar. Se amplio la columna para que los 3 se vean bien.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260829000002_changelog_boton_de_editar_item_tapado_en_presupues.sql') ON CONFLICT DO NOTHING;
