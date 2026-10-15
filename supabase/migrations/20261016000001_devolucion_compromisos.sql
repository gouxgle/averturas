-- Una devolución que deja la operación sin deuda cierra sus compromisos de pago pendientes (ya no hay
-- nada que cobrar). Se anota cuáles cerró para poder reabrirlos si la devolución se anula: sin esto
-- quedarían "cobrados" aunque el cliente vuelva a deber (como pasa al anular un recibo).
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS compromisos_cerrados UUID[] NOT NULL DEFAULT '{}';

INSERT INTO schema_migrations (filename) VALUES ('20261016000001_devolucion_compromisos.sql') ON CONFLICT DO NOTHING;
