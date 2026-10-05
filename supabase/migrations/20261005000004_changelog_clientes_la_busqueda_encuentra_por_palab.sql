-- Changelog: Clientes: la búsqueda encuentra por palabras sueltas
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Clientes: la búsqueda encuentra por palabras sueltas', 'Buscar «Lescano, Hugo» o «lescano hugo» ahora encuentra al cliente: las palabras pueden ir en cualquier orden, con o sin coma ni tildes, y los teléfonos se encuentran en cualquier formato.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261005000004_changelog_clientes_la_busqueda_encuentra_por_palab.sql') ON CONFLICT DO NOTHING;
