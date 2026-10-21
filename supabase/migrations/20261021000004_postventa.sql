-- Seguimiento post venta: a los 2-3 días de la entrega se contacta al cliente por WhatsApp para saber si quedó
-- conforme con el producto y con el proceso de venta. Cada entrega genera un seguimiento (uno por operación),
-- con su tarea en la agenda; el mensaje sale de una plantilla editable y lleva un link a una encuesta corta.
CREATE TABLE IF NOT EXISTS postventa_seguimientos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  operacion_id        UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  remito_id           UUID REFERENCES remitos(id) ON DELETE SET NULL,
  fecha_entrega       DATE NOT NULL,
  fecha_contacto      DATE NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'respondido', 'descartado')),
  token               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  mensaje             TEXT,
  enviado_at          TIMESTAMPTZ,
  enviado_por         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  canal_respuesta     TEXT CHECK (canal_respuesta IN ('link', 'manual')),
  puntaje_productos   SMALLINT CHECK (puntaje_productos BETWEEN 1 AND 5),
  puntaje_entrega     SMALLINT CHECK (puntaje_entrega BETWEEN 1 AND 5),
  puntaje_atencion    SMALLINT CHECK (puntaje_atencion BETWEEN 1 AND 5),
  comentario          TEXT,
  respondido_at       TIMESTAMPTZ,
  motivo_descarte     TEXT,
  tarea_id            UUID REFERENCES tareas(id) ON DELETE SET NULL,
  notif_leida         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un solo seguimiento vigente por operación (las entregas parciales no lo duplican)
CREATE UNIQUE INDEX IF NOT EXISTS uq_postventa_operacion ON postventa_seguimientos (operacion_id) WHERE estado <> 'descartado';
CREATE INDEX IF NOT EXISTS idx_postventa_estado ON postventa_seguimientos (estado, fecha_contacto);
CREATE INDEX IF NOT EXISTS idx_postventa_cliente ON postventa_seguimientos (cliente_id, created_at DESC);

-- Días entre la entrega y el contacto (se cambia en Configuración)
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS postventa_dias INT NOT NULL DEFAULT 3 CHECK (postventa_dias BETWEEN 0 AND 60);

-- La tarea espejo en la agenda es de tipo 'postventa'
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_tipo_accion_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_tipo_accion_check
  CHECK (tipo_accion IN ('whatsapp','llamada','email','visita','nota','entrega',
                         'instalacion','cobranza','seguimiento','cumpleanos','oportunidad','recotizar','postventa'));

-- Mensaje editable (Configuración → Mensajes)
INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES (
  'postventa_satisfaccion',
  'Post venta: consulta de satisfacción',
  E'Hola {{nombre}}, soy de {{empresa}}. Hace unos días te entregamos {{productos}} y queríamos saber cómo te fue: ¿quedaste conforme con el producto y con la atención?\n\nTe pedimos un minuto para contarnos tu opinión acá: {{link}}\n\n¡Muchas gracias!',
  '{{nombre}}, {{productos}}, {{empresa}}, {{link}}'
) ON CONFLICT (clave) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('20261021000004_postventa.sql') ON CONFLICT DO NOTHING;
