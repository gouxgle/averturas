-- Changelog: Compras: solicitudes, cotizaciones y órdenes de compra
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Compras: solicitudes, cotizaciones y órdenes de compra', 'La sección Pedidos pasa a llamarse Compras. Ahora cada compra arranca con una Solicitud (SC-) que se arma sola desde una venta, un relevamiento o el catálogo, con la ficha técnica de cada ítem. Se puede pedir Cotización (PC-) a varios proveedores, cargar sus respuestas (neto + IVA + flete) y compararlas por total final; al elegir uno se genera la Orden de compra (OC-) con PDF y envío por WhatsApp o email. También se pueden consolidar ítems de varios clientes en una sola orden. Los pedidos PED- anteriores siguen igual en la pestaña Órdenes.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260922000001_changelog_compras_solicitudes_cotizaciones_y_orden.sql') ON CONFLICT DO NOTHING;
