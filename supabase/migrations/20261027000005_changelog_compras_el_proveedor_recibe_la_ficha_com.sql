-- Changelog: Compras: el proveedor recibe la ficha completa
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Compras: el proveedor recibe la ficha completa', 'Los PDF de pedido de cotización y de orden de compra incluyen, por cada abertura a medida, la ficha técnica completa, el esquema y las fotos o croquis del ítem; los planos en PDF se envían adjuntos. La orden de compra conserva los adjuntos de cada ítem.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261027000005_changelog_compras_el_proveedor_recibe_la_ficha_com.sql') ON CONFLICT DO NOTHING;
