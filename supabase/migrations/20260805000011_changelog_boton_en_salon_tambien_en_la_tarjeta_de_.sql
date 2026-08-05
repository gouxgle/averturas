-- Changelog: Boton En salon tambien en la tarjeta de la galeria
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Boton En salon tambien en la tarjeta de la galeria', 'El boton rapido para marcar Exhibido en salon ahora tambien esta en la tarjeta de cada producto dentro de la galeria de Catalogo, no solo en el detalle. Se ve siempre, no hace falta abrir el producto.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000011_changelog_boton_en_salon_tambien_en_la_tarjeta_de_.sql') ON CONFLICT DO NOTHING;
