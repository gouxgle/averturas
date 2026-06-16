CREATE TABLE transportistas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL UNIQUE,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO transportistas (nombre) VALUES
  ('Andreani'), ('OCA'), ('Correo Argentino'), ('transporte propio')
ON CONFLICT DO NOTHING;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS transportista_id UUID REFERENCES transportistas(id);

INSERT INTO schema_migrations (filename) VALUES ('20260615000002_transportistas.sql') ON CONFLICT DO NOTHING;
