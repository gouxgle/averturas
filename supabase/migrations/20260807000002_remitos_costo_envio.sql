-- Costo de envío del remito — cuando se envía a domicilio (venta rápida y, a
-- futuro, venta tradicional), se registra el costo pactado con el transporte
-- para imprimirlo como leyenda en el remito y generar un recibo aparte.
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(12,2) NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (filename) VALUES ('20260807000002_remitos_costo_envio.sql')
  ON CONFLICT DO NOTHING;
