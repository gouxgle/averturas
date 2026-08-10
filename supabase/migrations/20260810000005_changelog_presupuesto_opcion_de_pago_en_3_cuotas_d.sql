-- Changelog: Presupuesto: opción de pago en 3 cuotas destacada
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Presupuesto: opción de pago en 3 cuotas destacada', 'El PDF y el link público del presupuesto ahora destacan la opción de pagar en 3 cuotas sin interés con tarjeta de crédito junto al total, para que el cliente vea de entrada cómo puede concretar la compra.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260810000005_changelog_presupuesto_opcion_de_pago_en_3_cuotas_d.sql') ON CONFLICT DO NOTHING;
