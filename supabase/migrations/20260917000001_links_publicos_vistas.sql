-- Señalizar cuándo el cliente abrió un link público (proforma o remito), para que el
-- vendedor sepa si ya lo vio antes de llamar. Se registra en cada GET público:
-- primera vez, última vez y cantidad de aperturas.
ALTER TABLE operacion_revisiones
  ADD COLUMN IF NOT EXISTS primera_vista_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_vista_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vistas           INT NOT NULL DEFAULT 0;

ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS link_primera_vista_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_ultima_vista_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_vistas           INT NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (filename)
VALUES ('20260917000001_links_publicos_vistas.sql') ON CONFLICT DO NOTHING;
