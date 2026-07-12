-- Comprobante de pago adjunto (captura de transferencia o link de pago MercadoPago)
ALTER TABLE recibos
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

INSERT INTO schema_migrations (filename) VALUES ('20260712000001_recibos_comprobante.sql') ON CONFLICT DO NOTHING;
