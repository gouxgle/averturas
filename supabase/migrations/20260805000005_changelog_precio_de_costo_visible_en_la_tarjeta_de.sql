-- Changelog: Precio de costo visible en la tarjeta del catalogo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Precio de costo visible en la tarjeta del catalogo', 'La tarjeta de producto en Catalogo ahora muestra el precio de costo debajo del precio de venta, en gris tenue, para analizar margenes sin entrar a la ficha de cada producto.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000005_changelog_precio_de_costo_visible_en_la_tarjeta_de.sql') ON CONFLICT DO NOTHING;
