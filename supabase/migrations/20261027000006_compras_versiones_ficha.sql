-- Compras: versiones de la configuración de un ítem y foto de lo que se mandó a cotizar.
--
-- · Un ítem de la solicitud puede tener versiones (V1 vidrio incoloro → V2 vidrio opalino). Cada versión es su
--   propio renglón: `item_origen_id` apunta a la V1 de la cadena y `version` la numera. La versión anterior no se
--   toca: conserva sus cotizaciones. Al comprar una versión, las otras pendientes quedan canceladas con
--   `reemplazado_por_id` (la que se compró).
-- · `compras_cotizacion_items` guarda la foto (descripción, ficha y adjuntos) al crear la cotización: es lo que se le
--   pidió al proveedor; la comparativa, el PDF y la orden de compra la usan.
ALTER TABLE compras_solicitud_items
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN IF NOT EXISTS item_origen_id UUID REFERENCES compras_solicitud_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reemplazado_por_id UUID REFERENCES compras_solicitud_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_compras_solicitud_items_origen ON compras_solicitud_items (item_origen_id)
  WHERE item_origen_id IS NOT NULL;
-- Una sola V2, V3… por cadena (dos "nueva versión" simultáneas no duplican el número)
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_solicitud_items_version ON compras_solicitud_items (item_origen_id, version)
  WHERE item_origen_id IS NOT NULL;

ALTER TABLE compras_cotizacion_items
  ADD COLUMN IF NOT EXISTS version INT,
  ADD COLUMN IF NOT EXISTS descripcion_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS especificaciones_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS adjuntos_snapshot JSONB;

-- Cotizaciones existentes: la solicitud no se puede editar una vez cotizada, así que la ficha actual es la enviada
UPDATE compras_cotizacion_items ci
   SET version = 1, descripcion_snapshot = si.descripcion,
       especificaciones_snapshot = si.especificaciones, adjuntos_snapshot = si.adjuntos
  FROM compras_solicitud_items si
 WHERE si.id = ci.solicitud_item_id AND ci.especificaciones_snapshot IS NULL;

INSERT INTO schema_migrations (filename) VALUES ('20261027000006_compras_versiones_ficha.sql') ON CONFLICT DO NOTHING;
