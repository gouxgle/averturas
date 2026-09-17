-- Un recibo puede tener varios comprobantes de pago: con medios combinados hay una
-- captura por cada transferencia/pago. `comprobante_url` queda como espejo del
-- primero (lo leen el modal de Recibos y el PDF) — mismo patrón que
-- catalogo_productos.imagenes / imagen_url.
ALTER TABLE recibos
  ADD COLUMN IF NOT EXISTS comprobantes JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE recibos
SET comprobantes = jsonb_build_array(comprobante_url)
WHERE comprobante_url IS NOT NULL AND comprobante_url <> '' AND comprobantes = '[]'::jsonb;

COMMENT ON COLUMN recibos.comprobantes IS 'Array ordenado de URLs de comprobantes de pago. comprobante_url espeja el [0].';

INSERT INTO schema_migrations (filename)
VALUES ('20260917000002_recibos_comprobantes_multiples.sql') ON CONFLICT DO NOTHING;
