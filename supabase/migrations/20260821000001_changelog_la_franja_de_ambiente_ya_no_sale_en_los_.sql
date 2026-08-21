-- Changelog: La franja de ambiente ya no sale en los PDF
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'La franja de ambiente ya no sale en los PDF', 'La franja y el badge que indican si estas en test o produccion (arriba de la pantalla) aparecian tambien al imprimir proformas, recibos y remitos. Ahora se excluyen de la impresion.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260821000001_changelog_la_franja_de_ambiente_ya_no_sale_en_los_.sql') ON CONFLICT DO NOTHING;
