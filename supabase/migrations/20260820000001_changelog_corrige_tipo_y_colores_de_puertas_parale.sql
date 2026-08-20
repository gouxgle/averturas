-- Changelog: Corrige tipo y colores de Puertas Paralelas
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corrige tipo y colores de Puertas Paralelas', 'En Nuevo producto, la opcion de tipo de puerta Corrediza oculta ahora se llama Paralela, y se agregaron los colores Roble, Cedro, Wengue y Nogal para ese tipo.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260820000001_changelog_corrige_tipo_y_colores_de_puertas_parale.sql') ON CONFLICT DO NOTHING;
