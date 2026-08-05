-- Changelog: Corrige etiqueta Conforme en items del remito
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corrige etiqueta Conforme en items del remito', 'El estado del producto (Nuevo/Bueno/Con detalles) mostraba Conforme en vez de Nuevo, confundiendose con la confirmacion de recepcion del cliente que es un campo distinto.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260805000001_changelog_corrige_etiqueta_conforme_en_items_del_r.sql') ON CONFLICT DO NOTHING;
