-- Changelog: Material por defecto Aluminio al cargar un producto nuevo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Material por defecto Aluminio al cargar un producto nuevo', 'Corrige el dato de fondo (todo el catálogo cargado hasta ahora es de aluminio) y precarga ese valor al crear un producto, para no tener que elegirlo a mano en el caso más común — solo hace falta cambiarlo para PVC, Acero u otro material.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260904000005_changelog_material_por_defecto_aluminio_al_cargar_.sql') ON CONFLICT DO NOTHING;
