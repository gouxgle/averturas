-- Changelog: La proforma siempre indica el número de revisión
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'La proforma siempre indica el número de revisión', 'El PDF y el link público del presupuesto ahora muestran siempre la línea de revisión: ''Versión original'' si no hubo cambios, o ''Revisión N° X — N modificaciones a pedido del cliente'' con la fecha de la última, para que el cliente vea que su pedido de cambios quedó reflejado.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260905000007_changelog_la_proforma_siempre_indica_el_numero_de_.sql') ON CONFLICT DO NOTHING;
