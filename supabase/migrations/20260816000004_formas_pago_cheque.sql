-- Nuevas alternativas de pago para presupuestos: cheques diferidos a 30/60/90 días.
-- Se cargan acá (no solo desde Configuración) para que viajen solas a test/prod
-- con el deploy, sin tener que repetir el alta a mano en cada ambiente.

INSERT INTO catalogo_formas_pago (nombre, descuento_pct, orden)
SELECT 'Cheque a 30 días', 0, COALESCE((SELECT MAX(orden) FROM catalogo_formas_pago), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM catalogo_formas_pago WHERE nombre = 'Cheque a 30 días');

INSERT INTO catalogo_formas_pago (nombre, descuento_pct, orden)
SELECT 'Cheque a 30-60 días', 0, COALESCE((SELECT MAX(orden) FROM catalogo_formas_pago), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM catalogo_formas_pago WHERE nombre = 'Cheque a 30-60 días');

INSERT INTO catalogo_formas_pago (nombre, descuento_pct, orden)
SELECT 'Cheque a 30-60-90 días', 0, COALESCE((SELECT MAX(orden) FROM catalogo_formas_pago), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM catalogo_formas_pago WHERE nombre = 'Cheque a 30-60-90 días');

INSERT INTO schema_migrations (filename)
VALUES ('20260816000004_formas_pago_cheque.sql') ON CONFLICT DO NOTHING;
