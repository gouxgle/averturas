-- Changelog: Guardar un producto y cargar la variante de otro proveedor
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Guardar un producto y cargar la variante de otro proveedor', 'En Nuevo producto, un botón nuevo guarda el producto actual y deja todos los datos cargados (medidas, atributos, precios, imágenes) para agregar la misma abertura de otro proveedor — solo hace falta cambiar Proveedor y Código.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260906000001_changelog_guardar_un_producto_y_cargar_la_variante.sql') ON CONFLICT DO NOTHING;
