-- Ítem "a relevar": placeholder dentro de un presupuesto para algo que el vendedor
-- todavía no puede identificar del todo (falta medir en el sitio). Se agrega como
-- un ítem más de la lista, sin precio, y se completa en el lugar cuando se releva
-- la visita técnica vinculada — no se agrega un ítem nuevo aparte.
ALTER TABLE operacion_items DROP CONSTRAINT IF EXISTS operacion_items_tipo_item_check;
ALTER TABLE operacion_items ADD CONSTRAINT operacion_items_tipo_item_check
  CHECK (tipo_item IN ('estandar', 'a_medida', 'servicio', 'a_relevar'));

INSERT INTO schema_migrations (filename)
VALUES ('20260803000003_operacion_items_a_relevar.sql') ON CONFLICT DO NOTHING;
