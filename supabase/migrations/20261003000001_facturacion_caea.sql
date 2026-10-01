-- Facturación electrónica ARCA — etapa F7: contingencia con CAEA (RG 5782/5852).
-- Desde 01/08/2026 el CAEA es solo para contingencias: se pide por quincena (hasta 5 días
-- antes o durante), se usa en un punto de venta propio cuando ARCA no da CAE, y lo emitido
-- se informa (FECAEARegInformativo) hasta 8 días después del fin de la quincena; si no se
-- usó, se informa "sin movimiento". Cada uso registra causa, fecha, hora y usuario.

CREATE TABLE IF NOT EXISTS caea_periodos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente       TEXT NOT NULL CHECK (ambiente IN ('homologacion', 'produccion')),
  cuit           TEXT NOT NULL,
  periodo        INT NOT NULL,                -- AAAAMM
  orden          SMALLINT NOT NULL CHECK (orden IN (1, 2)),
  caea           TEXT NOT NULL,
  fch_vig_desde  DATE NOT NULL,
  fch_vig_hasta  DATE NOT NULL,
  fch_tope_inf   DATE NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'cerrado', 'informado')),
  obtenido_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  respuesta      JSONB,
  UNIQUE (ambiente, cuit, periodo, orden)
);

-- Qué se informó a ARCA por cada punto de venta CAEA y quincena.
CREATE TABLE IF NOT EXISTS caea_informes (
  caea_id        UUID NOT NULL REFERENCES caea_periodos(id) ON DELETE CASCADE,
  punto_venta    INT NOT NULL,
  sin_movimiento BOOLEAN NOT NULL,
  informado_at   TIMESTAMPTZ,
  resultado      TEXT,
  error          TEXT,
  PRIMARY KEY (caea_id, punto_venta)
);

ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS caea_id            UUID REFERENCES caea_periodos(id),
  ADD COLUMN IF NOT EXISTS cbte_fch_hs_gen    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contingencia_causa TEXT,
  ADD COLUMN IF NOT EXISTS informado_at       TIMESTAMPTZ;

-- Nuevo estado: emitido con CAEA, pendiente de informar. Ya es un documento fiscal válido.
ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_estado_check;
ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_estado_check
  CHECK (estado IN ('borrador', 'emitiendo', 'autorizado', 'rechazado', 'incierto', 'contingencia'));
ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_contingencia_completo CHECK (
  estado <> 'contingencia' OR (numero IS NOT NULL AND cae IS NOT NULL AND caea_id IS NOT NULL
    AND cbte_fch_hs_gen IS NOT NULL AND hash_fiscal IS NOT NULL AND contingencia_causa IS NOT NULL)
);

-- Inmutabilidad: un comprobante en contingencia ya se entregó al cliente; solo puede pasar a
-- 'autorizado' cuando ARCA acepta el informe, sin tocar sus datos fiscales.
CREATE OR REPLACE FUNCTION comprobantes_proteger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado IN ('autorizado', 'emitiendo', 'incierto', 'contingencia') OR OLD.numero IS NOT NULL THEN
      RAISE EXCEPTION 'El comprobante % no se puede borrar (ya fue enviado a ARCA)', OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.estado IN ('autorizado', 'contingencia') THEN
    IF (CASE WHEN OLD.estado = 'contingencia' AND NEW.estado = 'autorizado' THEN OLD.estado ELSE NEW.estado END,
        NEW.cbte_tipo, NEW.punto_venta, NEW.numero, NEW.fecha, NEW.concepto,
        NEW.receptor_doc_tipo, NEW.receptor_doc_nro, NEW.receptor_nombre, NEW.receptor_condicion_iva_id,
        NEW.imp_neto, NEW.imp_iva, NEW.imp_op_ex, NEW.imp_tot_conc, NEW.imp_trib, NEW.imp_total,
        NEW.cae, NEW.cae_vto, NEW.emisor, NEW.hash_fiscal, NEW.request_json, NEW.ambiente, NEW.caea_id, NEW.cbte_fch_hs_gen)
       IS DISTINCT FROM
       (OLD.estado, OLD.cbte_tipo, OLD.punto_venta, OLD.numero, OLD.fecha, OLD.concepto,
        OLD.receptor_doc_tipo, OLD.receptor_doc_nro, OLD.receptor_nombre, OLD.receptor_condicion_iva_id,
        OLD.imp_neto, OLD.imp_iva, OLD.imp_op_ex, OLD.imp_tot_conc, OLD.imp_trib, OLD.imp_total,
        OLD.cae, OLD.cae_vto, OLD.emisor, OLD.hash_fiscal, OLD.request_json, OLD.ambiente, OLD.caea_id, OLD.cbte_fch_hs_gen) THEN
      RAISE EXCEPTION 'El comprobante % ya es un documento fiscal: sus datos no se pueden modificar', OLD.id;
    END IF;
    -- La respuesta de ARCA de un autorizado tampoco cambia.
    IF OLD.estado = 'autorizado' AND NEW.response_json IS DISTINCT FROM OLD.response_json THEN
      RAISE EXCEPTION 'El comprobante % está autorizado por ARCA: sus datos fiscales no se pueden modificar', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_migrations (filename) VALUES ('20261003000001_facturacion_caea.sql') ON CONFLICT DO NOTHING;
