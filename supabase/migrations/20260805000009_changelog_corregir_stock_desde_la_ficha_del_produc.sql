-- Changelog: Corregir stock desde la ficha del producto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corregir stock desde la ficha del producto', 'Al editar un producto ahora se puede corregir el stock (mismo ajuste auditado que en Existencias) sin salir de la ficha. Al marcar Exhibido en salon con stock 0, se sugiere cargar stock (minimo 1) en vez de rechazar el cambio.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260805000009_changelog_corregir_stock_desde_la_ficha_del_produc.sql') ON CONFLICT DO NOTHING;
