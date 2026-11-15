-- Changelog: El stock se reserva con el primer pago
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El stock se reserva con el primer pago', 'Un presupuesto enviado o aprobado sin pago ya no reserva stock. La reserva nace con el primer recibo, se ve como señado en Existencias y en el detalle del presupuesto, no baja el stock físico y se libera sola al anular. Venta rápida y presupuestos usan el stock disponible.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261115000005_changelog_el_stock_se_reserva_con_el_primer_pago.sql') ON CONFLICT DO NOTHING;
