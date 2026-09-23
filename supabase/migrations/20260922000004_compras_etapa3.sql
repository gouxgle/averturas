-- Módulo Compras — Etapa 3: documentos, facturas, control económico, cuenta corriente,
-- pagos y cierre. Ver docs/compras-plan.md.
--
-- El cambio de fondo: `proveedores.deuda_actual` deja de ser un número que se tipea a mano y
-- pasa a derivarse de un libro mayor (`proveedor_cc_movimientos`). La columna NO se borra —
-- queda como respaldo histórico— pero ya no se escribe ni se lee para mostrar el saldo.

-- ── Carpeta digital de la OC ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_documentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN (
                'cotizacion','orden_compra','remito','factura','nota_credito','nota_debito',
                'comprobante_pago','foto_incidencia','otro')),
  url         TEXT NOT NULL,
  nombre      TEXT,
  numero      TEXT,
  fecha       DATE,
  monto       NUMERIC(14,2),
  -- id del registro que lo generó (recepción, incidencia, pago…): evita duplicar el reflejo
  origen_id   UUID,
  notas       TEXT,
  created_by  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_docs_pedido ON compras_documentos(pedido_id);
-- Un mismo adjunto no se refleja dos veces (el reflejo es idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_docs_unico ON compras_documentos(pedido_id, url);

-- ── Facturas del proveedor ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_facturas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id      UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  pedido_id         UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  numero            TEXT NOT NULL,
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal_neto     NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_monto         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total             NUMERIC(14,2) NOT NULL DEFAULT 0,
  url               TEXT,
  -- Diferencia contra el total de la OC, calculada al guardar (+ facturó de más)
  diferencia_vs_oc  NUMERIC(14,2) NOT NULL DEFAULT 0,
  diferencia_motivo TEXT CHECK (diferencia_motivo IN ('flete','aumento','iva','adicional','error','otro')),
  diferencia_obs    TEXT,
  created_by        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_compras_fact_pedido    ON compras_facturas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_compras_fact_proveedor ON compras_facturas(proveedor_id, fecha);

-- ── Pagos al proveedor ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedor_pagos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id  UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  importe       NUMERIC(14,2) NOT NULL CHECK (importe > 0),
  medio         TEXT NOT NULL DEFAULT 'transferencia' CHECK (medio IN ('transferencia','efectivo','cheque','otro')),
  nro_operacion TEXT,
  comprobantes  JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacion   TEXT,
  created_by    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prov_pagos_proveedor ON proveedor_pagos(proveedor_id, fecha);

-- Un pago puede repartirse entre varias OC; el remanente queda como saldo a favor
CREATE TABLE IF NOT EXISTS proveedor_pago_aplicaciones (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id   UUID NOT NULL REFERENCES proveedor_pagos(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  monto     NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  UNIQUE (pago_id, pedido_id)
);
CREATE INDEX IF NOT EXISTS idx_prov_pago_aplic_pedido ON proveedor_pago_aplicaciones(pedido_id);

-- ── Notas de crédito / débito ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedor_notas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id  UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  tipo          TEXT NOT NULL CHECK (tipo IN ('credito','debito')),
  pedido_id     UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  incidencia_id UUID REFERENCES compras_incidencias(id) ON DELETE SET NULL,
  numero        TEXT,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  monto         NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  url           TEXT,
  concepto      TEXT,
  created_by    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prov_notas_proveedor ON proveedor_notas(proveedor_id, fecha);

-- ── Libro mayor del proveedor ─────────────────────────────────────────────────
-- Convención: monto POSITIVO aumenta lo que le debemos; NEGATIVO lo reduce.
CREATE TABLE IF NOT EXISTS proveedor_cc_movimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id  UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('saldo_inicial','compra','debito','pago','credito','anticipo','ajuste')),
  monto         NUMERIC(14,2) NOT NULL,
  pedido_id     UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  factura_id    UUID REFERENCES compras_facturas(id) ON DELETE SET NULL,
  pago_id       UUID REFERENCES proveedor_pagos(id) ON DELETE SET NULL,
  nota_id       UUID REFERENCES proveedor_notas(id) ON DELETE SET NULL,
  incidencia_id UUID REFERENCES compras_incidencias(id) ON DELETE SET NULL,
  concepto      TEXT,
  created_by    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prov_cc_proveedor ON proveedor_cc_movimientos(proveedor_id, fecha, created_at);
CREATE INDEX IF NOT EXISTS idx_prov_cc_pedido    ON proveedor_cc_movimientos(pedido_id);

-- Saldo por proveedor: ÚNICA fuente de verdad de la deuda
CREATE OR REPLACE VIEW proveedor_saldos AS
SELECT p.id AS proveedor_id,
       COALESCE(SUM(m.monto), 0)::numeric(14,2) AS saldo
FROM proveedores p
LEFT JOIN proveedor_cc_movimientos m ON m.proveedor_id = p.id
GROUP BY p.id;

-- Migración del saldo que se venía tipeando a mano: un asiento `saldo_inicial` por
-- proveedor con deuda. Idempotente (no duplica si ya existe el asiento).
INSERT INTO proveedor_cc_movimientos (proveedor_id, fecha, tipo, monto, concepto)
SELECT p.id, CURRENT_DATE, 'saldo_inicial', p.deuda_actual, 'Saldo inicial migrado'
FROM proveedores p
WHERE p.deuda_actual <> 0
  AND NOT EXISTS (
    SELECT 1 FROM proveedor_cc_movimientos m
    WHERE m.proveedor_id = p.id AND m.tipo = 'saldo_inicial'
  );

-- ── OC: cierre total ──────────────────────────────────────────────────────────
ALTER TABLE pedidos
  -- "Control realizado": lo revisó alguien contra la factura antes de cerrar
  ADD COLUMN IF NOT EXISTS control_realizado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS control_realizado_by UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- Algunos proveedores no facturan: la compra se asienta al recibir, no al facturar
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS factura_al_recibir BOOLEAN NOT NULL DEFAULT false;

-- ── Documentos de las OC históricas ───────────────────────────────────────────
-- Refleja lo que ya existe como adjunto suelto, para que la carpeta no arranque vacía.
INSERT INTO compras_documentos (pedido_id, tipo, url, nombre, fecha, origen_id, created_by)
SELECT r.pedido_id, 'remito', adj.url,
       COALESCE('Remito ' || r.remito_proveedor_nro, 'Remito de entrega ' || r.numero_secuencia),
       r.fecha, r.id, r.created_by
FROM compras_recepciones r, LATERAL jsonb_array_elements_text(r.adjuntos) AS adj(url)
ON CONFLICT (pedido_id, url) DO NOTHING;

INSERT INTO compras_documentos (pedido_id, tipo, url, nombre, fecha, origen_id, created_by)
SELECT inc.pedido_id, 'foto_incidencia', adj.url, 'Foto ' || inc.numero, inc.created_at::date, inc.id, inc.created_by
FROM compras_incidencias inc, LATERAL jsonb_array_elements_text(inc.adjuntos) AS adj(url)
ON CONFLICT (pedido_id, url) DO NOTHING;

INSERT INTO compras_documentos (pedido_id, tipo, url, nombre, fecha, created_by)
SELECT p.id, 'otro', adj.url, 'Adjunto de la orden', p.fecha_pedido, p.created_by
FROM pedidos p, LATERAL jsonb_array_elements_text(p.adjuntos) AS adj(url)
ON CONFLICT (pedido_id, url) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('20260922000004_compras_etapa3.sql')
ON CONFLICT DO NOTHING;
