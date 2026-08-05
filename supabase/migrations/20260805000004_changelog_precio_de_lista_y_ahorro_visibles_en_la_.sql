-- Changelog: Precio de lista y ahorro visibles en la proforma
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Precio de lista y ahorro visibles en la proforma', 'Cuando un item viene de un producto en promocion, la proforma (PDF y link publico) ahora muestra el precio de lista tachado junto al precio final, el ahorro por item y el ahorro total por promociones en el recuadro de Total Final, para que el cliente vea claramente el beneficio.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260805000004_changelog_precio_de_lista_y_ahorro_visibles_en_la_.sql') ON CONFLICT DO NOTHING;
