-- Changelog: Facturas en PDF y envío al cliente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Facturas en PDF y envío al cliente', 'Cada factura y nota se puede ver en PDF (con QR, CAE y los datos que pide ARCA), imprimir con original y duplicado, y enviar al cliente por WhatsApp o mail. También se pueden emitir notas de débito y cada factura muestra sus notas y el saldo.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261001000002_changelog_facturas_en_pdf_y_envio_al_cliente.sql') ON CONFLICT DO NOTHING;
