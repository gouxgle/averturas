-- Changelog: Historial de versiones al editar un presupuesto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Historial de versiones al editar un presupuesto', 'Cada vez que se edita un presupuesto queda guardada la version anterior (v1, v2, v3...). Se puede consultar desde el detalle del presupuesto, debajo de los items.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260816000002_changelog_historial_de_versiones_al_editar_un_pres.sql') ON CONFLICT DO NOTHING;
