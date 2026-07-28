-- Buzón de comentarios flotante, compartido por todo el equipo, disponible en
-- cualquier sección de la app — anotador rápido para dejar comentarios/pendientes
-- que después se marcan como resueltos.
CREATE TABLE comentarios_buzon (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto       TEXT NOT NULL,
  resuelto    BOOLEAN NOT NULL DEFAULT false,
  resuelto_at TIMESTAMPTZ,
  resuelto_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comentarios_buzon_resuelto ON comentarios_buzon(resuelto);
CREATE INDEX idx_comentarios_buzon_created  ON comentarios_buzon(created_at DESC);

INSERT INTO schema_migrations (filename) VALUES ('20260728000003_buzon_comentarios.sql')
  ON CONFLICT DO NOTHING;
