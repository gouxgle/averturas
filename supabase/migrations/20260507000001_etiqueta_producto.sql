ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS etiqueta VARCHAR(30) NULL
  CHECK (etiqueta IN ('mas_vendido', 'recomendado', 'nuevo'));

INSERT INTO schema_migrations (filename)
VALUES ('20260507000001_etiqueta_producto.sql')
ON CONFLICT DO NOTHING;
