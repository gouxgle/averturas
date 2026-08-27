-- Changelog: Cargar varias aberturas a medida de una vez
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Cargar varias aberturas a medida de una vez', 'Cuando son varias aberturas iguales que solo cambian de medida (ej. 8 ventanas del mismo tipo), ahora se eligen las características una sola vez y después se cargan solo las medidas en una tabla. Incluye un atajo para calcular los precios por m2 y un boton Duplicar item en el carrito.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260827000001_changelog_cargar_varias_aberturas_a_medida_de_una_.sql') ON CONFLICT DO NOTHING;
