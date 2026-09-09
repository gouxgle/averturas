-- Changelog: Buscador de productos multi-criterio
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Buscador de productos multi-criterio', 'El buscador del catálogo ahora combina varios criterios a la vez: nombre parcial, código, medida (150x100, 1,50x1,00 o 1500x1000), color, proveedor, sistema y línea. Por ejemplo "ventana blanca 150x100" filtra por las tres cosas juntas.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260909000004_changelog_buscador_de_productos_multi_criterio.sql') ON CONFLICT DO NOTHING;
