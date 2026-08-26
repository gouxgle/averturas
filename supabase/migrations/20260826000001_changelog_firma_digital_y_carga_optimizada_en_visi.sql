-- Changelog: Firma digital y carga optimizada en Visita de Relevamiento de Datos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Firma digital y carga optimizada en Visita de Relevamiento de Datos', 'Se agregó firma digital del cliente (con el dedo sobre la pantalla) al final de la carga del relevamiento, dando conformidad a las medidas tomadas — visible también en el PDF impreso. Se prolijó el botón de sacar fotos y se corrigió el acomodo en celular de los campos Fecha/Técnico y Detalles importantes.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260826000001_changelog_firma_digital_y_carga_optimizada_en_visi.sql') ON CONFLICT DO NOTHING;
