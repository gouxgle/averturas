-- Devoluciones etapa 3: reintegros de dinero al cliente (sale plata de caja).
-- Dos orígenes: una devolución que elige devolver el excedente en dinero (devolucion_id), o
-- el saldo a favor que el cliente ya tenía y quiere retirar (sin devolución). Un reintegro
-- anulado vuelve a quedar como saldo a favor. Cada reintegro avisa a los administradores
-- (notif_leida, mismo patrón que remitos/operaciones) sin importar quién lo haga.
CREATE TABLE reintegros (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,                      -- REI-YYYYMM-NNNN
  cliente_id      UUID NOT NULL REFERENCES clientes(id),
  devolucion_id   UUID REFERENCES devoluciones(id) ON DELETE SET NULL,
  operacion_id    UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  forma_pago      TEXT NOT NULL CHECK (forma_pago IN ('Efectivo', 'Transferencia', 'Otro')),
  referencia      TEXT,
  motivo          TEXT,
  estado          TEXT NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'anulado')),
  motivo_anulacion TEXT,
  anulado_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  anulado_at      TIMESTAMPTZ,
  notif_leida     BOOLEAN NOT NULL DEFAULT false,            -- aviso al admin (campanita / emergente)
  created_by      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reintegros_cliente ON reintegros(cliente_id);
CREATE INDEX idx_reintegros_fecha   ON reintegros(fecha DESC);
CREATE INDEX idx_reintegros_devol   ON reintegros(devolucion_id);

-- La columna ya existía en el libro (etapa 1) sin FK porque la tabla no estaba.
ALTER TABLE cliente_saldo_favor_movimientos
  ADD CONSTRAINT cliente_saldo_favor_reintegro_fk FOREIGN KEY (reintegro_id) REFERENCES reintegros(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (filename) VALUES ('20261015000005_reintegros.sql') ON CONFLICT DO NOTHING;
