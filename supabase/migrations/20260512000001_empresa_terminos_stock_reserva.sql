-- terminos_url en empresa
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS terminos_url text
  DEFAULT 'https://www.cesarbritez.com.ar/condiciones';

-- Agregar tipo 'reserva' a stock_movimientos (CHECK constraint, no enum)
ALTER TABLE stock_movimientos
  DROP CONSTRAINT IF EXISTS stock_movimientos_tipo_check;

ALTER TABLE stock_movimientos
  ADD CONSTRAINT stock_movimientos_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'ingreso', 'egreso_remito', 'egreso_retiro', 'devolucion', 'ajuste', 'reserva'
  ]));

INSERT INTO schema_migrations (filename)
  VALUES ('20260512000001_empresa_terminos_stock_reserva.sql')
  ON CONFLICT DO NOTHING;
