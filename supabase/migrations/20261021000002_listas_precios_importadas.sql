-- Listas de precios de proveedor subidas: cada vez que se aplica una lista (archivo, planilla o %)
-- queda su cabecera y una fila por producto (valor leído, antes/después), para poder ver qué se
-- aplicó, encontrar valores raros y revertir una subida mal cargada.
CREATE TABLE IF NOT EXISTS listas_precios_importadas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id     UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  origen           TEXT NOT NULL CHECK (origen IN ('archivo', 'planilla', 'porcentaje')),
  archivo          TEXT,
  detalle          TEXT,
  filas_leidas     INT NOT NULL DEFAULT 0,
  actualizados     INT NOT NULL DEFAULT 0,
  renovados        INT NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'aplicada' CHECK (estado IN ('aplicada', 'revertida')),
  usuario_id       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revertida_at     TIMESTAMPTZ,
  revertida_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_listas_precios_prov ON listas_precios_importadas (proveedor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lista_precio_import_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id        UUID NOT NULL REFERENCES listas_precios_importadas(id) ON DELETE CASCADE,
  producto_id     UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  sku             TEXT,
  precio_leido    NUMERIC(14,2),
  accion          TEXT NOT NULL CHECK (accion IN ('actualizar', 'renovar')),
  costo_antes     NUMERIC(12,2),
  costo_despues   NUMERIC(12,2),
  precio_antes    NUMERIC(12,2),
  precio_despues  NUMERIC(12,2)
);
CREATE INDEX IF NOT EXISTS idx_lista_items_lista ON lista_precio_import_items (lista_id);
CREATE INDEX IF NOT EXISTS idx_lista_items_producto ON lista_precio_import_items (producto_id);

-- Cada cambio del historial conoce la lista que lo originó (las subidas anteriores quedan en NULL)
ALTER TABLE producto_precio_historial ADD COLUMN IF NOT EXISTS lista_id UUID REFERENCES listas_precios_importadas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_precio_historial_lista ON producto_precio_historial (lista_id) WHERE lista_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('20261021000002_listas_precios_importadas.sql') ON CONFLICT DO NOTHING;
