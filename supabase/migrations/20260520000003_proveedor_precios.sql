CREATE TABLE proveedor_precios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL,
  descripcion  TEXT NOT NULL,
  precio       NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proveedor_id, sku)
);

CREATE INDEX ON proveedor_precios(proveedor_id);
CREATE INDEX ON proveedor_precios(proveedor_id, sku);

INSERT INTO schema_migrations (filename) VALUES ('20260520000003_proveedor_precios.sql') ON CONFLICT DO NOTHING;
