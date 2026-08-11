-- Changelog: Recotizar oportunidades futuras
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recotizar oportunidades futuras', 'Desde una oportunidad futura ahora se puede recotizar en un clic: reabre el presupuesto original con los mismos items, o arma uno nuevo si no habia presupuesto previo. Al guardar, la oportunidad queda marcada como concretada automaticamente.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260811000001_changelog_recotizar_oportunidades_futuras.sql') ON CONFLICT DO NOTHING;
