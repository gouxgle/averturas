-- Visitas técnicas: relevamiento in situ que puede derivar en un presupuesto "a medida".
CREATE TABLE visitas_tecnicas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero             TEXT UNIQUE NOT NULL,
  cliente_id         UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  fecha_visita       DATE,
  tecnico            TEXT,
  estado             TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente','relevada','convertida','cancelada')),
  color              TEXT[] NOT NULL DEFAULT '{}',
  vidrio             TEXT[] NOT NULL DEFAULT '{}',
  instalacion        TEXT[] NOT NULL DEFAULT '{}',
  abertura_especial  TEXT[] NOT NULL DEFAULT '{}',
  observaciones      TEXT,
  operacion_id       UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE visita_tecnica_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_tecnica_id  UUID NOT NULL REFERENCES visitas_tecnicas(id) ON DELETE CASCADE,
  orden              INT NOT NULL DEFAULT 0,
  ambiente           TEXT,
  descripcion        TEXT,
  ancho_mm           NUMERIC(8,2),
  alto_mm            NUMERIC(8,2)
);

CREATE INDEX idx_visitas_tecnicas_cliente ON visitas_tecnicas(cliente_id);
CREATE INDEX idx_visitas_tecnicas_estado  ON visitas_tecnicas(estado);
CREATE INDEX idx_vt_items_visita          ON visita_tecnica_items(visita_tecnica_id);

INSERT INTO schema_migrations (filename) VALUES ('20260722000002_visitas_tecnicas.sql') ON CONFLICT DO NOTHING;
