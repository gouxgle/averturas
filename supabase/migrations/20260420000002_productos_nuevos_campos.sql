-- Nuevos campos para catálogo de productos
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS codigo          TEXT,
  ADD COLUMN IF NOT EXISTS color           TEXT,
  ADD COLUMN IF NOT EXISTS stock_inicial   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proveedor_id    UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imagen_url      TEXT,
  ADD COLUMN IF NOT EXISTS desc_corta      TEXT,
  ADD COLUMN IF NOT EXISTS desc_larga      TEXT,
  ADD COLUMN IF NOT EXISTS desc_materiales TEXT,
  ADD COLUMN IF NOT EXISTS desc_instalacion TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_productos_codigo
  ON catalogo_productos(codigo) WHERE codigo IS NOT NULL;
