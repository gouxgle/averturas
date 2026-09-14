-- Changelog: Firma digital más grande en remito y recibo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Firma digital más grande en remito y recibo', 'La firma digital que se muestra en los documentos (remito impreso y recibo, tanto el del modal como el que se envía por WhatsApp) se veía chica en relación al resto del texto. Se agrandó cerca de un 30% para que se lea como una firma real. En el remito se compactó un poco el espaciado del resto de la hoja para que siga entrando en una sola página.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260914000003_changelog_firma_digital_mas_grande_en_remito_y_rec.sql') ON CONFLICT DO NOTHING;
