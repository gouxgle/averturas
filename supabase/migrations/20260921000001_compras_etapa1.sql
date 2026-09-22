-- Módulo Compras y Proveedores — Etapa 1: Solicitud (SC) → Cotización (PC) → Orden de compra (OC).
-- Ver docs/compras-plan.md. La OC ES la tabla `pedidos` extendida: las filas viejas (PED-)
-- quedan como OC históricas y las nuevas se numeran OC-. No se renombra ni se migra nada
-- que lean kanban, cobertura, remitos o dashboard.

-- ── Solicitudes de compra ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_solicitudes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                TEXT UNIQUE NOT NULL,
  origen                TEXT NOT NULL CHECK (origen IN (
                          'venta','proforma','orden_trabajo','reposicion_stock',
                          'produccion_propia','faltante','garantia','reposicion_falla')),
  operacion_id          UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  visita_tecnica_id     UUID REFERENCES visitas_tecnicas(id) ON DELETE SET NULL,
  cliente_id            UUID REFERENCES clientes(id) ON DELETE SET NULL,
  obra                  TEXT,
  tipo_producto         TEXT NOT NULL DEFAULT 'abertura_medida' CHECK (tipo_producto IN (
                          'abertura_estandar','abertura_medida','perfil','vidrio','herraje_accesorio','otro')),
  fecha_necesaria       DATE,
  observaciones         TEXT,
  adjuntos              JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado                TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN (
                          'abierta','en_cotizacion','con_oc','cerrada','cancelada')),
  proveedor_sugerido_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  created_by            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_sol_estado    ON compras_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_compras_sol_operacion ON compras_solicitudes(operacion_id);

CREATE TABLE IF NOT EXISTS compras_solicitud_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id            UUID NOT NULL REFERENCES compras_solicitudes(id) ON DELETE CASCADE,
  orden                   INT NOT NULL DEFAULT 0,
  operacion_item_id       UUID REFERENCES operacion_items(id) ON DELETE SET NULL,
  visita_tecnica_item_id  UUID REFERENCES visita_tecnica_items(id) ON DELETE SET NULL,
  producto_id             UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  descripcion             TEXT NOT NULL,
  cantidad                NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  unidad                  TEXT NOT NULL DEFAULT 'u' CHECK (unidad IN ('u','m','m2','kg')),
  especificaciones        JSONB NOT NULL DEFAULT '{}'::jsonb,
  adjuntos                JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones           TEXT,
  -- costo del presupuesto / costo_base del catálogo: default de precio en la OC y peso del prorrateo
  costo_referencia        NUMERIC(12,2),
  proveedor_sku           TEXT,
  estado                  TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
                            'pendiente','en_cotizacion','comprado','cancelado'))
);
CREATE INDEX IF NOT EXISTS idx_compras_sol_items_sol ON compras_solicitud_items(solicitud_id);

-- ── Pedidos de cotización ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_cotizaciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT UNIQUE NOT NULL,
  solicitud_id   UUID NOT NULL REFERENCES compras_solicitudes(id) ON DELETE RESTRICT,
  estado         TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN (
                   'abierta','adjudicada','no_concretada','cancelada')),
  motivo_cierre  TEXT,
  fecha_limite   DATE,
  observaciones  TEXT,
  adjuntos       JSONB NOT NULL DEFAULT '[]'::jsonb,
  adjudicada_a_id UUID,   -- FK a compras_cotizacion_proveedores, se agrega abajo (orden de creación)
  created_by     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_cot_solicitud ON compras_cotizaciones(solicitud_id);

-- Los ítems de la PC son los de la SC (no se duplican): acá solo qué subconjunto se cotiza.
CREATE TABLE IF NOT EXISTS compras_cotizacion_items (
  cotizacion_id     UUID NOT NULL REFERENCES compras_cotizaciones(id) ON DELETE CASCADE,
  solicitud_item_id UUID NOT NULL REFERENCES compras_solicitud_items(id) ON DELETE CASCADE,
  cantidad          NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (cotizacion_id, solicitud_item_id)
);

