-- Ficha de "modelo" (diseño) como padre de variantes — catalogo_productos sigue siendo
-- la unidad vendible/con stock/precio propio (variante); modelo_id es un agrupador
-- opcional. No se migran datos existentes automáticamente: cada catalogo_productos
-- sigue funcionando exactamente igual sin modelo_id (nullable), evita romper
-- operacion_items/pedido_items/remito_items/recibo_items/stock_movimientos, que
-- referencian catalogo_productos.id directamente y no cambian.

CREATE TABLE catalogo_modelos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  descripcion  TEXT,
  imagenes     JSONB NOT NULL DEFAULT '[]',
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES catalogo_modelos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalogo_productos_modelo ON catalogo_productos(modelo_id);

COMMENT ON TABLE catalogo_modelos IS
  'Producto padre ("Modelo 3015"). Cada fila de catalogo_productos con modelo_id apuntando acá es UNA VARIANTE de ese modelo (medida/color/apertura propios, con su codigo/precio/stock propio — el codigo ya cumple el rol de SKU por variante).';

INSERT INTO schema_migrations (filename) VALUES ('20260725000002_catalogo_modelos.sql')
  ON CONFLICT DO NOTHING;
