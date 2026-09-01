-- Changelog: Recibos: concepto según el pago real y saldo pendiente más claro
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibos: concepto según el pago real y saldo pendiente más claro', 'El concepto ya no dice ''Pago total'' cuando en realidad se está cancelando un saldo: si hubo cobros previos y este pago cierra el presupuesto, dice ''Pago parcial — cancelación total de saldo presupuesto N° X''. En un parcial que deja saldo, el recibo muestra el saldo pendiente (total del presupuesto menos todo lo cobrado). Además el importe cobrado en el recibo se distingue tipográficamente del total del presupuesto, que ahora se rotula ''Total del presupuesto (referencia)'', y la referencia al remito deja de aparecer vacía cuando el recibo no tiene remito.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260901000005_changelog_recibos_concepto_segun_el_pago_real_y_sa.sql') ON CONFLICT DO NOTHING;
