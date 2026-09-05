-- Changelog: El material es ahora el primer dato del producto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El material es ahora el primer dato del producto', 'Al cargar un producto se elige primero el material (Aluminio, PVC o Acero), y ese dato pasa a verse en la tarjeta del catálogo y en la ficha del producto.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260905000001_changelog_el_material_es_ahora_el_primer_dato_del_.sql') ON CONFLICT DO NOTHING;
