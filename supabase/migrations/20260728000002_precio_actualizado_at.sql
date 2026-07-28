-- Antigüedad del precio en la galería de productos: permite colorear el precio
-- según hace cuánto se actualizó (verde <=7 días, amarillo 8-10, rojo >10) para
-- detectar precios desactualizados a simple vista. DEFAULT now() en productos
-- ya existentes: arrancan "recién actualizados" (más seguro que asumir vencidos).
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS precio_actualizado_at TIMESTAMPTZ NOT NULL DEFAULT now();

INSERT INTO schema_migrations (filename) VALUES ('20260728000002_precio_actualizado_at.sql')
  ON CONFLICT DO NOTHING;
