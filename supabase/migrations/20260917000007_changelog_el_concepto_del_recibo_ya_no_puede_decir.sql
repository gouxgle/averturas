-- Changelog: El concepto del recibo ya no puede decir 'pago total' en un pago parcial
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El concepto del recibo ya no puede decir ''pago total'' en un pago parcial', 'Al cambiar entre pago total y parcial el concepto vuelve a la sugerencia; si el texto contradice el tipo de recibo se avisa debajo del campo y no deja guardar hasta corregirlo (con un botón para usar el sugerido). El navegador ya no autocompleta el campo con valores viejos.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260917000007_changelog_el_concepto_del_recibo_ya_no_puede_decir.sql') ON CONFLICT DO NOTHING;
