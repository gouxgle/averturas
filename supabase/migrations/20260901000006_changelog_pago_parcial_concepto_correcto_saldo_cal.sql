-- Changelog: Pago parcial: concepto correcto, saldo calculado y fecha de compromiso destacada
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Pago parcial: concepto correcto, saldo calculado y fecha de compromiso destacada', 'Con ''Pago parcial'' elegido el concepto ya nunca dice ''Pago total'', aunque el monto tipeado alcance a cubrir el saldo. Debajo del monto aparece la cuenta completa del saldo (total del presupuesto, lo ya cobrado, las bonificaciones, este pago y el saldo que queda). La fecha de compromiso de cancelación pasa a estar destacada, con atajos de 7/15/30/60 días y la confirmación en texto claro. Si el pago cancela todo el saldo, ya no se pide compromiso.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260901000006_changelog_pago_parcial_concepto_correcto_saldo_cal.sql') ON CONFLICT DO NOTHING;
