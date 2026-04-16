-- ============================================================
-- CRM: estado del cliente, origen, tareas y tipos de interacción
-- ============================================================

-- Estado y origen en clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('prospecto','activo','recurrente','inactivo','perdido')),
  ADD COLUMN IF NOT EXISTS origen TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

COMMENT ON COLUMN clientes.estado           IS 'prospecto → activo → recurrente | inactivo | perdido';
COMMENT ON COLUMN clientes.origen           IS 'recomendacion, redes, web, visita, otro';
COMMENT ON COLUMN clientes.fecha_nacimiento IS 'Solo para personas físicas';

-- Tipos de interacción extendidos (ya existe la columna tipo TEXT)
COMMENT ON COLUMN interacciones.tipo IS
  'nota · llamada · visita · whatsapp · email · presupuesto_enviado · operacion_completada · reclamo · garantia';

-- Tareas / recordatorios vinculadas a clientes
CREATE TABLE IF NOT EXISTS tareas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  descripcion  TEXT NOT NULL,
  vencimiento  DATE,
  prioridad    TEXT NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('alta','normal','baja')),
  completada      BOOLEAN NOT NULL DEFAULT false,
  completada_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tareas_cliente    ON tareas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tareas_vencimiento ON tareas(vencimiento) WHERE NOT completada;
CREATE INDEX IF NOT EXISTS idx_clientes_estado    ON clientes(estado);
