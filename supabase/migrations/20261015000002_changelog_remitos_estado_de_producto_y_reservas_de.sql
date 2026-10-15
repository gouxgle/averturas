-- Changelog: Remitos: estado de producto y reservas de stock
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Remitos: estado de producto y reservas de stock', 'Corregido el estado de los ítems de un remito (Nuevo, Bueno, Con detalles), que daba error al guardar. Y si un presupuesto aprobado online se cancela, se rechaza o se deshace su aprobación, el stock que había reservado vuelve a estar disponible.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261015000002_changelog_remitos_estado_de_producto_y_reservas_de.sql') ON CONFLICT DO NOTHING;
