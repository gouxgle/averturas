-- Changelog: Buzon de comentarios mas legible
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Buzon de comentarios mas legible', 'El panel del buzon se ve mas grande al abrirlo y cada mensaje queda claramente separado del anterior.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260811000002_changelog_buzon_de_comentarios_mas_legible.sql') ON CONFLICT DO NOTHING;
