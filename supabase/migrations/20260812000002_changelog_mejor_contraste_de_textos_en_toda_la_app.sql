-- Changelog: Mejor contraste de textos en toda la app
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Mejor contraste de textos en toda la app', 'Los grises tenues que se veian poco en pantallas de baja definicion ahora tienen mas contraste: textos secundarios, bordes de inputs y el menu lateral se leen mejor, sobre todo a 1366x768.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260812000002_changelog_mejor_contraste_de_textos_en_toda_la_app.sql') ON CONFLICT DO NOTHING;
