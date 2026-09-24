-- Changelog: Recibos: pago con cheque
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibos: pago con cheque', 'Al cargar un recibo, además de las formas de pago fijas aparecen las que se configuran en Configuración → Formas de pago (cheque a 30 días, 30-60, 30-60-90, etc.), tanto con un solo medio como en el pago combinado. Con cheque se puede anotar el N° de cheque y el banco, y en el tablero de Recibos los cobros con cheque se ven como grupo propio.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260924000004_changelog_recibos_pago_con_cheque.sql') ON CONFLICT DO NOTHING;
