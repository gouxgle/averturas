-- Fórmulas de precio para productos estándar (Revisión integral de precios, pestaña "Por fórmula").
-- precio = (costo ÷ divisor × (1 + recargo)) + costo × adicional, redondeado hacia arriba a un
-- número que termina en `redondeo_terminacion` (ej. 203.666,67 → 203.900).
-- La general tiene familia y proveedor en NULL; las excepciones fijan uno o los dos.
CREATE TABLE IF NOT EXISTS formulas_precio (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                TEXT NOT NULL,
  divisor               NUMERIC(6,4) NOT NULL DEFAULT 0.60 CHECK (divisor > 0 AND divisor <= 1),
  recargo_pct           NUMERIC(6,2) NOT NULL DEFAULT 15 CHECK (recargo_pct >= 0 AND recargo_pct <= 500),
  adicional_costo_pct   NUMERIC(6,2) NOT NULL DEFAULT 12 CHECK (adicional_costo_pct >= 0 AND adicional_costo_pct <= 500),
  redondeo_paso         INT NOT NULL DEFAULT 1000 CHECK (redondeo_paso >= 0),
  redondeo_terminacion  INT NOT NULL DEFAULT 900 CHECK (redondeo_terminacion >= 0),
  tipo_abertura_id      UUID REFERENCES tipos_abertura(id) ON DELETE CASCADE,
  proveedor_id          UUID REFERENCES proveedores(id) ON DELETE CASCADE,
  activa                BOOLEAN NOT NULL DEFAULT true,
  updated_by            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (redondeo_paso = 0 OR redondeo_terminacion < redondeo_paso)
);
-- Una sola fórmula por alcance (general, familia, proveedor o familia + proveedor).
CREATE UNIQUE INDEX IF NOT EXISTS ux_formulas_precio_alcance
  ON formulas_precio (COALESCE(tipo_abertura_id, '00000000-0000-0000-0000-000000000000'), COALESCE(proveedor_id, '00000000-0000-0000-0000-000000000000'));

INSERT INTO formulas_precio (nombre)
  SELECT 'Estándar' WHERE NOT EXISTS (SELECT 1 FROM formulas_precio WHERE tipo_abertura_id IS NULL AND proveedor_id IS NULL);

INSERT INTO schema_migrations (filename) VALUES ('20261006000001_formulas_precio.sql') ON CONFLICT DO NOTHING;
