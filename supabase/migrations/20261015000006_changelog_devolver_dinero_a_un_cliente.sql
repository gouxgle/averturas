-- Changelog: Devolver dinero a un cliente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Devolver dinero a un cliente', 'Al registrar una devolución, lo que el cliente ya había pagado se puede dejar a su favor, devolver en dinero (efectivo o transferencia) o repartir. También se puede devolver en dinero un saldo a favor que ya tenía, desde su estado de cuenta. Lo puede hacer un vendedor o un administrador; al administrador le llega un aviso cada vez. Los informes muestran el dinero devuelto y la caja neta, y solo un administrador puede anular un reintegro.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261015000006_changelog_devolver_dinero_a_un_cliente.sql') ON CONFLICT DO NOTHING;
