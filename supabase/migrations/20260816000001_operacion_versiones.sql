-- Historial de versiones de un presupuesto: cada vez que se edita (PUT /operaciones/:id),
-- se guarda un snapshot completo del estado ANTERIOR (header + items + formas de pago
-- alternativas) antes de sobreescribirlo. v1 = primer estado antes de la primera edición.

CREATE TABLE IF NOT EXISTS operacion_versiones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  version      INT NOT NULL,
  snapshot     JSONB NOT NULL,
  created_by   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operacion_id, version)
);

CREATE INDEX IF NOT EXISTS idx_operacion_versiones_op ON operacion_versiones (operacion_id, version DESC);

INSERT INTO schema_migrations (filename)
VALUES ('20260816000001_operacion_versiones.sql') ON CONFLICT DO NOTHING;
