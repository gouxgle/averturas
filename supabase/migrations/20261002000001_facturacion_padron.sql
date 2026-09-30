-- Facturación electrónica ARCA — etapa F3: datos fiscales de clientes y padrón de ARCA.
-- `documento_nro` sigue siendo el DNI (o el documento que se cargó); el CUIT pasa a tener
-- su propio campo porque la factura A lo exige. La condición frente al IVA reutiliza la
-- columna de texto existente `condicion_iva` (el código de ARCA se deriva en el backend).

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cuit                  TEXT,
  ADD COLUMN IF NOT EXISTS domicilio_fiscal      TEXT,
  ADD COLUMN IF NOT EXISTS padron_actualizado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS padron_json           JSONB;

CREATE INDEX IF NOT EXISTS idx_clientes_cuit ON clientes (cuit) WHERE cuit IS NOT NULL;

-- Si en documento_nro había un CUIT/CUIL (11 dígitos), se copia al campo nuevo.
UPDATE clientes
   SET cuit = regexp_replace(documento_nro, '\D', '', 'g')
 WHERE cuit IS NULL
   AND length(regexp_replace(COALESCE(documento_nro, ''), '\D', '', 'g')) = 11;

-- Caché de consultas al padrón (24 h): evita pegarle a ARCA por cada tecla y deja registro
-- de lo que ARCA informó, también para receptores que todavía no son clientes.
CREATE TABLE IF NOT EXISTS padron_cache (
  cuit          TEXT PRIMARY KEY,
  datos         JSONB NOT NULL,      -- persona normalizada
  respuesta     JSONB,               -- respuesta de ARCA tal cual
  ambiente      TEXT NOT NULL,
  consultado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (filename) VALUES ('20261002000001_facturacion_padron.sql') ON CONFLICT DO NOTHING;
