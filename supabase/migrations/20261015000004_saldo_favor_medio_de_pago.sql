-- Devoluciones etapa 2: el saldo a favor del cliente se usa como medio de pago ("Saldo a favor",
-- nombre reservado). Es plata que ya había entrado a caja cuando pagó la compra devuelta, así que
-- NO es caja: los informes lo apartan con es_saldo_favor. Un recibo pagado con saldo a favor consume
-- el libro cliente_saldo_favor_movimientos (tipo consumo_recibo) en la misma transacción.
CREATE OR REPLACE VIEW recibo_pagos_efectivos AS
SELECT rp.recibo_id, rp.forma_pago, rp.monto, rp.referencia, rp.orden,
       (rp.forma_pago = 'Saldo a favor') AS es_saldo_favor
  FROM recibo_pagos rp
UNION ALL
SELECT r.id, r.forma_pago, r.monto_total, r.referencia_pago, 0,
       (r.forma_pago = 'Saldo a favor')
  FROM recibos r
 WHERE NOT EXISTS (SELECT 1 FROM recibo_pagos p WHERE p.recibo_id = r.id);

INSERT INTO schema_migrations (filename) VALUES ('20261015000004_saldo_favor_medio_de_pago.sql') ON CONFLICT DO NOTHING;
