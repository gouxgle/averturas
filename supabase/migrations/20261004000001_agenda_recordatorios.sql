-- Agenda del día con recordatorios + agenda interna de la empresa + recotizar.
--
-- `tareas` sigue siendo la agenda unificada (oportunidades, entregas y ahora visitas técnicas
-- se reflejan ahí como tareas espejo). Se suma:
--   · tareas internas (sin cliente): categoría, proveedor opcional y repetición;
--   · tipo 'recotizar' (revisar y adecuar una proforma), siempre atado a la proforma;
--   · tarea_recordatorios: cuándo vuelve a avisarle a cada usuario (estado por usuario;
--     completar o reprogramar es global porque cambia la tarea).
-- Los avisos no se generan con ningún proceso nocturno: el aviso del día es una foto de lo
-- pendiente al momento de consultar, así que abrir el sistema horas después no acumula nada.

-- ── Tareas internas ─────────────────────────────────────────────
ALTER TABLE tareas ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS ambito TEXT NOT NULL DEFAULT 'cliente'
    CHECK (ambito IN ('cliente', 'interna')),
  ADD COLUMN IF NOT EXISTS categoria TEXT
    CHECK (categoria IN ('compras', 'proveedores', 'pagos', 'mantenimiento', 'personal', 'otro')),
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  -- Repetición: al completar se crea la siguiente (ver server/src/lib/tareas.ts)
  ADD COLUMN IF NOT EXISTS repetir TEXT CHECK (repetir IN ('semanal', 'mensual', 'dias')),
  ADD COLUMN IF NOT EXISTS repetir_cada_dias INT CHECK (repetir_cada_dias BETWEEN 1 AND 365),
  ADD COLUMN IF NOT EXISTS repetir_dia_mes SMALLINT CHECK (repetir_dia_mes BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS tarea_anterior_id UUID REFERENCES tareas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completada_by UUID REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_ambito_cliente_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_ambito_cliente_check CHECK (
  (ambito = 'cliente' AND cliente_id IS NOT NULL AND categoria IS NULL) OR
  (ambito = 'interna' AND cliente_id IS NULL AND categoria IS NOT NULL)
);
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_repetir_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_repetir_check CHECK (
  repetir IS NULL OR (vencimiento IS NOT NULL AND (repetir <> 'dias' OR repetir_cada_dias IS NOT NULL))
);
-- Completar dos veces la misma tarea repetitiva no crea dos "siguientes"
CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_siguiente ON tareas (tarea_anterior_id)
  WHERE tarea_anterior_id IS NOT NULL;

-- ── Recotizar ───────────────────────────────────────────────────
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_tipo_accion_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_tipo_accion_check
  CHECK (tipo_accion IN ('whatsapp','llamada','email','visita','nota','entrega',
                         'instalacion','cobranza','seguimiento','cumpleanos','oportunidad','recotizar'));
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_recotizar_proforma_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_recotizar_proforma_check
  CHECK (tipo_accion IS DISTINCT FROM 'recotizar' OR operacion_id IS NOT NULL);

-- "Ajustar y reenviar proforma" (respuesta "quiero modificar" del link público) pasa a
-- recotizar: la más nueva pendiente de cada proforma; si hubiera más, quedan como estaban.
UPDATE tareas SET tipo_accion = 'recotizar'
 WHERE id IN (
   SELECT DISTINCT ON (operacion_id) id FROM tareas
    WHERE NOT completada AND operacion_id IS NOT NULL AND tipo_accion = 'seguimiento'
      AND descripcion LIKE 'Ajustar y reenviar proforma%'
    ORDER BY operacion_id, created_at DESC);

-- Una sola recotización pendiente por proforma
CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_recotizar_pendiente ON tareas (operacion_id)
  WHERE tipo_accion = 'recotizar' AND NOT completada;

-- ── Visitas técnicas: tarea espejo ──────────────────────────────
ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS tarea_id UUID REFERENCES tareas(id) ON DELETE SET NULL;

WITH nuevas AS (
  INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, created_by)
  SELECT vt.cliente_id, vt.operacion_id,
         'Visita de relevamiento ' || vt.numero || COALESCE(' — ' || vt.tecnico, ''),
         vt.fecha_visita, 'normal', 'visita', vt.created_by
    FROM visitas_tecnicas vt
   WHERE vt.estado = 'pendiente' AND vt.fecha_visita IS NOT NULL AND vt.tarea_id IS NULL
  RETURNING id, cliente_id, vencimiento, descripcion
)
UPDATE visitas_tecnicas vt SET tarea_id = n.id
  FROM nuevas n
 WHERE vt.cliente_id = n.cliente_id AND vt.fecha_visita = n.vencimiento
   AND n.descripcion LIKE 'Visita de relevamiento ' || vt.numero || '%'
   AND vt.tarea_id IS NULL;

-- ── Entregas: la hora pasa a la tarea espejo ────────────────────
UPDATE tareas t SET hora = r.hora_entrega_est
  FROM remitos r
 WHERE r.tarea_id = t.id AND r.hora_entrega_est IS NOT NULL AND t.hora IS NULL;

-- ── Recordatorios por usuario ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tarea_recordatorios (
  tarea_id      UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mostrar_desde TIMESTAMPTZ NOT NULL,   -- cuándo le vuelve a aparecer a este usuario
  visto_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tarea_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_tarea_recordatorios_usuario ON tarea_recordatorios (usuario_id);

INSERT INTO schema_migrations (filename) VALUES ('20261004000001_agenda_recordatorios.sql') ON CONFLICT DO NOTHING;
