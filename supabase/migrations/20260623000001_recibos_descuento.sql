-- Agrega campos de descuento a recibos para registro contable correcto:
-- monto_lista - monto_descuento = monto_total (lo cobrado)
ALTER TABLE recibos
  ADD COLUMN descuento_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN monto_lista      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN monto_descuento  NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Registros existentes: sin descuento → precio de lista = lo cobrado
UPDATE recibos SET monto_lista = monto_total WHERE monto_lista = 0;

CREATE INDEX idx_recibos_descuento ON recibos(monto_descuento) WHERE monto_descuento > 0;

INSERT INTO schema_migrations (filename)
VALUES ('20260623000001_recibos_descuento.sql')
ON CONFLICT DO NOTHING;
