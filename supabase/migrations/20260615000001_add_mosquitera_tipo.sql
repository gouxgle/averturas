INSERT INTO tipos_abertura (nombre, orden)
VALUES ('Mosquera', 4)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('20260615000001_add_mosquitera_tipo.sql') ON CONFLICT DO NOTHING;
