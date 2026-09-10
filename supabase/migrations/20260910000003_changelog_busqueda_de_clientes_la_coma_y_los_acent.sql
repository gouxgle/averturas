-- Changelog: Búsqueda de clientes: la coma y los acentos ya no la rompen
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Búsqueda de clientes: la coma y los acentos ya no la rompen', 'Buscar "Garcia, Juan Jose" tal como figura en el listado no devolvía nada, porque la coma se pegaba al término. Además ahora ignora acentos: "podologa" encuentra "Podóloga".', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260910000003_changelog_busqueda_de_clientes_la_coma_y_los_acent.sql') ON CONFLICT DO NOTHING;
