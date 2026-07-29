-- Changelog: Validación de disponibilidad antes de comprometer fecha de entrega
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Validación de disponibilidad antes de comprometer fecha de entrega', 'Confirmación manual con el proveedor (por WhatsApp), vence a los 10 días. Badge en galería, card en Nuevo Producto, aviso en Nuevo Presupuesto.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260729000002_changelog_validacion_de_disponibilidad_antes_de_co.sql') ON CONFLICT DO NOTHING;
