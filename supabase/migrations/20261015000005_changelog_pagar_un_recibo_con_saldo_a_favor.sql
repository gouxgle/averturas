-- Changelog: Pagar un recibo con saldo a favor
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Pagar un recibo con saldo a favor', 'Cuando un cliente devolvió mercadería ya pagada, su saldo a favor se puede usar como forma de pago en un recibo (completo, o combinado con otro medio si no alcanza). Se ve en la ficha del cliente y al crear el recibo. No cuenta como dinero en caja en los informes y, si se anula el recibo, el saldo vuelve al cliente.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261015000005_changelog_pagar_un_recibo_con_saldo_a_favor.sql') ON CONFLICT DO NOTHING;
