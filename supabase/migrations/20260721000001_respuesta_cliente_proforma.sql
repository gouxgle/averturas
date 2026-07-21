-- Fase 1: captura de intención del cliente en la proforma pública.
-- respuesta_cliente = mas_tiempo|consulta|llamada|modificar (null = sin respuesta intermedia).
-- No toca estado_operacion: la intención se guarda aparte del pipeline de producción/entrega.
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS respuesta_cliente    TEXT,
  ADD COLUMN IF NOT EXISTS respuesta_cliente_at TIMESTAMPTZ;

-- interacciones y tareas hoy cuelgan solo de cliente_id; las vinculamos también a la operación.
ALTER TABLE interacciones ADD COLUMN IF NOT EXISTS operacion_id UUID REFERENCES operaciones(id) ON DELETE CASCADE;
ALTER TABLE tareas        ADD COLUMN IF NOT EXISTS operacion_id UUID REFERENCES operaciones(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260721000001_respuesta_cliente_proforma.sql') ON CONFLICT DO NOTHING;
