-- Changelog: Anular presupuestos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Anular presupuestos', 'Ahora se puede anular un presupuesto cargado por error (cliente equivocado, duplicado, etc.) desde su detalle, con motivo y detalle. Queda guardado como Anulado con quién y cuándo, y si salió de una visita de relevamiento la visita vuelve a quedar libre.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261115000003_changelog_anular_presupuestos.sql') ON CONFLICT DO NOTHING;
