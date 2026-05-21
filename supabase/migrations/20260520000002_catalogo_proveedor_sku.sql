-- Referencia/código del proveedor para cada producto del catálogo
ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS proveedor_sku TEXT;

-- Costo de envío del pedido (10% del subtotal de items por defecto)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(12,2) NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (filename) VALUES ('20260520000002_catalogo_proveedor_sku.sql') ON CONFLICT DO NOTHING;
