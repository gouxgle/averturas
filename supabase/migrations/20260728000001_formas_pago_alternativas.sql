-- Varias formas de pago alternativas en un presupuesto (ej. "Contado 7% descuento"
-- vs "3 cuotas sin interés"), para que el cliente compare antes de aprobar, y al
-- cobrar el vendedor esté obligado a registrar cuál de esas alternativas se usó.

-- Catálogo configurable (Configuración → Formas de pago), mismo patrón que catalogo_servicios
CREATE TABLE catalogo_formas_pago (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  orden         INT NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT true
);

-- Alternativas efectivamente ofrecidas en UN presupuesto puntual. Snapshot de
-- nombre/descuento_pct: si el vendedor pisa el % o el catálogo cambia después,
-- el presupuesto ya emitido no se altera retroactivamente.
CREATE TABLE operacion_formas_pago (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id   UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  forma_pago_id  UUID REFERENCES catalogo_formas_pago(id) ON DELETE SET NULL,
  nombre         TEXT NOT NULL,
  descuento_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  orden          INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_ofp_operacion ON operacion_formas_pago(operacion_id);

-- Qué alternativa eligió el cliente al momento de cobrar (trazabilidad/reporting futuro)
ALTER TABLE recibos
  ADD COLUMN IF NOT EXISTS forma_pago_alternativa_id UUID
    REFERENCES operacion_formas_pago(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260728000001_formas_pago_alternativas.sql')
  ON CONFLICT DO NOTHING;
