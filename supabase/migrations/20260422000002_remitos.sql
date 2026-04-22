-- Módulo de remitos

CREATE TABLE IF NOT EXISTS remitos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero             TEXT UNIQUE NOT NULL,
  cliente_id         UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  operacion_id       UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  estado             TEXT NOT NULL DEFAULT 'borrador'
                       CHECK (estado IN ('borrador','emitido','entregado','cancelado')),
  medio_envio        TEXT NOT NULL DEFAULT 'retiro_local'
                       CHECK (medio_envio IN ('retiro_local','encomienda','flete_propio','flete_tercero','correo_argentino','otro')),
  transportista      TEXT,
  nro_seguimiento    TEXT,
  direccion_entrega  TEXT,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_est  DATE,
  fecha_entrega_real DATE,
  stock_descontado   BOOLEAN NOT NULL DEFAULT false,
  notas              TEXT,
  created_by         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remito_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remito_id        UUID NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
  producto_id      UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  descripcion      TEXT NOT NULL,
  cantidad         INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario  NUMERIC(12,2),
  estado_producto  TEXT NOT NULL DEFAULT 'nuevo'
                     CHECK (estado_producto IN ('nuevo','bueno','con_detalles')),
  notas_item       TEXT
);

CREATE INDEX IF NOT EXISTS idx_remitos_cliente   ON remitos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_remitos_estado    ON remitos(estado);
CREATE INDEX IF NOT EXISTS idx_remitos_created   ON remitos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ritems_remito     ON remito_items(remito_id);

INSERT INTO schema_migrations (filename) VALUES ('20260422000002_remitos.sql')
  ON CONFLICT DO NOTHING;
