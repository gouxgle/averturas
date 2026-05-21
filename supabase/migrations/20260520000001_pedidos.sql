-- Módulo de pedidos al proveedor
-- Paso intermedio entre el recibo (cobro al cliente) y el remito (entrega al cliente)

CREATE SEQUENCE IF NOT EXISTS pedidos_numero_seq;

CREATE TABLE pedidos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT UNIQUE NOT NULL,
  proveedor_id     UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  operacion_id     UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','enviado','recibido','cancelado')),
  fecha_pedido     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_est DATE,
  fecha_recepcion  DATE,
  monto_total      NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas            TEXT,
  created_by       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pedido_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id         UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  operacion_item_id UUID REFERENCES operacion_items(id) ON DELETE SET NULL,
  producto_id       UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  descripcion       TEXT NOT NULL,
  cantidad          INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  costo_unitario    NUMERIC(12,2) NOT NULL DEFAULT 0,
  orden             INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pedidos_proveedor  ON pedidos(proveedor_id);
CREATE INDEX idx_pedidos_operacion  ON pedidos(operacion_id);
CREATE INDEX idx_pedidos_estado     ON pedidos(estado);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);

INSERT INTO schema_migrations (filename)
VALUES ('20260520000001_pedidos.sql')
ON CONFLICT DO NOTHING;
