-- Changelog: Fecha inválida en el tooltip de evolución del dólar
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Fecha inválida en el tooltip de evolución del dólar', 'Al pasar el mouse sobre el gráfico de evolución del dólar en el Dashboard, el tooltip mostraba ''Invalid Date'' en vez de la fecha real.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260826000002_changelog_fecha_invalida_en_el_tooltip_de_evolucio.sql') ON CONFLICT DO NOTHING;
