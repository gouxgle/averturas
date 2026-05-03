-- Margen de ganancia y datos de promoción en catálogo de productos
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS margen_tipo VARCHAR(10)
    CHECK (margen_tipo IN ('bajo','medio','alto')),
  ADD COLUMN IF NOT EXISTS promocion JSONB DEFAULT NULL;

COMMENT ON COLUMN catalogo_productos.margen_tipo IS 'bajo=25%, medio=35%, alto=40% de descuento en promo';
COMMENT ON COLUMN catalogo_productos.promocion IS '{ activo, fecha_inicio, fecha_fin, precio_oferta }';

INSERT INTO schema_migrations (filename) VALUES ('20260503000001_margen_promocion.sql')
  ON CONFLICT DO NOTHING;
