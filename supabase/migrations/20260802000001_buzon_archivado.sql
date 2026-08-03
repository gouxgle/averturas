ALTER TABLE comentarios_buzon ADD COLUMN archivado    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE comentarios_buzon ADD COLUMN archivado_at TIMESTAMPTZ;

CREATE INDEX idx_comentarios_buzon_archivado ON comentarios_buzon(archivado);

INSERT INTO schema_migrations (filename) VALUES ('20260802000001_buzon_archivado.sql')
  ON CONFLICT DO NOTHING;
