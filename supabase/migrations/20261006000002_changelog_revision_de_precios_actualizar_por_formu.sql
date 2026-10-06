-- Changelog: Revisión de precios: actualizar por fórmula
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Revisión de precios: actualizar por fórmula', 'Nueva pestaña «Por fórmula» en la Revisión integral de precios: calcula el precio de los productos estándar con la fórmula del negocio (costo ÷ 0,60 + 15 % + 12 % del costo, terminado en 900), los agrupa en debajo, en la fórmula, encima y posible error de carga, y deja elegir a cuáles aplicarla con vista previa. La fórmula se puede editar y tener excepciones por familia o proveedor. El asistente suma el redondeo «terminado en 900».', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261006000002_changelog_revision_de_precios_actualizar_por_formu.sql') ON CONFLICT DO NOTHING;
