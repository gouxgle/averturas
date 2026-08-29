-- Changelog: Orden de los items en el detalle del presupuesto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Orden de los items en el detalle del presupuesto', 'En el modal de detalle de un presupuesto, ahora se muestran primero las caracteristicas de la abertura (tipo, sistema, color, medidas) en negrita, y debajo la descripcion, en vez de al reves.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260828000003_changelog_orden_de_los_items_en_el_detalle_del_pre.sql') ON CONFLICT DO NOTHING;
