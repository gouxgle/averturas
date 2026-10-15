-- Devoluciones de clientes (etapa 1): comprobante DEV-, sus ítems, y el libro de saldo a favor.
-- Principio: no se modifica nada de lo existente. El remito, el recibo y la operación quedan
-- intactos; la devolución es un comprobante nuevo con sus propios movimientos de stock y de
-- saldo a favor.

-- Stock: tipo nuevo para lo que vuelve de un cliente. 'devolucion' (histórico) se usa con tres
-- sentidos distintos (cancelar remito +, cancelar OC -, egreso manual -): no se toca.
ALTER TABLE stock_movimientos DROP CONSTRAINT IF EXISTS stock_movimientos_tipo_check;
ALTER TABLE stock_movimientos ADD CONSTRAINT stock_movimientos_tipo_check
  CHECK (tipo IN ('ingreso','egreso_remito','egreso_retiro','devolucion','ajuste','reserva','devolucion_cliente'));

CREATE TABLE devoluciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL UNIQUE,                       -- DEV-YYYYMM-NNNN
  cliente_id       UUID NOT NULL REFERENCES clientes(id),
  operacion_id     UUID REFERENCES operaciones(id),
  remito_id        UUID REFERENCES remitos(id),                -- remito desde el que se inició (puede haber ítems de varios)
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo           TEXT NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'emitida' CHECK (estado IN ('emitida','anulada')),
  -- Cómo se reparte lo devuelto: baja la deuda de la operación, vuelve en dinero o queda a favor.
  valor_total      NUMERIC(14,2) NOT NULL CHECK (valor_total >= 0),
  aplicado_a_saldo NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (aplicado_a_saldo >= 0),
  reintegro_monto  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (reintegro_monto >= 0),
  credito_monto    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credito_monto >= 0),
  CONSTRAINT devolucion_reparto_cierra
    CHECK (abs(valor_total - (aplicado_a_saldo + reintegro_monto + credito_monto)) < 0.005),
  operacion_cambio_id UUID REFERENCES operaciones(id),         -- etapa 4: la venta nueva de un cambio
  requiere_nc      BOOLEAN NOT NULL DEFAULT false,             -- había ítems facturados: falta la nota de crédito
  nc_comprobante_id UUID REFERENCES comprobantes(id) ON DELETE SET NULL,
  anulada_motivo   TEXT,
  anulada_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  anulada_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devoluciones_cliente   ON devoluciones(cliente_id);
CREATE INDEX idx_devoluciones_operacion ON devoluciones(operacion_id);
CREATE INDEX idx_devoluciones_remito    ON devoluciones(remito_id);
CREATE INDEX idx_devoluciones_fecha     ON devoluciones(fecha DESC);

CREATE TABLE devolucion_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id         UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
  operacion_item_id     UUID REFERENCES operacion_items(id) ON DELETE SET NULL,
  remito_item_id        UUID REFERENCES remito_items(id) ON DELETE SET NULL,
  producto_id           UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  descripcion           TEXT NOT NULL,
  tipo_item             TEXT,
  cantidad              INT NOT NULL CHECK (cantidad > 0),
  precio_unitario_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_unitario    NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_unitario_neto  NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- 'stock' vuelve a estar disponible; 'no_reingresa' (falla, rotura, a medida) queda como pérdida.
  destino               TEXT NOT NULL CHECK (destino IN ('stock','no_reingresa')),
  motivo_item           TEXT,
  estado_producto       TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado_producto IN ('nuevo','bueno','con_detalles'))
);
CREATE INDEX idx_devolucion_items_dev   ON devolucion_items(devolucion_id);
CREATE INDEX idx_devolucion_items_remit ON devolucion_items(remito_item_id);
CREATE INDEX idx_devolucion_items_opit  ON devolucion_items(operacion_item_id);

-- Libro de saldo a favor del cliente (espejo de proveedor_cc_movimientos): monto positivo = a favor
-- del cliente, negativo = lo que usó o se le devolvió. El saldo es SUM(monto); lo escribe SOLO
-- asentarSaldoFavor() (server/src/lib/saldoFavor.ts).
CREATE TABLE cliente_saldo_favor_movimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES clientes(id),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  monto         NUMERIC(14,2) NOT NULL CHECK (monto <> 0),
  tipo          TEXT NOT NULL CHECK (tipo IN ('credito_devolucion','consumo_recibo','reintegro','ajuste','anulacion')),
  devolucion_id UUID REFERENCES devoluciones(id) ON DELETE SET NULL,
  recibo_id     UUID REFERENCES recibos(id) ON DELETE SET NULL,
  reintegro_id  UUID,                                          -- etapa 3 (tabla reintegros)
  descripcion   TEXT,
  created_by    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_csf_cliente ON cliente_saldo_favor_movimientos(cliente_id, created_at DESC);

CREATE OR REPLACE VIEW cliente_saldo_favor AS
SELECT cliente_id, COALESCE(SUM(monto), 0)::numeric AS saldo
FROM cliente_saldo_favor_movimientos
GROUP BY cliente_id;

-- operacion_cobranza (creada en la etapa 0): ahora incluye lo que las devoluciones aplicaron a la deuda.
CREATE OR REPLACE VIEW operacion_cobranza AS
SELECT
  o.id AS operacion_id,
  COALESCE(o.precio_total, 0)::numeric AS precio_total,
  COALESCE(r.cobrado, 0)::numeric      AS cobrado,
  COALESCE(r.descuentos, 0)::numeric   AS descuentos,
  COALESCE(d.aplicado, 0)::numeric     AS devuelto_a_saldo,
  (COALESCE(o.precio_total, 0) - COALESCE(r.cobrado, 0) - COALESCE(r.descuentos, 0) - COALESCE(d.aplicado, 0))::numeric AS saldo
FROM operaciones o
LEFT JOIN LATERAL (
  SELECT SUM(monto_total) AS cobrado, SUM(monto_descuento) AS descuentos
  FROM recibos
  WHERE operacion_id = o.id AND estado = 'emitido'
) r ON true
LEFT JOIN LATERAL (
  SELECT SUM(aplicado_a_saldo) AS aplicado
  FROM devoluciones
  WHERE operacion_id = o.id AND estado = 'emitida'
) d ON true;

INSERT INTO schema_migrations (filename) VALUES ('20261015000003_devoluciones.sql') ON CONFLICT DO NOTHING;
