-- Changelog: Anular devoluciones, nota de crédito e informes netos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Anular devoluciones, nota de crédito e informes netos', 'Un administrador puede anular una devolución cargada por error: se revierte el stock y el saldo a favor, y si algo ya se usó el sistema dice qué hay que deshacer primero. Si se devolvieron ítems facturados aparece el aviso de nota de crédito con acceso directo a la factura. Reportes muestra ventas netas de devoluciones y las pérdidas por mercadería que no reingresó, el dashboard resta lo devuelto, y al administrador le llega un aviso cuando devuelve un vendedor. Nuevo manual de Devoluciones y cambios.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261015000008_changelog_anular_devoluciones_nota_de_credito_e_in.sql') ON CONFLICT DO NOTHING;
