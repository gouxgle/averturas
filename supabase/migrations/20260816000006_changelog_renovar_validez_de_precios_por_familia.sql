-- Changelog: Renovar validez de precios por familia
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Renovar validez de precios por familia', 'Nuevo boton en Productos para renovar en lote la fecha de actualizacion de precios de una o varias familias de aberturas (ventanas, puertas, etc), sin tener que revisar producto por producto ni cambiar ningun precio.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260816000006_changelog_renovar_validez_de_precios_por_familia.sql') ON CONFLICT DO NOTHING;
