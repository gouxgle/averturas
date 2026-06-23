CREATE TABLE localidades (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  TEXT NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_localidades_nombre ON localidades(nombre);

-- Seeds iniciales
INSERT INTO localidades (nombre, orden) VALUES
  ('General Roca',       1),
  ('Cipolletti',         2),
  ('Neuquén',            3),
  ('Allen',              4),
  ('Cinco Saltos',       5),
  ('Villa Regina',       6),
  ('Catriel',            7),
  ('Lamarque',           8),
  ('Río Colorado',       9),
  ('Fernández Oro',     10)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('20260623000002_localidades.sql')
ON CONFLICT DO NOTHING;