-- Una fila por proveedor invitado a cotizar.
CREATE TABLE IF NOT EXISTS compras_cotizacion_proveedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id   UUID NOT NULL REFERENCES compras_cotizaciones(id) ON DELETE CASCADE,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  enviada_at      TIMESTAMPTZ,
  enviada_medio   TEXT CHECK (enviada_medio IN ('whatsapp','email','manual')),
  contacto        TEXT,
  respondida_at   TIMESTAMPTZ,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
                    'pendiente','enviada','respondida','sin_respuesta','seleccionada','descartada')),
  subtotal_neto   NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento_monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_pct         NUMERIC(5,2)  NOT NULL DEFAULT 21,   -- IVA de cabecera cuando no hay precios por ítem
  iva_monto       NUMERIC(14,2) NOT NULL DEFAULT 0,
  flete           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  plazo_dias      INT,
  disponibilidad  TEXT CHECK (disponibilidad IN ('inmediata','a_fabricar','parcial','sin_stock')),
  forma_pago      TEXT,
  validez_hasta   DATE,
  observaciones   TEXT,
  archivo_url     TEXT,
  adjuntos        JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (cotizacion_id, proveedor_id)
);

ALTER TABLE compras_cotizaciones
  DROP CONSTRAINT IF EXISTS compras_cotizaciones_adjudicada_a_id_fkey;
ALTER TABLE compras_cotizaciones
  ADD CONSTRAINT compras_cotizaciones_adjudicada_a_id_fkey
  FOREIGN KEY (adjudicada_a_id) REFERENCES compras_cotizacion_proveedores(id) ON DELETE SET NULL;

-- Precio por ítem de la respuesta (opcional: si el proveedor pasa un solo total no hay filas).
CREATE TABLE IF NOT EXISTS compras_cotizacion_respuesta_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_proveedor_id UUID NOT NULL REFERENCES compras_cotizacion_proveedores(id) ON DELETE CASCADE,
  solicitud_item_id       UUID NOT NULL REFERENCES compras_solicitud_items(id) ON DELETE CASCADE,
  precio_unitario_neto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_pct           NUMERIC(5,2)  NOT NULL DEFAULT 0,
  iva_pct                 NUMERIC(5,2)  NOT NULL DEFAULT 21,
  plazo_dias              INT,
  disponibilidad          TEXT CHECK (disponibilidad IN ('inmediata','a_fabricar','parcial','sin_stock')),
  observaciones           TEXT,
  UNIQUE (cotizacion_proveedor_id, solicitud_item_id)
);

-- ── pedidos (OC) — columnas nuevas ────────────────────────────────────────────
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS solicitud_id             UUID REFERENCES compras_solicitudes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cotizacion_id            UUID REFERENCES compras_cotizaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cotizacion_proveedor_id  UUID REFERENCES compras_cotizacion_proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS es_consolidada           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtotal_neto            NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_monto          NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_monto                NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total                    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pago               TEXT,
  ADD COLUMN IF NOT EXISTS contacto_proveedor       TEXT,
  ADD COLUMN IF NOT EXISTS enviada_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enviada_medio            TEXT CHECK (enviada_medio IN ('whatsapp','email','manual')),
  ADD COLUMN IF NOT EXISTS adjuntos                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmacion_recepcion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmacion_precio      BOOLEAN,
  ADD COLUMN IF NOT EXISTS confirmacion_caracteristicas BOOLEAN,
  ADD COLUMN IF NOT EXISTS fecha_prometida          DATE,
  ADD COLUMN IF NOT EXISTS estado_logistica         TEXT NOT NULL DEFAULT 'borrador' CHECK (estado_logistica IN (
    'borrador','enviada','confirmada','en_preparacion','en_fabricacion','terminado','listo_despacho',
    'en_transito','demorado','recibida_parcial','recibida','cerrada','cancelada')),
  ADD COLUMN IF NOT EXISTS estado_calidad           TEXT NOT NULL DEFAULT 'sin_reclamos' CHECK (estado_calidad IN (
    'sin_reclamos','reclamo_pendiente','resuelto')),
  ADD COLUMN IF NOT EXISTS estado_finanzas          TEXT NOT NULL DEFAULT 'sin_factura' CHECK (estado_finanzas IN (
    'sin_factura','pendiente','pago_parcial','pagada','con_credito')),
  ADD COLUMN IF NOT EXISTS estado_docs              TEXT NOT NULL DEFAULT 'incompleta' CHECK (estado_docs IN ('incompleta','completa')),
  ADD COLUMN IF NOT EXISTS cerrada_totalmente_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_estado_logistica ON pedidos(estado_logistica);
