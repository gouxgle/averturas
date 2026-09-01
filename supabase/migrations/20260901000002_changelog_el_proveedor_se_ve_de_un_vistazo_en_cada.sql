-- Changelog: El proveedor se ve de un vistazo en cada producto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El proveedor se ve de un vistazo en cada producto', 'Cada tarjeta del catálogo, de venta rápida y de las galerías de presupuesto/pedido lleva ahora una franja de color a todo el ancho con el nombre del proveedor, en lugar de una etiqueta chica. El modal de detalle del producto muestra la misma franja arriba y un bloque destacado con el proveedor.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260901000002_changelog_el_proveedor_se_ve_de_un_vistazo_en_cada.sql') ON CONFLICT DO NOTHING;
