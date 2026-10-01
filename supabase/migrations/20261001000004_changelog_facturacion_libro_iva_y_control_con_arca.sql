-- Changelog: Facturación: Libro IVA y control con ARCA
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Facturación: Libro IVA y control con ARCA', 'Nueva pestaña Libro IVA en Facturación: resumen del mes por alícuota, descarga en CSV para el contador y control que verifica que cada factura esté registrada en ARCA con los mismos datos.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261001000004_changelog_facturacion_libro_iva_y_control_con_arca.sql') ON CONFLICT DO NOTHING;
