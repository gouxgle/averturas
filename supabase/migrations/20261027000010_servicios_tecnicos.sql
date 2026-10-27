-- Garantías y servicios técnicos (Post venta): una ficha por reclamo o pedido de servicio (ST-YYYYMM-NNNN) con sus
-- visitas (intervenciones), cada una firmada por el cliente. Se vincula al pedido / producto original cuando existe,
-- a la agenda (tarea espejo tipo 'servicio'), a los cobros (recibo directo o presupuesto) y a los reclamos a proveedores.

CREATE TABLE servicios_tecnicos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              TEXT NOT NULL UNIQUE,
  cliente_id          UUID NOT NULL REFERENCES clientes(id),
  -- Pedido y producto original (todo opcional: puede ser un producto que no le vendimos)
  operacion_id        UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  remito_id           UUID REFERENCES remitos(id) ON DELETE SET NULL,
  remito_item_id      UUID REFERENCES remito_items(id) ON DELETE SET NULL,
  operacion_item_id   UUID REFERENCES operacion_items(id) ON DELETE SET NULL,
  producto_id         UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  producto_descripcion TEXT,
  origen              TEXT NOT NULL DEFAULT 'manual'
                        CHECK (origen IN ('manual', 'cliente', 'remito', 'presupuesto', 'postventa')),
  postventa_seguimiento_id UUID REFERENCES postventa_seguimientos(id) ON DELETE SET NULL,
  -- El reclamo
  tipo                TEXT NOT NULL CHECK (tipo IN ('garantia', 'reparacion', 'mantenimiento')),
  problema            TEXT NOT NULL,
  adjuntos            JSONB NOT NULL DEFAULT '[]',
  fecha_reclamo       DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Estado y agenda
  estado              TEXT NOT NULL DEFAULT 'pendiente_coordinar'
                        CHECK (estado IN ('pendiente_coordinar', 'visita_programada', 'en_proceso',
                                          'pendiente_repuesto', 'finalizado', 'cancelado')),
  responsable_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  responsable_nombre  TEXT,
  fecha_visita        DATE,
  hora_visita         TIME,
  tarea_id            UUID REFERENCES tareas(id) ON DELETE SET NULL,
  motivo_cancelacion  TEXT,
  finalizado_at       TIMESTAMPTZ,
  -- Volver a consultar al cliente después de cerrar
  recontacto_fecha    DATE,
  recontacto_tarea_id UUID REFERENCES tareas(id) ON DELETE SET NULL,
  recontacto_resultado TEXT CHECK (recontacto_resultado IN ('funciona', 'sigue_con_problemas')),
  recontacto_at       TIMESTAMPTZ,
  created_by          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_servicios_cliente  ON servicios_tecnicos(cliente_id);
CREATE INDEX idx_servicios_estado   ON servicios_tecnicos(estado);
CREATE INDEX idx_servicios_operacion ON servicios_tecnicos(operacion_id) WHERE operacion_id IS NOT NULL;
CREATE INDEX idx_servicios_postventa ON servicios_tecnicos(postventa_seguimiento_id) WHERE postventa_seguimiento_id IS NOT NULL;

-- Cada visita del técnico. Firmada, no se modifica: el PDF se arma siempre desde acá.
CREATE TABLE servicio_intervenciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id         UUID NOT NULL REFERENCES servicios_tecnicos(id) ON DELETE CASCADE,
  orden               INT NOT NULL,
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  tecnico_id          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tecnico_nombre      TEXT,
  problema_encontrado TEXT,
  trabajo_tipo        TEXT NOT NULL CHECK (trabajo_tipo IN ('ajuste', 'reparacion', 'cambio_pieza', 'reemplazo_completo', 'otro')),
  trabajo_detalle     TEXT NOT NULL,
  materiales          JSONB NOT NULL DEFAULT '[]',
  fotos_antes         JSONB NOT NULL DEFAULT '[]',
  fotos_despues       JSONB NOT NULL DEFAULT '[]',
  observaciones       TEXT,
  pendientes          TEXT,
  con_cargo           BOOLEAN NOT NULL DEFAULT false,
  resultado           TEXT NOT NULL CHECK (resultado IN ('resuelto', 'nueva_visita', 'pendiente_repuesto')),
  -- Firma del cliente (como la entrega en el lugar de los remitos)
  firma_url           TEXT,
  recibio_nombre      TEXT,
  recibio_dni         TEXT,
  conformidad         TEXT CHECK (conformidad IN ('conforme', 'con_observaciones')),
  conformidad_obs     TEXT,
  sin_firma_motivo    TEXT,
  firmada_at          TIMESTAMPTZ,
  enviada_whatsapp_at TIMESTAMPTZ,
  created_by          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (servicio_id, orden)
);

-- Vínculos con lo que ya existe
ALTER TABLE recibos             ADD COLUMN servicio_tecnico_id UUID REFERENCES servicios_tecnicos(id) ON DELETE SET NULL;
ALTER TABLE operaciones         ADD COLUMN servicio_tecnico_id UUID REFERENCES servicios_tecnicos(id) ON DELETE SET NULL;
ALTER TABLE compras_incidencias ADD COLUMN servicio_tecnico_id UUID REFERENCES servicios_tecnicos(id) ON DELETE SET NULL;
ALTER TABLE compras_solicitudes ADD COLUMN servicio_tecnico_id UUID REFERENCES servicios_tecnicos(id) ON DELETE SET NULL;
CREATE INDEX idx_recibos_servicio     ON recibos(servicio_tecnico_id) WHERE servicio_tecnico_id IS NOT NULL;
CREATE INDEX idx_operaciones_servicio ON operaciones(servicio_tecnico_id) WHERE servicio_tecnico_id IS NOT NULL;

-- Meses de garantía: solo para sugerir el tipo ("dentro de garantía, entregado hace 4 meses"), no bloquea nada
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS garantia_meses INT NOT NULL DEFAULT 12;

ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_tipo_accion_check;
ALTER TABLE tareas ADD CONSTRAINT tareas_tipo_accion_check
  CHECK (tipo_accion IN ('whatsapp','llamada','email','visita','nota','entrega',
                         'instalacion','cobranza','seguimiento','cumpleanos','oportunidad','recotizar','postventa','servicio'));

INSERT INTO schema_migrations (filename) VALUES ('20261027000010_servicios_tecnicos.sql') ON CONFLICT DO NOTHING;
