-- Changelog: Duplicar producto: indicador de copia y disponible también al editar
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Duplicar producto: indicador de copia y disponible también al editar', 'Al usar ''Guardar y cargar para otro proveedor'' ahora se muestra un aviso claro (arriba y junto al botón) de que se está trabajando sobre una copia, con el nombre del producto original. Además, la misma opción para duplicar ya está disponible desde la edición de un producto (antes solo aparecía al cargar uno nuevo) — crea una copia con los datos actuales sin modificar el original.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260914000001_changelog_duplicar_producto_indicador_de_copia_y_d.sql') ON CONFLICT DO NOTHING;
