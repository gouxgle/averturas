-- Changelog: Saldos correctos en Recibos y listas completas
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Saldos correctos en Recibos y listas completas', 'Recibos ya no muestra saldo ni ofrece Cobrar saldo en ventas saldadas con bonificacion. El Tablero de Operaciones muestra todas las operaciones y Clientes todo el padron, con filtros completos. Una venta se marca entregada registrando la entrega en su remito.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261106000001_changelog_saldos_correctos_en_recibos_y_listas_com.sql') ON CONFLICT DO NOTHING;
