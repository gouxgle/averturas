-- Changelog: Con stock no hace falta confirmar disponibilidad
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Con stock no hace falta confirmar disponibilidad', 'El stock ya es prueba suficiente — la confirmación con proveedor ahora solo aplica a productos sin stock.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260729000003_changelog_con_stock_no_hace_falta_confirmar_dispon.sql') ON CONFLICT DO NOTHING;
