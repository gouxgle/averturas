-- Le devuelve al remito el vínculo con el ítem de la operación que entrega.
--
-- Hasta hoy `importarItemsOp` en NuevoRemito.tsx copiaba los ítems del
-- presupuesto pero descartaba el vínculo: guardaba producto_id vacío y una
-- descripción modificada (le agrega las medidas). Sin ese vínculo el sistema no
-- puede responder dos preguntas básicas de una entrega parcial:
--
--   1. Qué se está entregando realmente — por eso el remito impreso terminaba
--      mostrando TODOS los ítems del presupuesto en vez de los del remito.
--   2. Qué queda pendiente de entregar — por eso cualquier remito marcaba la
--      operación entera como entregada.
--
-- `pedido_items.operacion_item_id` ya resolvía esto mismo del lado de los
-- pedidos al proveedor; acá se replica el patrón.

ALTER TABLE remito_items
  ADD COLUMN IF NOT EXISTS operacion_item_id UUID REFERENCES operacion_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN remito_items.operacion_item_id IS
  'Ítem del presupuesto que este renglón entrega. Permite saber qué queda pendiente en entregas parciales. NULL = renglón cargado a mano, sin origen en la operación.';

CREATE INDEX IF NOT EXISTS idx_remito_items_operacion_item ON remito_items (operacion_item_id);

-- Backfill de lo ya cargado. La descripción del remito es la del ítem de la
-- operación con las medidas agregadas al final, así que se busca por prefijo —
-- pero SOLO se asigna cuando hay un único candidato posible, para no adivinar
-- mal en operaciones con renglones de descripción repetida.
WITH candidatos AS (
  SELECT ri.id AS remito_item_id,
         min(oi.id::text)::uuid AS operacion_item_id,
         count(*) AS cuantos
  FROM remito_items ri
  JOIN remitos r      ON r.id = ri.remito_id
  JOIN operacion_items oi ON oi.operacion_id = r.operacion_id
  WHERE ri.operacion_item_id IS NULL
    AND ri.descripcion LIKE oi.descripcion || '%'
  GROUP BY ri.id
)
UPDATE remito_items ri
SET operacion_item_id = c.operacion_item_id
FROM candidatos c
WHERE ri.id = c.remito_item_id AND c.cuantos = 1;

-- Recupera el producto de catálogo en los renglones que lo perdieron: sin él la
-- emisión del remito no descuenta stock.
UPDATE remito_items ri
SET producto_id = oi.producto_id
FROM operacion_items oi
WHERE ri.operacion_item_id = oi.id
  AND ri.producto_id IS NULL
  AND oi.producto_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260910000008_remito_items_operacion_item.sql') ON CONFLICT DO NOTHING;
