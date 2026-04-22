-- Nuevo estado 'consulta' (antes de presupuesto)
ALTER TYPE estado_operacion ADD VALUE IF NOT EXISTS 'consulta' BEFORE 'presupuesto';

-- Campos de operacion (cabecera del presupuesto)
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS tipo_proyecto  TEXT,
  ADD COLUMN IF NOT EXISTS forma_pago     TEXT,
  ADD COLUMN IF NOT EXISTS tiempo_entrega INTEGER;

-- Campos por ítem
ALTER TABLE operacion_items
  ADD COLUMN IF NOT EXISTS vidrio     TEXT,
  ADD COLUMN IF NOT EXISTS premarco   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS origen     TEXT,
  ADD COLUMN IF NOT EXISTS color      TEXT,
  ADD COLUMN IF NOT EXISTS accesorios TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO schema_migrations (filename) VALUES ('20260421000002_presupuesto_campos.sql')
  ON CONFLICT DO NOTHING;
