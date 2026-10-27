-- Changelog: Compras: configurador de aberturas a medida
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Compras: configurador de aberturas a medida', 'La ficha técnica de una abertura a medida se arma por pasos: tipo, tipología, medidas, hojas, sentido, sistema, color, composición, vidrio, panel, travesaños, accesorios y herrajes, mostrando solo lo que corresponde. Incluye un esquema de la abertura que se dibuja solo y la vista de ficha completa en solicitudes, cotizaciones y órdenes.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261027000003_changelog_compras_configurador_de_aberturas_a_medi.sql') ON CONFLICT DO NOTHING;
