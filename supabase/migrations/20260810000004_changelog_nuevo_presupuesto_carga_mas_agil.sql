-- Changelog: Nuevo presupuesto: carga más ágil
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Nuevo presupuesto: carga más ágil', 'La carga de un presupuesto nuevo ahora empieza eligiendo el cliente en una ventana propia y sigue directo a cargar productos, sin pedir forma de pago ni forma de envío en el medio. La validez queda en 7 días por defecto y se puede ajustar desde el resumen.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260810000004_changelog_nuevo_presupuesto_carga_mas_agil.sql') ON CONFLICT DO NOTHING;
