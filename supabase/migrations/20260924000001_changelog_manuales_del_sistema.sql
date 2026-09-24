-- Changelog: Manuales del sistema
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Manuales del sistema', 'La sección Manual de Compras pasó a llamarse Manuales del sistema y ahora tiene cuatro: Presupuestos, Visitas de Relevamiento, Venta rápida y Compras. Cada uno se puede leer en pantalla, buscar por palabra e imprimir. El buscador del índice mira adentro de todos los manuales a la vez.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260924000001_changelog_manuales_del_sistema.sql') ON CONFLICT DO NOTHING;
