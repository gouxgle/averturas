-- Changelog: Corregir el cobro de una visita de relevamiento
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corregir el cobro de una visita de relevamiento', 'Una visita marcada sin cargo por error ahora se puede cobrar después, con el importe editable, y acreditarla al presupuesto aunque todavía no esté aprobado.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260903000001_changelog_corregir_el_cobro_de_una_visita_de_relev.sql') ON CONFLICT DO NOTHING;
