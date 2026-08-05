-- Changelog: Galeria de Venta rapida igual a la del catalogo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Galeria de Venta rapida igual a la del catalogo', 'La galeria de productos en Venta rapida de mostrador ahora usa la misma tarjeta y los mismos datos que el Catalogo (precio de costo, promociones, etiquetas, nivel comercial, margen) en vez de una version simplificada.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000007_changelog_galeria_de_venta_rapida_igual_a_la_del_c.sql') ON CONFLICT DO NOTHING;
