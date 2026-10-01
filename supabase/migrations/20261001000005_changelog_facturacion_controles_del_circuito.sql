-- Changelog: Facturación: controles del circuito
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Facturación: controles del circuito', 'No se puede anular un recibo ni cancelar un presupuesto que ya tienen factura sin antes hacer la nota de crédito. Las notas de crédito y débito se controlan: mismo cliente que la factura, fecha posterior y sin asociar una nota a otra del mismo tipo. Una nota de débito se puede anular con nota de crédito.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261001000005_changelog_facturacion_controles_del_circuito.sql') ON CONFLICT DO NOTHING;
