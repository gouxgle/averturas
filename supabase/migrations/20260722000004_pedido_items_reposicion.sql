-- Ítems de reposición en pedidos al proveedor.
-- Un ítem de reposición se pide AUNQUE haya stock (para no dejar el salón sin producto
-- exhibido, o para reponer stock). No cumple la operación (esta sale de stock vía remito):
-- lleva operacion_item_id=NULL, producto_id seteado, y entra a stock al recibirse.
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS es_reposicion BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (filename) VALUES ('20260722000004_pedido_items_reposicion.sql') ON CONFLICT DO NOTHING;
