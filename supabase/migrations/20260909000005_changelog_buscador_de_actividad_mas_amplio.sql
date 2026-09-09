-- Changelog: Buscador de Actividad más amplio
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Buscador de Actividad más amplio', 'La búsqueda en Actividad de operadores ahora también encuentra por tipo de documento (remito, recibo, presupuesto), por acción (anular, entregar, cambio de estado) y por nombre del operador, además del número y el detalle.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260909000005_changelog_buscador_de_actividad_mas_amplio.sql') ON CONFLICT DO NOTHING;
