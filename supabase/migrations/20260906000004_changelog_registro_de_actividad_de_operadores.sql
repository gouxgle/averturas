-- Changelog: Registro de actividad de operadores
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Registro de actividad de operadores', 'Nueva sección Sistema → Actividad: muestra qué operador creó, editó, cambió de estado, emitió o anuló cada presupuesto, recibo y remito, y cada modificación de presupuesto (versión). Con filtros por operador, tipo y fecha.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260906000004_changelog_registro_de_actividad_de_operadores.sql') ON CONFLICT DO NOTHING;
