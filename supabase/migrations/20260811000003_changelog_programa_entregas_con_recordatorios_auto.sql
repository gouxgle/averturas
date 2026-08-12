-- Changelog: Programa entregas con recordatorios automaticos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Programa entregas con recordatorios automaticos', 'Cada remito puede programarse con fecha y horario de entrega. El sistema avisa un dia antes, el mismo dia en el Dashboard y la agenda del CRM, y una hora antes con accesos rapidos para llamar, ver la ubicacion o avisar por WhatsApp.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260811000003_changelog_programa_entregas_con_recordatorios_auto.sql') ON CONFLICT DO NOTHING;
