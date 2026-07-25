-- Tercer tipo de ítem en presupuestos: "servicio" (reparación, mantenimiento,
-- cambio de piezas de aberturas o accesorios) — junto a estándar y a medida.
-- Surge típicamente de un relevamiento (visita técnica).

CREATE TABLE catalogo_servicios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  precio_base  NUMERIC(12,2),
  orden        INT NOT NULL DEFAULT 0,
  activo       BOOLEAN NOT NULL DEFAULT true
);

-- tipo_item deja de inferirse (por producto_id / medida_ancho-alto) y pasa a ser explícito:
-- un servicio no tiene producto ni medidas, lo que antes lo hacía indistinguible de un
-- ítem "a medida" sin completar.
ALTER TABLE operacion_items
  ADD COLUMN IF NOT EXISTS tipo_item  TEXT NOT NULL DEFAULT 'estandar'
    CHECK (tipo_item IN ('estandar','a_medida','servicio')),
  ADD COLUMN IF NOT EXISTS servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL;

-- Backfill de filas existentes según la regla que usaba el frontend hasta ahora.
UPDATE operacion_items SET tipo_item = CASE
  WHEN producto_id IS NOT NULL THEN 'estandar'
  WHEN medida_ancho IS NOT NULL OR medida_alto IS NOT NULL THEN 'a_medida'
  ELSE 'estandar'
END;

-- Visita técnica: cada ítem relevado se marca como abertura a medir o servicio a realizar,
-- para que "avanzar a presupuesto" arme el ítem con el tipo correcto.
ALTER TABLE visita_tecnica_items
  ADD COLUMN IF NOT EXISTS tipo_item TEXT NOT NULL DEFAULT 'a_medida'
    CHECK (tipo_item IN ('a_medida','servicio'));

INSERT INTO schema_migrations (filename) VALUES ('20260724000001_servicios.sql') ON CONFLICT DO NOTHING;
