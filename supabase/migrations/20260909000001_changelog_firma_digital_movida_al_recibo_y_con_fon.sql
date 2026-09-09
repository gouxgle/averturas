-- Changelog: Firma digital movida al recibo y con fondo transparente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Firma digital movida al recibo y con fondo transparente', 'La firma solo va en remitos y recibos (se sacó de presupuestos). Se limpió el fondo de la imagen para que se vea como tinta real, no como un recuadro gris.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260909000001_changelog_firma_digital_movida_al_recibo_y_con_fon.sql') ON CONFLICT DO NOTHING;
