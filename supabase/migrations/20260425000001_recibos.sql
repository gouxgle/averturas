-- Módulo de recibos: registro de cobros vinculados a operaciones y remitos
CREATE TABLE recibos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  operacion_id    UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  remito_id       UUID REFERENCES remitos(id) ON DELETE SET NULL,
  monto_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pago      TEXT NOT NULL DEFAULT 'efectivo',
  referencia_pago TEXT,
  concepto        TEXT,
  estado          TEXT NOT NULL DEFAULT 'emitido',
  notas           TEXT,
  created_by      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Líneas del recibo: desglose de lo que se está pagando
CREATE TABLE recibo_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recibo_id   UUID NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  producto_id UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  cantidad    INT NOT NULL DEFAULT 1,
  monto       NUMERIC(12,2) NOT NULL,
  orden       INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_recibos_cliente     ON recibos(cliente_id);
CREATE INDEX idx_recibos_operacion   ON recibos(operacion_id);
CREATE INDEX idx_recibos_remito      ON recibos(remito_id);
CREATE INDEX idx_recibos_fecha       ON recibos(fecha DESC);
CREATE INDEX idx_recibos_estado      ON recibos(estado);
CREATE INDEX idx_recibo_items_recibo ON recibo_items(recibo_id);

INSERT INTO schema_migrations (filename)
VALUES ('20260425000001_recibos.sql')
ON CONFLICT DO NOTHING;
