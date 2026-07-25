-- Visita técnica: además de "a medida" y "servicio", ahora se puede relevar un ítem
-- como producto de catálogo (estándar) — ej. el cliente quiere directamente un mosquitero
-- o accesorio ya fabricado, no algo a medir ni un service. Se propaga igual que los
-- otros dos tipos al avanzar a presupuesto.
ALTER TABLE visita_tecnica_items
  DROP CONSTRAINT visita_tecnica_items_tipo_item_check;
ALTER TABLE visita_tecnica_items
  ADD CONSTRAINT visita_tecnica_items_tipo_item_check CHECK (tipo_item IN ('a_medida','servicio','estandar'));

ALTER TABLE visita_tecnica_items
  ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260725000004_visita_tecnica_items_estandar.sql')
  ON CONFLICT DO NOTHING;
