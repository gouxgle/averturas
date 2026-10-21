-- Changelog: Planilla Excel de precios por proveedor
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Planilla Excel de precios por proveedor', 'En Productos se puede exportar un Excel por proveedor con código, nombre, precio de lista actual, precio de venta actual y una columna en blanco para cargar el nuevo precio de lista. Después se sube en Revisión de precios → Lista del proveedor: el sistema recalcula el precio de venta y muestra la vista previa antes de aplicar.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261021000004_changelog_planilla_excel_de_precios_por_proveedor.sql') ON CONFLICT DO NOTHING;
