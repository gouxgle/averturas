-- Changelog: Presupuestos aprobados que no aparecían y búsqueda de clientes
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Presupuestos aprobados que no aparecían y búsqueda de clientes', 'Corregido: la lista de Presupuestos mostraba como máximo 200 y dejaba afuera los aprobados más recientes (no aparecían ni buscándolos), y la búsqueda en Clientes daba error. Ahora se ven todos.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261105000001_changelog_presupuestos_aprobados_que_no_aparecian_.sql') ON CONFLICT DO NOTHING;
