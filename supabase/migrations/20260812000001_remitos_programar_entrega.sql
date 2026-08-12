-- Programación de entregas con recordatorios automáticos.
-- remitos ya es la entidad que representa una entrega (cliente, dirección,
-- fecha estimada); se le agrega hora + espejo de tarea + flags de recordatorio.

ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS hora_entrega_est TIME,
  ADD COLUMN IF NOT EXISTS tarea_id UUID REFERENCES tareas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_dia_antes_visto  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_hora_antes_visto BOOLEAN NOT NULL DEFAULT false;

INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES
('entrega_recordatorio', 'Recordatorio de entrega próxima',
 E'Hola {{nombre}}! Te escribo de *{{empresa}}* para avisarte que tu entrega está programada para hoy a las {{hora}}hs. ¿Seguís en la dirección indicada?',
 '{{nombre}}, {{empresa}}, {{hora}}')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('20260812000001_remitos_programar_entrega.sql') ON CONFLICT DO NOTHING;
