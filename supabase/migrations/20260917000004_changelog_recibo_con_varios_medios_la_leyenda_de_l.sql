-- Changelog: Recibo con varios medios: la leyenda de la suma ya no es circular en pago parcial
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibo con varios medios: la leyenda de la suma ya no es circular en pago parcial', 'En pago parcial el total del recibo es la suma de los medios, así que comparar la suma contra el total no decía nada. Ahora en parcial se muestra el monto y el saldo que queda; en pago total se sigue comparando contra el saldo a cancelar.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260917000004_changelog_recibo_con_varios_medios_la_leyenda_de_l.sql') ON CONFLICT DO NOTHING;
