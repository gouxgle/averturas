-- Changelog: Revisión integral de precios
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Revisión integral de precios', 'Nueva pantalla en Productos que analiza cada producto (lista del proveedor, última compra, recargo, dólar blue e inflación) y sugiere qué renovar y qué actualizar. Renovar validez trae marcados los que no variaron. Actualizar precios agrupa por familia, línea o proveedor, ordena por prioridad, marca recargos raros y aplica el criterio elegido (sugerido, porcentaje, dólar, costo + recargo o porcentaje por grupo) con redondeo y vista previa. Lista del proveedor: se carga su lista en Excel o CSV y se analizan solo sus productos. Queda historial de cada cambio de precio.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261002000002_changelog_revision_integral_de_precios.sql') ON CONFLICT DO NOTHING;
