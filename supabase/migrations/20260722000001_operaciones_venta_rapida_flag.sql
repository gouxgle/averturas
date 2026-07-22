ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS es_venta_rapida BOOLEAN NOT NULL DEFAULT false;

-- Marca retroactivamente las que ya se cargaron antes de existir esta columna
UPDATE operaciones SET es_venta_rapida = true WHERE notas = 'Venta rápida de mostrador' AND es_venta_rapida = false;

INSERT INTO schema_migrations (filename) VALUES ('20260722000001_operaciones_venta_rapida_flag.sql') ON CONFLICT DO NOTHING;