CREATE INDEX IF NOT EXISTS idx_pedidos_solicitud        ON pedidos(solicitud_id);

-- Backfill de las OC históricas: la logística se deriva del estado legacy y los
-- totales se copian tal cual (sin IVA: los PED- se cargaban con costo final).
UPDATE pedidos SET
  estado_logistica = CASE estado
    WHEN 'pendiente' THEN 'borrador'
    WHEN 'enviado'   THEN 'enviada'
    WHEN 'recibido'  THEN 'recibida'
    WHEN 'cancelado' THEN 'cancelada'
    ELSE 'borrador' END,
  subtotal_neto = monto_total - costo_envio,
  total         = monto_total,
  fecha_prometida = fecha_entrega_est;

-- ── pedido_items — columnas nuevas ────────────────────────────────────────────
ALTER TABLE pedido_items
  ADD COLUMN IF NOT EXISTS solicitud_item_id     UUID REFERENCES compras_solicitud_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS especificaciones      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unidad                TEXT NOT NULL DEFAULT 'u',
  ADD COLUMN IF NOT EXISTS proveedor_sku         TEXT,
  ADD COLUMN IF NOT EXISTS precio_unitario_neto  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_pct               NUMERIC(5,2)  NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS cantidad_recibida     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_conforme     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_problema     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_item           TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_item IN (
    'pendiente','parcial','recibido','cancelado')),
  ADD COLUMN IF NOT EXISTS es_reposicion_reclamo BOOLEAN NOT NULL DEFAULT false;

-- Perfiles se piden en metros: cantidad deja de ser entero.
ALTER TABLE pedido_items ALTER COLUMN cantidad TYPE NUMERIC(10,2);

-- Backfill: los ítems históricos no tenían IVA discriminado → neto = costo, IVA 0.
UPDATE pedido_items SET precio_unitario_neto = costo_unitario, iva_pct = 0
WHERE precio_unitario_neto = 0 AND costo_unitario <> 0;

-- ── Plantillas de mensajes nuevas (editables en Configuración) ────────────────
INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES
  ('compra_cotizacion', 'Pedido de cotización al proveedor',
   E'Hola! Te pedimos cotización *{{numero}}* de César Brítez Aberturas.\n\n{{detalle}}\n\nAdjuntamos el detalle en PDF.{{fecha_limite}}\n\nQuedamos atentos a tu respuesta. ¡Gracias!',
   '{{numero}}, {{detalle}}, {{fecha_limite}}'),
  ('compra_orden', 'Orden de compra al proveedor',
   E'Hola! Te enviamos la orden de compra *{{numero}}* de César Brítez Aberturas.\n\n{{detalle}}\n\nTotal: *{{total}}*{{fecha_prometida}}\n\nAdjuntamos la orden en PDF. Por favor confirmanos recepción, precio y plazo. ¡Gracias!',
   '{{numero}}, {{detalle}}, {{total}}, {{fecha_prometida}}')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('20260921000001_compras_etapa1.sql')
ON CONFLICT DO NOTHING;
