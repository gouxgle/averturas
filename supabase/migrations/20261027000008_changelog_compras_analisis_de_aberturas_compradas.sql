-- Changelog: Compras: análisis de aberturas compradas
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Compras: análisis de aberturas compradas', 'Nueva pestaña Análisis en Compras: las órdenes de compra agrupadas por sistema, tipología, tipo de abertura, vidrio, color o proveedor, con unidades, m², monto, precio por m² y reclamos.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261027000008_changelog_compras_analisis_de_aberturas_compradas.sql') ON CONFLICT DO NOTHING;
