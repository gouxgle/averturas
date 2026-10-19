-- Changelog: Bonificación en el presupuesto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Bonificación desde el presupuesto', 'Ahora se puede bonificar un presupuesto (porcentaje o monto fijo, con motivo) y la proforma lo muestra destacado: precio de lista, bonificación y total final, tanto impresa como en el link del cliente. Al hacer el recibo la bonificación llega precargada y queda impresa también ahí; se puede cambiar al cobrar. Además, un segundo recibo ya no vuelve a descontar la bonificación.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261016000003_changelog_bonificacion_en_el_presupuesto.sql') ON CONFLICT DO NOTHING;
