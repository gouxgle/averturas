-- Changelog: Tareas automáticas protegidas en la ficha del cliente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Tareas automáticas protegidas en la ficha del cliente', 'Desde la ficha del cliente ya no se pueden borrar las tareas que genera el sistema (entregas, visitas, post venta, recotizaciones); se resuelven desde su origen o marcándolas hechas. Los usuarios de solo consulta no borran tareas.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261027000002_changelog_tareas_automaticas_protegidas_en_la_fich.sql') ON CONFLICT DO NOTHING;
