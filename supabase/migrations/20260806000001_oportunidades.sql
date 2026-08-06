-- Oportunidades futuras: proyectos que el cliente hará más adelante ("el año
-- que viene cambio las ventanas"). Registran intención de compra postergada
-- con fecha de recontacto, y generan una tarea espejo en la agenda para que
-- el sistema avise solo cuando llegue el día — sin necesidad de un cron.
CREATE TABLE IF NOT EXISTS oportunidades (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  operacion_id_origen UUID REFERENCES operaciones(id)        ON DELETE SET NULL,  -- presupuesto que la originó
  operacion_id_ganada UUID REFERENCES operaciones(id)        ON DELETE SET NULL,  -- presupuesto que salió de ella
  tarea_id            UUID REFERENCES tareas(id)             ON DELETE SET NULL,  -- espejo en la agenda (regenerable)

  motivo           TEXT NOT NULL,
  fecha_recontacto DATE NOT NULL,
  interes          TEXT NOT NULL DEFAULT 'medio' CHECK (interes IN ('alto','medio','bajo')),
  probabilidad     INT  NOT NULL DEFAULT 50 CHECK (probabilidad BETWEEN 0 AND 100),
  observaciones    TEXT,

  estado           TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','contactada','convertida','descartada')),
  motivo_cierre    TEXT,
  origen           TEXT NOT NULL DEFAULT 'crm'
                     CHECK (origen IN ('cliente','presupuesto','crm','publico')),

  veces_pospuesta    INT NOT NULL DEFAULT 0,
  ultimo_contacto_at TIMESTAMPTZ,
  cerrada_at         TIMESTAMPTZ,
  -- El "evento" no es una escritura sino la llegada de una fecha. Todo cambio
  -- de fecha_recontacto (alta, edición, posponer) DEBE resetear esto a false
  -- (centralizado en sincronizarTarea/posponer) — si no, una oportunidad
  -- pospuesta nunca volvería a sonar en la campanita.
  notif_leida        BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oport_pendientes ON oportunidades (fecha_recontacto) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_oport_cliente    ON oportunidades (cliente_id);

-- Guarda anti doble-submit (mismo cliente, misma fecha, mismo motivo) — NO
-- impide que un cliente tenga varios proyectos futuros distintos, que es
-- justamente el motivo de esta tabla en vez de reusar clientes.proxima_accion_fecha.
CREATE UNIQUE INDEX IF NOT EXISTS uq_oport_dup
  ON oportunidades (cliente_id, fecha_recontacto, md5(lower(btrim(motivo)))) WHERE estado = 'pendiente';

-- Nuevo tipo de acción para la tarea espejo (mismo patrón que
-- 20260626000001_crm_postventa.sql para ampliar este CHECK).
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_tipo_accion_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_tipo_accion_check
  CHECK (tipo_accion IN ('whatsapp','llamada','email','visita','nota','entrega',
                         'instalacion','cobranza','seguimiento','cumpleanos','oportunidad'));

INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES
('oportunidad_recontacto', 'Recontacto de oportunidad futura',
 E'Hola {{nombre}}! ¿Cómo va todo?\n\nTe escribo de *{{empresa}}*. Habíamos quedado en volver a contactarte por {{motivo}}.\n\n¿Seguís con la idea? Si querés te paso un presupuesto actualizado, sin compromiso.',
 '{{nombre}}, {{motivo}}, {{empresa}}')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('20260806000001_oportunidades.sql') ON CONFLICT DO NOTHING;
