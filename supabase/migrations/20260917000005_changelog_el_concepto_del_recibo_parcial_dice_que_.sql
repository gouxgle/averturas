-- Changelog: El concepto del recibo parcial dice que es parcial, cuánto queda y el compromiso de pago
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El concepto del recibo parcial dice que es parcial, cuánto queda y el compromiso de pago', 'Al registrar un pago parcial, el concepto sugerido ahora dice ''Pago parcial correspondiente al presupuesto N° PRO-xxxxx — saldo pendiente $X'' y, si se registra compromiso, agrega la fecha y el tipo. Hasta que no se elige total o parcial, no sugiere nada.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260917000005_changelog_el_concepto_del_recibo_parcial_dice_que_.sql') ON CONFLICT DO NOTHING;
