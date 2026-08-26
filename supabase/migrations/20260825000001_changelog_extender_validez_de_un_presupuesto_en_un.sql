-- Changelog: Extender validez de un presupuesto en un clic
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Extender validez de un presupuesto en un clic', 'Desde la lista de Presupuestos (o el detalle) ahora se puede sumar +7 o +15 días a la fecha de validez con un solo click, sin reabrir el formulario de edición. Si ya estaba vencido, extiende desde hoy; si todavía está vigente, suma sobre la fecha actual.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260825000001_changelog_extender_validez_de_un_presupuesto_en_un.sql') ON CONFLICT DO NOTHING;
