-- Visita técnica: ítems "a medida" ahora pueden cargar las mismas specs que se piden
-- después en el presupuesto (tipo de abertura, sistema, vidrio, premarco, accesorios,
-- color, foto de cálculo/referencia) usando el mismo modal "Editar ítem" del presupuesto,
-- en vez de perder esos datos y tener que volver a preguntarlos al armar la proforma.
ALTER TABLE visita_tecnica_items
  ADD COLUMN IF NOT EXISTS tipo_abertura_id UUID REFERENCES tipos_abertura(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sistema_id       UUID REFERENCES sistemas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vidrio           TEXT,
  ADD COLUMN IF NOT EXISTS premarco         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accesorios       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS color            TEXT,
  ADD COLUMN IF NOT EXISTS calculo_url      TEXT;

INSERT INTO schema_migrations (filename) VALUES ('20260727000001_visita_tecnica_items_specs.sql')
  ON CONFLICT DO NOTHING;
