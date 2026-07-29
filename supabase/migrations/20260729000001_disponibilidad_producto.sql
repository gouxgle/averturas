-- Validación de disponibilidad antes de comprometer fecha de entrega: el vendedor
-- confirma con el proveedor por WhatsApp que el producto tiene stock/plazo real,
-- y recién ahí el sistema deja de marcar la fecha de entrega como "estimativa".
-- Sin DEFAULT now(): los productos existentes arrancan sin confirmar a propósito
-- (el punto es no asumir disponibilidad no verificada).
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS disponibilidad_confirmada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disponibilidad_confirmada_by UUID REFERENCES usuarios(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260729000001_disponibilidad_producto.sql')
  ON CONFLICT DO NOTHING;
