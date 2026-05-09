-- CRM Pipeline: campos de gestión comercial en clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS crm_etapa text
    CHECK (crm_etapa IN ('nuevo','en_contacto','presupuestado','en_decision','cerrado_ganado','cerrado_perdido')),
  ADD COLUMN IF NOT EXISTS interes text DEFAULT 'medio'
    CHECK (interes IN ('caliente','medio','frio')),
  ADD COLUMN IF NOT EXISTS producto_interes text,
  ADD COLUMN IF NOT EXISTS monto_estimado numeric(14,2),
  ADD COLUMN IF NOT EXISTS motivo_perdida text,
  ADD COLUMN IF NOT EXISTS probabilidad smallint DEFAULT 50
    CHECK (probabilidad BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS asignado_a uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proxima_accion text,
  ADD COLUMN IF NOT EXISTS proxima_accion_fecha date;

-- Campos de seguimiento en tareas
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS hora time,
  ADD COLUMN IF NOT EXISTS tipo_accion text DEFAULT 'nota'
    CHECK (tipo_accion IN ('whatsapp','llamada','email','visita','nota'));

-- Migrar prospectos existentes al pipeline
UPDATE clientes
SET crm_etapa = 'nuevo'
WHERE estado = 'prospecto' AND crm_etapa IS NULL;

-- Índice para búsquedas por etapa
CREATE INDEX IF NOT EXISTS idx_clientes_crm_etapa ON clientes (crm_etapa) WHERE crm_etapa IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260509000003_crm_pipeline.sql')
ON CONFLICT DO NOTHING;
