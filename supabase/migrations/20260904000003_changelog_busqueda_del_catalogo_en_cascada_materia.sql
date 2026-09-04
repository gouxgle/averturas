-- Changelog: Búsqueda del catálogo en cascada: Material → Familia → Tipología → Medida
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Búsqueda del catálogo en cascada: Material → Familia → Tipología → Medida', 'Nueva forma de encontrar un producto en Productos y en el modal de catálogo del presupuesto: 4 pasos que se filtran entre sí, sin necesitar completarlos todos, más un buscador libre y filtros de afinado (sistema, diseño, color, vidrio) según la familia elegida.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260904000003_changelog_busqueda_del_catalogo_en_cascada_materia.sql') ON CONFLICT DO NOTHING;
