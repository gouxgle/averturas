-- Changelog: Corregido el modal de detalle en Estado de Cuenta
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corregido el modal de detalle en Estado de Cuenta', 'El modal aparecía corrido hacia abajo en vez de centrado en pantalla.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260907000003_changelog_corregido_el_modal_de_detalle_en_estado_.sql') ON CONFLICT DO NOTHING;
