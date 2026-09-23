-- Changelog: Compras: facturas, cuenta corriente de proveedores y cierre
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Compras: facturas, cuenta corriente de proveedores y cierre', 'Ahora cada compra lleva su plata y sus papeles. Se carga la factura del proveedor (si no coincide con la orden hay que decir por qué), se registran los pagos —uno puede repartirse entre varias órdenes y lo que sobra queda como saldo a favor— y las notas de crédito o débito. La deuda con cada proveedor ya no se tipea a mano: sale sola de las facturas, pagos y notas cargadas, con estado de cuenta en pantalla, PDF y envío por WhatsApp. Cada orden junta su carpeta de documentos (orden, remito, factura, comprobantes) y se puede cerrar cuando no queda nada pendiente.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260923000001_changelog_compras_facturas_cuenta_corriente_de_pro.sql') ON CONFLICT DO NOTHING;
