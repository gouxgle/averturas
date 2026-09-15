-- Changelog: Medios de pago combinados en recibos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Medios de pago combinados en recibos', 'Un recibo puede cobrarse con varios medios a la vez (por ejemplo parte por transferencia y parte con tarjeta), indicando el monto de cada uno. El formulario muestra la suma contra el total y avisa si no cierran. Los recibos de un solo medio no cambian en nada.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260915000009_changelog_medios_de_pago_combinados_en_recibos.sql') ON CONFLICT DO NOTHING;
