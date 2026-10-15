-- Changelog: Cambio de producto en una devolución
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Cambio de producto en una devolución', 'Al registrar una devolución se puede cambiar por otro producto del catálogo con stock: se entrega en el momento con su remito. El producto nuevo se paga primero con la plata que sobra de la devolución; si cuesta más, el cliente paga la diferencia con el medio que elija (o queda pendiente de cobro), y si cuesta menos, lo que sobra queda a favor o se devuelve en dinero. Todo se registra junto: si no hay stock del producto nuevo, no se registra nada.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261015000007_changelog_cambio_de_producto_en_una_devolucion.sql') ON CONFLICT DO NOTHING;
