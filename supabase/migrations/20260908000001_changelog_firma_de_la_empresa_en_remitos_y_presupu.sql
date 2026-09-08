-- Changelog: Firma de la empresa en remitos y presupuestos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Firma de la empresa en remitos y presupuestos', 'Los PDF de remitos y presupuestos ya salen con la firma de la empresa impresa, sin necesidad de firmar a mano.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260908000001_changelog_firma_de_la_empresa_en_remitos_y_presupu.sql') ON CONFLICT DO NOTHING;
