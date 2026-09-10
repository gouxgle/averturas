-- Changelog: Entregas parciales de remitos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Entregas parciales de remitos', 'Ahora se puede entregar una parte de un presupuesto y el resto después. El remito impreso muestra solo lo que se está entregando (antes listaba todo el presupuesto), el sistema no deja entregar dos veces el mismo ítem, y la operación sigue figurando como pendiente de entrega hasta que se entregó todo.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260910000009_changelog_entregas_parciales_de_remitos.sql') ON CONFLICT DO NOTHING;
