-- Compras: la OC lleva los croquis / fotos / PDF de cada ítem (los de la ficha de la solicitud), así el PDF de la
-- orden se los muestra al proveedor igual que el pedido de cotización.
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]';

UPDATE pedido_items pi SET adjuntos = si.adjuntos
  FROM compras_solicitud_items si
 WHERE si.id = pi.solicitud_item_id AND pi.adjuntos = '[]'::jsonb
   AND jsonb_typeof(si.adjuntos) = 'array' AND jsonb_array_length(si.adjuntos) > 0;

INSERT INTO schema_migrations (filename) VALUES ('20261027000004_pedido_items_adjuntos.sql') ON CONFLICT DO NOTHING;
