-- Compromisos de pago futuros: cuotas, cheques diferidos, transferencias programadas
CREATE TABLE compromisos_pago (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID    NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  operacion_id      UUID    REFERENCES operaciones(id) ON DELETE SET NULL,
  tipo              TEXT    NOT NULL DEFAULT 'cuota'
                            CHECK (tipo IN ('cuota','cheque','efectivo_futuro','transferencia')),
  monto             NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_vencimiento DATE    NOT NULL,
  descripcion       TEXT,
  numero_cheque     TEXT,
  banco             TEXT,
  estado            TEXT    NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','cobrado','rechazado','vencido')),
  notas             TEXT,
  created_by        UUID    REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compromisos_cliente    ON compromisos_pago(cliente_id);
CREATE INDEX idx_compromisos_vencimiento ON compromisos_pago(fecha_vencimiento)
  WHERE estado = 'pendiente';

INSERT INTO schema_migrations (filename) VALUES ('20260428000002_compromisos_pago.sql')
  ON CONFLICT DO NOTHING;
