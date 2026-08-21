-- Motivo de anulación de un recibo: se pide al anular (dropdown + opción "otro" a mano)
-- y se muestra en el detalle del recibo.

ALTER TABLE recibos ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

INSERT INTO schema_migrations (filename)
VALUES ('20260821000002_recibos_motivo_anulacion.sql') ON CONFLICT DO NOTHING;
