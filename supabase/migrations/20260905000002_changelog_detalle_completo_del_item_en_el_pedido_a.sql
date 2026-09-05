-- Changelog: Detalle completo del ítem en el pedido al proveedor
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Detalle completo del ítem en el pedido al proveedor', 'El pedido al proveedor mostraba solo el resumen abreviado del ítem (ej. "[Aluminio · De abrir · Exterior]"), sin tipo, línea, color, medida ni accesorios. Ahora arma la misma descripción completa que ya se ve en el presupuesto — se refleja en la pantalla de Pedidos y en el mensaje de WhatsApp al proveedor.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260905000002_changelog_detalle_completo_del_item_en_el_pedido_a.sql') ON CONFLICT DO NOTHING;
