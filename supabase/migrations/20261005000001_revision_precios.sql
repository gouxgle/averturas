-- Revisión integral de precios: historial de cada cambio de precio/costo/validez, inflación
-- mensual (IPC INDEC, de referencia) y parámetros del análisis.

CREATE TABLE IF NOT EXISTS producto_precio_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id     UUID NOT NULL REFERENCES catalogo_productos(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('renovacion', 'cambio_precio', 'cambio_costo')),
  precio_anterior NUMERIC(12,2),
  precio_nuevo    NUMERIC(12,2),
  costo_anterior  NUMERIC(12,2),
  costo_nuevo     NUMERIC(12,2),
  dolar_blue      NUMERIC(10,2),          -- cotización (venta) del día del cambio
  criterio        TEXT,                   -- 'sugerido', 'porcentaje 8%', 'lista proveedor'…
  origen          TEXT NOT NULL,          -- 'revision', 'lista_proveedor', 'ficha'
  detalle         TEXT,                   -- "Lista de Alumar del 02/10"
  usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_precio_historial_producto ON producto_precio_historial (producto_id, created_at DESC);

-- Inflación mensual (variación % del IPC), cargada de api.argentinadatos.com
CREATE TABLE IF NOT EXISTS indice_ipc (
  mes        DATE PRIMARY KEY,          -- último día del mes, como lo publica la fuente
  variacion  NUMERIC(6,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parámetros del análisis (una sola fila)
CREATE TABLE IF NOT EXISTS precios_config (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  umbral_pct    NUMERIC(5,2) NOT NULL DEFAULT 3,    -- variación mínima para sugerir actualizar
  dias_al_dia   INT NOT NULL DEFAULT 7,             -- semáforo verde
  dias_vencido  INT NOT NULL DEFAULT 10,            -- semáforo rojo
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO precios_config (id) VALUES (1) ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('20261005000001_revision_precios.sql') ON CONFLICT DO NOTHING;
