-- Changelog: Facturación electrónica: configuración con ARCA
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Facturación electrónica: configuración con ARCA', 'Nueva sección en Configuración (solo administradores) para preparar la facturación electrónica: datos fiscales, puntos de venta, certificado digital y un semáforo que prueba la conexión con ARCA. La facturación queda apagada hasta completar la puesta en marcha.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260930000002_changelog_facturacion_electronica_configuracion_co.sql') ON CONFLICT DO NOTHING;
