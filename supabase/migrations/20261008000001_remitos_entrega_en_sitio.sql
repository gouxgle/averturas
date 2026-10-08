-- Entrega en el lugar desde el celular (EntregaEnSitio.tsx → POST /remitos/:id/entregar):
-- además de la firma (firma_url, 20260907000001) se registra quién recibió, su DNI y la
-- hora real. La firma es opcional pero con aviso: entregar sin firma exige un motivo.
-- "Sin firma" = estado 'entregado' AND firma_url IS NULL (no hace falta otra columna).
ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS recibio_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS recibio_dni      TEXT,
  ADD COLUMN IF NOT EXISTS entregado_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sin_firma_motivo TEXT;

INSERT INTO schema_migrations (filename) VALUES ('20261008000001_remitos_entrega_en_sitio.sql') ON CONFLICT DO NOTHING;
