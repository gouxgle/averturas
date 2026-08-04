-- Precio de lista al momento de agregar el ítem — solo se completa cuando el
-- producto tenía una promoción activa. NULL = no venía de una promo (comportamiento
-- normal). Permite mostrar en la proforma "de $X a $Y, ahorrás $Z" sin depender de
-- si la promoción del catálogo sigue activa más adelante (snapshot al momento de
-- cargar, igual que costo_cobrado en visitas_tecnicas).
ALTER TABLE operacion_items
  ADD COLUMN IF NOT EXISTS precio_lista numeric(12,2) DEFAULT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260804000002_operacion_items_precio_lista.sql') ON CONFLICT DO NOTHING;
