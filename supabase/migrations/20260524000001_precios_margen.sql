-- Márgenes de venta por jerarquía: tipo_abertura > proveedor > 0
-- y vínculo proveedor_precios → catalogo_productos + flag precio_manual

ALTER TABLE tipos_abertura
  ADD COLUMN IF NOT EXISTS margen_venta NUMERIC(5,2);

ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS margen_venta   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS precio_manual  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS margen_venta NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE proveedor_precios
  ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS proveedor_precios_producto_id_idx
  ON proveedor_precios(producto_id) WHERE producto_id IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260524000001_precios_margen.sql')
ON CONFLICT DO NOTHING;
