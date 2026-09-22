-- Módulo Compras — Etapa 2: confirmación, seguimiento, recepción por ítem y reclamos.
-- Ver docs/compras-plan.md. La recepción pasa a ser por ítem (parciales, faltantes, con
-- problema) y el ingreso a stock se hace SOLO por la cantidad conforme; el flujo viejo
-- (PATCH /pedidos/:id/estado recibido) pasa por el mismo camino (crearRecepcion).

-- ── Bitácora de la OC ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_seguimientos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id              UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  fecha                  DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo                   TEXT NOT NULL CHECK (tipo IN ('envio','confirmacion','estado','seguimiento','demora','nota','recepcion','reclamo')),
  estado_logistica_nuevo TEXT,
  respuesta_proveedor    TEXT,
  nueva_fecha_prometida  DATE,
  observaciones          TEXT,
  created_by             UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_seg_pedido ON compras_seguimientos(pedido_id, created_at DESC);

-- ── Recepciones (una por entrega; soporta parciales) ──────────────────────────
CREATE TABLE IF NOT EXISTS compras_recepciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id           UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  numero_secuencia    INT NOT NULL DEFAULT 1,
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  remito_proveedor_nro TEXT,
  transportista_id    UUID REFERENCES transportistas(id) ON DELETE SET NULL,
  costo_envio_real    NUMERIC(12,2),
  adjuntos            JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas               TEXT,
  created_by          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, numero_secuencia)
);
CREATE INDEX IF NOT EXISTS idx_compras_recep_pedido ON compras_recepciones(pedido_id);

CREATE TABLE IF NOT EXISTS compras_recepcion_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id      UUID NOT NULL REFERENCES compras_recepciones(id) ON DELETE CASCADE,
  pedido_item_id    UUID NOT NULL REFERENCES pedido_items(id) ON DELETE CASCADE,
  cantidad_recibida NUMERIC(10,2) NOT NULL DEFAULT 0,
  cantidad_conforme NUMERIC(10,2) NOT NULL DEFAULT 0,
  cantidad_problema NUMERIC(10,2) NOT NULL DEFAULT 0,
  no_recibido       BOOLEAN NOT NULL DEFAULT false,
  observaciones     TEXT
);
CREATE INDEX IF NOT EXISTS idx_compras_recep_items_rec ON compras_recepcion_items(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_compras_recep_items_pi  ON compras_recepcion_items(pedido_item_id);

-- ── Incidencias / reclamos (REC-YYYYMM-NNNN) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_incidencias (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                 TEXT UNIQUE NOT NULL,
  pedido_id              UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  pedido_item_id         UUID NOT NULL REFERENCES pedido_items(id) ON DELETE CASCADE,
  recepcion_item_id      UUID REFERENCES compras_recepcion_items(id) ON DELETE SET NULL,
  tipo                   TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN (
                           'producto_faltante','medida_incorrecta','color_incorrecto','vidrio_roto','vidrio_rayado',
                           'perfil_golpeado','perfil_rayado','herraje_faltante','herraje_incorrecto',
                           'producto_incompleto','error_fabricacion','otro')),
  cantidad_afectada      NUMERIC(10,2) NOT NULL DEFAULT 1,
  descripcion            TEXT,
  -- Fotos como URLs subidas; los videos van como URL externa (no hay upload de video)
  adjuntos               JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado                 TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN (
                           'abierta','reclamada','respondida','en_reposicion','resuelta','rechazada')),
  reclamada_at           TIMESTAMPTZ,
  reclamada_medio        TEXT CHECK (reclamada_medio IN ('whatsapp','email','manual')),
  respuesta_proveedor    TEXT,
  respondida_at          TIMESTAMPTZ,
  solucion               TEXT CHECK (solucion IN (
                           'reposicion_total','reposicion_parcial','cambio_vidrio','envio_herraje','reparacion',
                           'descuento','nota_credito','devolucion','rechazado')),
  solucion_detalle       TEXT,
  monto_descuento        NUMERIC(12,2),
  reposicion_pedido_item_id UUID REFERENCES pedido_items(id) ON DELETE SET NULL,
  resuelta_at            TIMESTAMPTZ,
  created_by             UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_inc_pedido ON compras_incidencias(pedido_id);
CREATE INDEX IF NOT EXISTS idx_compras_inc_estado ON compras_incidencias(estado);

-- ── Demora automática: flag de "aviso visto" (no hace falta cron) ─────────────
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS demora_notif_leida BOOLEAN NOT NULL DEFAULT false,
  -- Se resetea al reprogramar: una fecha nueva vencida vuelve a avisar
  ADD COLUMN IF NOT EXISTS confirmacion_medio TEXT;

-- Las OC históricas ya vencidas no deben inundar la campanita el día del deploy.
UPDATE pedidos SET demora_notif_leida = true
WHERE fecha_prometida IS NOT NULL AND fecha_prometida < CURRENT_DATE;

-- ── Recepciones históricas: una recepción sintética por cada OC ya recibida ───
-- Así "Recepciones" no arranca vacío y los acumulados por ítem cuadran con el stock
-- que ya se ingresó con el flujo viejo (todo conforme, cantidad pedida).
INSERT INTO compras_recepciones (pedido_id, numero_secuencia, fecha, transportista_id, costo_envio_real, notas, created_by, created_at)
SELECT p.id, 1, COALESCE(p.fecha_recepcion, p.updated_at::date), p.transportista_id, p.costo_envio,
       'Recepción registrada con el flujo anterior (todo conforme)', p.created_by, p.updated_at
FROM pedidos p
WHERE p.estado = 'recibido'
  AND NOT EXISTS (SELECT 1 FROM compras_recepciones r WHERE r.pedido_id = p.id);

INSERT INTO compras_recepcion_items (recepcion_id, pedido_item_id, cantidad_recibida, cantidad_conforme)
SELECT r.id, pi.id, pi.cantidad, pi.cantidad
FROM compras_recepciones r
JOIN pedido_items pi ON pi.pedido_id = r.pedido_id
WHERE NOT EXISTS (SELECT 1 FROM compras_recepcion_items ri WHERE ri.recepcion_id = r.id AND ri.pedido_item_id = pi.id);

UPDATE pedido_items pi SET cantidad_recibida = pi.cantidad, cantidad_conforme = pi.cantidad, estado_item = 'recibido'
FROM pedidos p
WHERE p.id = pi.pedido_id AND p.estado = 'recibido' AND pi.cantidad_recibida = 0;

-- ── Plantilla de reclamo al proveedor ─────────────────────────────────────────
INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES
  ('compra_reclamo', 'Reclamo al proveedor',
   E'Hola! Te escribimos por un problema con la orden *{{numero_oc}}*.\n\nReclamo *{{numero}}*\n{{detalle}}\n\n{{descripcion}}\n\nPor favor confirmanos cómo lo resolvemos. ¡Gracias!',
   '{{numero}}, {{numero_oc}}, {{detalle}}, {{descripcion}}')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('20260922000002_compras_etapa2.sql')
ON CONFLICT DO NOTHING;
