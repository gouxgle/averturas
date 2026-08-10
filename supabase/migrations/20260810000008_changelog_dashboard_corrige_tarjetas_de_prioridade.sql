-- Changelog: Dashboard: corrige tarjetas de Prioridades del día
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Dashboard: corrige tarjetas de Prioridades del día', 'Las tarjetas de PRIORIDADES DE HOY quedaban muy angostas y el texto no entraba bien en pantallas grandes desde que se agregó la 6ta tarjeta de oportunidades. Vuelven a acomodarse en 3 columnas hasta pantallas realmente anchas.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260810000008_changelog_dashboard_corrige_tarjetas_de_prioridade.sql') ON CONFLICT DO NOTHING;
