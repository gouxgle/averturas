-- Changelog: Coherencia entre stock y Exhibido en salon
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Coherencia entre stock y Exhibido en salon', 'Si un ajuste manual de stock deja un producto en 0 unidades, se desactiva automaticamente Exhibido en salon y se avisa al guardar.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260813000003_changelog_coherencia_entre_stock_y_exhibido_en_sal.sql') ON CONFLICT DO NOTHING;
