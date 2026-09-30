-- Changelog: Facturación: nueva sección
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Facturación: nueva sección', 'Nueva sección Facturación en el menú: lista de facturas y notas de crédito, pestaña "Por facturar" con los cobros y presupuestos pendientes, asistente para emitir (cliente, ítems y revisión) y botón "Facturar" en recibos y presupuestos. El sistema no deja facturar dos veces lo mismo sin confirmarlo. Queda lista para usar cuando se complete la puesta en marcha con ARCA.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260930000005_changelog_facturacion_nueva_seccion.sql') ON CONFLICT DO NOTHING;
