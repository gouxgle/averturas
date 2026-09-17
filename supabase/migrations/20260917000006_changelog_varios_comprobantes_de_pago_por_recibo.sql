-- Changelog: Varios comprobantes de pago por recibo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Varios comprobantes de pago por recibo', 'Ahora se pueden adjuntar varios comprobantes a un mismo recibo (uno por cada medio de pago), pegando, arrastrando o seleccionando varias imágenes a la vez. El detalle del recibo los muestra todos numerados.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260917000006_changelog_varios_comprobantes_de_pago_por_recibo.sql') ON CONFLICT DO NOTHING;
