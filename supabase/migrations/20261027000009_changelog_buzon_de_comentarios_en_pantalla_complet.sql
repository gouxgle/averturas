-- Changelog: Buzón de comentarios en pantalla completa
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Buzón de comentarios en pantalla completa', 'Nueva sección Buzón de comentarios (menú Sistema, o «Abrir completo» desde el globito): se lee todo el texto con letra grande, con pestañas Pendientes / Resueltos / Archivados, buscador por texto o autor y orden por fecha. El globito de abajo a la izquierda queda como aviso y anotador rápido.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261027000009_changelog_buzon_de_comentarios_en_pantalla_complet.sql') ON CONFLICT DO NOTHING;
