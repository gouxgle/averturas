-- Changelog: Corregido error al guardar proveedor
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corregido error al guardar proveedor', 'Editar un proveedor y guardar sin tocar los campos de Costo flete, Deuda actual o Margen de venta ya no muestra un falso ''completá los datos'' — los valores existentes se aceptan tal como vienen.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260905000003_changelog_corregido_error_al_guardar_proveedor.sql') ON CONFLICT DO NOTHING;
