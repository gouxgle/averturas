-- Pedidos al proveedor para stock propio / salón: no provienen de un presupuesto,
-- no tienen cliente final — el destino es la propia empresa (generar stock o exhibir en salón).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS es_stock_propio BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (filename) VALUES ('20260723000001_pedidos_stock_propio.sql') ON CONFLICT DO NOTHING;
