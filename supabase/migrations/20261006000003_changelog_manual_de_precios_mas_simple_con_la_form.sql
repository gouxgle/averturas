-- Changelog: Manual de precios más simple, con la fórmula
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Manual de precios más simple, con la fórmula', 'El manual de la Revisión integral de precios se reescribió para que sea más fácil: empieza por «¿qué pestaña uso?» según lo que te pasa, tiene una rutina semanal de 10 minutos, guías paso a paso con ejemplos y una sección nueva sobre la pestaña «Por fórmula» (la fórmula de los productos estándar).', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261006000003_changelog_manual_de_precios_mas_simple_con_la_form.sql') ON CONFLICT DO NOTHING;
