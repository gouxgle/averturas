-- Visita técnica: ítems tipo "servicio" hasta ahora solo tenían descripción libre.
-- Igual que en presupuestos (operacion_items.servicio_id), permitir elegir un servicio
-- ya cargado en catálogo (Configuración → Servicios) para agilizar la carga del relevado.
ALTER TABLE visita_tecnica_items
  ADD COLUMN IF NOT EXISTS servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260725000005_visita_tecnica_items_servicio.sql')
  ON CONFLICT DO NOTHING;
