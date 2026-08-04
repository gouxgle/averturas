-- Visitas técnicas: costo tabulado, cobro anticipado y bonificación al presupuesto.
-- La bonificación es "pago a cuenta": el recibo de la visita se acredita a la operación
-- (se le setea operacion_id) y pasa a contar como monto cobrado. NO usa monto_descuento.

-- Costo tabulado de la visita (valor único del negocio, editable en Configuración)
ALTER TABLE empresa
  ADD COLUMN IF NOT EXISTS costo_visita_tecnica numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE visitas_tecnicas
  ADD COLUMN IF NOT EXISTS cobro_estado   text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS costo_cobrado  numeric(12,2),
  ADD COLUMN IF NOT EXISTS costo_externo  numeric(12,2),
  ADD COLUMN IF NOT EXISTS recibo_id      uuid REFERENCES recibos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bonificada_at  timestamptz,
  ADD COLUMN IF NOT EXISTS bonificada_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;

-- cobro_estado:
--   pendiente  = todavía no se decidió si se cobra
--   cobrada    = se emitió recibo (recibo_id), plata en caja
--   sin_cargo  = se decidió NO cobrar (cliente de confianza) — no derivable de la ausencia de recibo
--   bonificada = el recibo se acreditó a un presupuesto
ALTER TABLE visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_cobro_estado_check;
ALTER TABLE visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_cobro_estado_check
  CHECK (cobro_estado IN ('pendiente','cobrada','sin_cargo','bonificada'));

-- Un recibo pertenece a lo sumo a una visita
CREATE UNIQUE INDEX IF NOT EXISTS uq_visitas_tecnicas_recibo
  ON visitas_tecnicas(recibo_id) WHERE recibo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_cobro_estado ON visitas_tecnicas(cobro_estado);
CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_bonificada_at ON visitas_tecnicas(bonificada_at)
  WHERE bonificada_at IS NOT NULL;

-- Las visitas previas a esta feature nunca se cobraron: marcarlas sin_cargo
-- para no mostrar deuda fantasma sobre todo el histórico.
UPDATE visitas_tecnicas SET cobro_estado = 'sin_cargo' WHERE cobro_estado = 'pendiente';

INSERT INTO schema_migrations (filename)
VALUES ('20260803000001_visitas_tecnicas_cobro.sql') ON CONFLICT DO NOTHING;
