-- Adjunto del cálculo del software externo, por abertura a medida
-- (el software calcula burletes/tornillos/vidrio y da precio costo + precio venta)
ALTER TABLE operacion_items
  ADD COLUMN IF NOT EXISTS calculo_url TEXT;

INSERT INTO schema_migrations (filename) VALUES ('20260714000001_operacion_items_calculo.sql') ON CONFLICT DO NOTHING;
