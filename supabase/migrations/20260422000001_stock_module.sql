-- Módulo de stock: lotes y movimientos

CREATE TABLE IF NOT EXISTS stock_lotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT UNIQUE NOT NULL,
  proveedor_id   UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha_ingreso  DATE NOT NULL DEFAULT CURRENT_DATE,
  remito_nro     TEXT,
  factura_nro    TEXT,
  notas          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_movimientos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id    UUID NOT NULL REFERENCES catalogo_productos(id) ON DELETE RESTRICT,
  lote_id        UUID REFERENCES stock_lotes(id) ON DELETE SET NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso_remito','egreso_retiro','devolucion','ajuste')),
  cantidad       INTEGER NOT NULL,        -- positivo = entrada, negativo = salida
  costo_unitario NUMERIC(12,2),
  motivo         TEXT,
  operacion_id   UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  referencia_nro TEXT,
  notas          TEXT,
  created_by     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smov_producto  ON stock_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_smov_lote      ON stock_movimientos(lote_id);
CREATE INDEX IF NOT EXISTS idx_smov_created   ON stock_movimientos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slotes_created ON stock_lotes(created_at DESC);

INSERT INTO schema_migrations (filename) VALUES ('20260422000001_stock_module.sql')
  ON CONFLICT DO NOTHING;
