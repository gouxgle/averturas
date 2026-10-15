-- Changelog: Devoluciones de clientes
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Devoluciones de clientes', 'Nueva sección Devoluciones: se registra la mercadería que vuelve, por ítem y cantidad, desde el remito o el presupuesto. Cada ítem vuelve a stock o no reingresa (queda como pérdida con su motivo). El valor se calcula descontando la bonificación que tuvo la compra: primero baja lo que el cliente todavía debía y lo que sobra queda como saldo a favor suyo. Los productos a medida solo los devuelve un administrador. Incluye comprobante imprimible y se ve en el estado de cuenta del cliente.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261015000004_changelog_devoluciones_de_clientes.sql') ON CONFLICT DO NOTHING;
