-- Changelog: Tipos de material configurables
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Tipos de material configurables', 'El campo Material de los productos (Aluminio, Acero, PVC...) ahora se administra desde Configuración → Materiales: se pueden agregar, editar, desactivar o borrar tipos.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260905000006_changelog_tipos_de_material_configurables.sql') ON CONFLICT DO NOTHING;
