-- Changelog: Se pueden cargar clientes Empresa
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Se pueden cargar clientes Empresa', 'Dar de alta o editar un cliente de tipo Empresa daba error al guardar. Ya está corregido.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260930000004_changelog_se_pueden_cargar_clientes_empresa.sql') ON CONFLICT DO NOTHING;
