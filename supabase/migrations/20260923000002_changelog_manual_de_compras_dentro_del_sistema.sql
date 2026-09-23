-- Changelog: Manual de Compras dentro del sistema
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Manual de Compras dentro del sistema', 'Se agregó el manual completo del módulo Compras, con índice, buscador y versión para imprimir. Se entra desde el menú (Sistema → Manual de Compras) o desde el botón Ayuda de la pantalla de Compras. Explica paso a paso todo el circuito: solicitud, cotización, orden, seguimiento, recepción por ítem, reclamos, factura, pagos y cierre, con una tabla de recetas rápidas y el significado de cada aviso del sistema.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260923000002_changelog_manual_de_compras_dentro_del_sistema.sql') ON CONFLICT DO NOTHING;
