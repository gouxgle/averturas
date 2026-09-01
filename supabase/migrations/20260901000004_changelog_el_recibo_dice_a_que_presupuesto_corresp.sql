-- Changelog: El recibo dice a qué presupuesto corresponde y qué incluye
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El recibo dice a qué presupuesto corresponde y qué incluye', 'Al elegir el presupuesto vinculado, el concepto se completa solo como "Pago total/parcial presupuesto N° OP-XXXX" y el recibo queda con el detalle de los ítems del presupuesto, igual que la venta rápida de mostrador. En un pago parcial, el recibo impreso aclara que ese detalle es del presupuesto y no el desglose de lo pagado. El concepto se puede seguir escribiendo a mano.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260901000004_changelog_el_recibo_dice_a_que_presupuesto_corresp.sql') ON CONFLICT DO NOTHING;
