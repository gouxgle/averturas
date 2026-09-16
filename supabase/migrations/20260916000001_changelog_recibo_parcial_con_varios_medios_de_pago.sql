-- Changelog: Recibo parcial con varios medios de pago: el total mostraba $0
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibo parcial con varios medios de pago: el total mostraba $0', 'Al cobrar un pago parcial dividido en varios medios, el total del recibo salía de un campo aparte que podía quedar vacío, y mostraba $0 aunque los medios tuvieran monto cargado. Ahora el total es directamente la suma de los medios.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260916000001_changelog_recibo_parcial_con_varios_medios_de_pago.sql') ON CONFLICT DO NOTHING;
