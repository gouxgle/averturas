-- Changelog: Visitas técnicas con costo y bonificación
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Visitas técnicas con costo y bonificación', 'La visita técnica ahora tiene un costo configurable que se puede cobrar por adelantado con recibo, y después acreditar al presupuesto final como pago a cuenta. Nuevo reporte con costo externo y margen del servicio.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260803000002_changelog_visitas_tecnicas_con_costo_y_bonificacio.sql') ON CONFLICT DO NOTHING;
