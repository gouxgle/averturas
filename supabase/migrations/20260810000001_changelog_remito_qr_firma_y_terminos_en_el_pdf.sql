-- Changelog: Remito: QR, firma y términos en el PDF
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Remito: QR, firma y términos en el PDF', 'El PDF de remito ahora genera el QR de confirmación automáticamente, agrega un apartado de términos y condiciones, amplía el espacio de firma y reemplaza las franjas azules sólidas por contornos (menos tinta al imprimir).', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260810000001_changelog_remito_qr_firma_y_terminos_en_el_pdf.sql') ON CONFLICT DO NOTHING;
