-- Changelog: Editar un contacto inactivo lo vuelve a activar
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Editar un contacto inactivo lo vuelve a activar', 'Los contactos importados como leads entran inactivos y no figuran en el listado. Al completarles los datos y guardar, ahora quedan activos y aparecen. Además, cuando el teléfono que estás cargando pertenece a un contacto inactivo, la alerta de duplicado lo aclara en vez de decir solo "ya registrado".', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260910000005_changelog_editar_un_contacto_inactivo_lo_vuelve_a_.sql') ON CONFLICT DO NOTHING;
