-- Changelog: Visita tecnica vinculada al presupuesto que la origina
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Visita tecnica vinculada al presupuesto que la origina', 'La visita tecnica generada desde un presupuesto con items a relevar ahora queda vinculada a ese mismo presupuesto - antes se creaba suelta y al cargar el relevado generaba una proforma nueva en vez de completar la original.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260804000001_changelog_visita_tecnica_vinculada_al_presupuesto_.sql') ON CONFLICT DO NOTHING;
