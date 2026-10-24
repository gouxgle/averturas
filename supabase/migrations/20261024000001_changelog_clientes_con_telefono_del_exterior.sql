-- Changelog: Clientes con teléfono del exterior
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Clientes con teléfono del exterior', 'En el formulario de cliente hay un tilde Número del exterior para cargar teléfonos de otros países (por ejemplo Paraguay +595) con su código de país. Los mensajes de WhatsApp a esos números ya no les agregan el 549 de Argentina.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261024000001_changelog_clientes_con_telefono_del_exterior.sql') ON CONFLICT DO NOTHING;
