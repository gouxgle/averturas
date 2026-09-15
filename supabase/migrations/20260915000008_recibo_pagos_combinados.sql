-- Medios de pago combinados en un recibo (ej: parte por transferencia y parte con
-- tarjeta), guardando el monto de cada uno.
--
-- Decisión central: estas filas existen SOLO cuando el pago es combinado (2 o más
-- medios). Un recibo con un solo medio no guarda nada acá y sigue funcionando
-- exactamente como hasta hoy, con recibos.forma_pago / referencia_pago. Eso deja el
-- camino por defecto intacto y evita backfillear los recibos existentes.
CREATE TABLE IF NOT EXISTS recibo_pagos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recibo_id  UUID NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
  forma_pago TEXT NOT NULL,
  monto      NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  referencia TEXT,
  orden      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recibo_pagos_recibo ON recibo_pagos (recibo_id);

COMMENT ON TABLE recibo_pagos IS
  'Desglose de medios de pago cuando un recibo se cobra con 2 o más. Vacío para recibos de un solo medio: ese caso vive en recibos.forma_pago.';

-- Los informes de caja agrupan por forma de pago. Si miraran recibos.forma_pago, un
-- recibo combinado imputaría el total a un solo medio (o a "Pago combinado", que no
-- es un medio real). Esta vista da SIEMPRE el desglose correcto: las filas del
-- desglose si las hay, y si no el medio único del recibo. Los reportes consultan
-- esto, nunca recibos.forma_pago.
CREATE OR REPLACE VIEW recibo_pagos_efectivos AS
SELECT rp.recibo_id, rp.forma_pago, rp.monto, rp.referencia, rp.orden
  FROM recibo_pagos rp
UNION ALL
SELECT r.id, r.forma_pago, r.monto_total, r.referencia_pago, 0
  FROM recibos r
 WHERE NOT EXISTS (SELECT 1 FROM recibo_pagos p WHERE p.recibo_id = r.id);

COMMENT ON VIEW recibo_pagos_efectivos IS
  'Un renglón por medio de pago real de cada recibo. Usar esto para agrupar caja por forma de pago, no recibos.forma_pago.';

INSERT INTO schema_migrations (filename)
VALUES ('20260915000008_recibo_pagos_combinados.sql') ON CONFLICT DO NOTHING;
