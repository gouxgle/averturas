-- Registro de actividad de operadores: qué hizo cada usuario sobre presupuestos,
-- recibos y remitos (crear, editar, cambiar de estado, anular, emitir, eliminar) y
-- cada modificación de presupuesto (versión vN). Complementa lo que ya se guardaba
-- disperso (operaciones/recibos/remitos.created_by, operacion_versiones.created_by,
-- estados_historial): acá queda todo en una sola línea de tiempo consultable.
--
-- Se llena best-effort desde la capa de rutas (server/src/lib/actividad.ts,
-- fire-and-forget) — nunca bloquea ni revierte la operación real.
CREATE TABLE IF NOT EXISTS actividad_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre TEXT,                          -- snapshot: sobrevive al borrado del usuario
  entidad        TEXT NOT NULL,                 -- 'presupuesto' | 'recibo' | 'remito'
  entidad_id     UUID,
  entidad_numero TEXT,                          -- ej. 'OP-00123', 'REC-00045', 'REM-00012'
  accion         TEXT NOT NULL,                 -- 'crear' | 'editar' | 'cambio_estado' | 'anular' | 'emitir' | 'eliminar' | ...
  detalle        TEXT,                          -- texto legible ('v3 · a pedido del cliente', 'enviado → aprobado', motivo de anulación...)
  meta           JSONB,                         -- datos extra opcionales
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actividad_log_created_at ON actividad_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actividad_log_usuario    ON actividad_log (usuario_id);
CREATE INDEX IF NOT EXISTS idx_actividad_log_entidad    ON actividad_log (entidad, entidad_id);

INSERT INTO schema_migrations (filename) VALUES ('20260906000003_actividad_log.sql') ON CONFLICT DO NOTHING;
