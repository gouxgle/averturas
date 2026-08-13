-- Changelog: Se puede salir del modal de elegir cliente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Se puede salir del modal de elegir cliente', 'En Nuevo presupuesto, el modal para elegir cliente quedaba sin salida. Ahora se puede cancelar con Escape, clickeando afuera, o con el boton X.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260813000001_changelog_se_puede_salir_del_modal_de_elegir_clien.sql') ON CONFLICT DO NOTHING;
