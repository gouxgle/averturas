-- Facturación electrónica ARCA — etapa F2: comprobantes.
-- Cada comprobante guarda TODO lo necesario para reconstruirlo sin depender de datos vivos:
-- emisor y receptor copiados al emitir, ítems, desglose de IVA, request/response de ARCA y
-- un hash del contenido fiscal. Una vez autorizado, los campos fiscales no se pueden tocar.

CREATE TABLE IF NOT EXISTS comprobantes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estado                    TEXT NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador', 'emitiendo', 'autorizado', 'rechazado', 'incierto')),
  modo                      TEXT NOT NULL DEFAULT 'CAE' CHECK (modo IN ('CAE', 'CAEA')),
  ambiente                  TEXT NOT NULL CHECK (ambiente IN ('homologacion', 'produccion')),
  tipo_doc                  TEXT NOT NULL CHECK (tipo_doc IN ('factura', 'nota_debito', 'nota_credito')),
  clase                     CHAR(1) NOT NULL CHECK (clase IN ('A', 'B')),
  cbte_tipo                 INT NOT NULL,
  punto_venta               INT NOT NULL,
  numero                    BIGINT,                     -- NULL hasta que se asigna al emitir
  fecha                     DATE NOT NULL,
  concepto                  SMALLINT NOT NULL CHECK (concepto IN (1, 2, 3)),
  fch_serv_desde            DATE,
  fch_serv_hasta            DATE,
  fch_vto_pago              DATE,

  -- Receptor, copiado al crear (no se relee del cliente: el comprobante es autocontenido)
  cliente_id                UUID REFERENCES clientes(id) ON DELETE SET NULL,
  receptor_doc_tipo         INT NOT NULL,
  receptor_doc_nro          TEXT NOT NULL,
  receptor_nombre           TEXT NOT NULL,
  receptor_domicilio        TEXT,
  receptor_condicion_iva_id INT NOT NULL,

  -- Origen (F4) y comprobante asociado (notas de crédito / débito)
  origen                    TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'operacion', 'recibo')),
  operacion_id              UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  recibo_id                 UUID REFERENCES recibos(id) ON DELETE SET NULL,
  comprobante_asociado_id   UUID REFERENCES comprobantes(id),

  moneda                    TEXT NOT NULL DEFAULT 'PES',
  cotizacion                NUMERIC(14,6) NOT NULL DEFAULT 1,
  imp_neto                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  imp_iva                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  imp_op_ex                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  imp_tot_conc              NUMERIC(14,2) NOT NULL DEFAULT 0,
  imp_trib                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  imp_total                 NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Autorización
  cae                       TEXT,
  cae_vto                   DATE,
  emisor                    JSONB,                      -- snapshot de fiscal_config al emitir
  observaciones             JSONB,                      -- observaciones de ARCA (aprobado con obs.)
  errores                   JSONB,                      -- motivos del último rechazo / falla
  qr_url                    TEXT,
  request_json              JSONB,
  response_json             JSONB,
  hash_fiscal               TEXT,
  intentos                  INT NOT NULL DEFAULT 0,
  emitiendo_desde           TIMESTAMPTZ,
  emitido_at                TIMESTAMPTZ,
  notas                     TEXT,                       -- internas, no van al comprobante

  created_by                UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comprobantes_numero_unico UNIQUE (ambiente, punto_venta, cbte_tipo, numero),
  CONSTRAINT comprobantes_autorizado_completo CHECK (
    estado <> 'autorizado' OR (numero IS NOT NULL AND cae IS NOT NULL AND cae_vto IS NOT NULL AND hash_fiscal IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha     ON comprobantes (fecha DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comprobantes_cliente   ON comprobantes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_operacion ON comprobantes (operacion_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_recibo    ON comprobantes (recibo_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_pendientes
  ON comprobantes (estado) WHERE estado IN ('emitiendo', 'incierto');
CREATE TRIGGER trg_comprobantes_updated BEFORE UPDATE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS comprobante_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_id     UUID NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
  orden              INT NOT NULL,
  descripcion        TEXT NOT NULL,
  cantidad           NUMERIC(12,3) NOT NULL,
  unidad             TEXT NOT NULL DEFAULT 'u',
  precio_unitario    NUMERIC(14,2) NOT NULL,     -- final, con IVA incluido
  bonificacion       NUMERIC(14,2) NOT NULL DEFAULT 0,
  alicuota           NUMERIC(5,2) NOT NULL,
  alicuota_id        INT,                        -- NULL = exento
  exento             BOOLEAN NOT NULL DEFAULT false,
  es_servicio        BOOLEAN NOT NULL DEFAULT false,
  neto               NUMERIC(14,2) NOT NULL,
  iva                NUMERIC(14,2) NOT NULL,
  total              NUMERIC(14,2) NOT NULL,
  producto_id        UUID REFERENCES catalogo_productos(id) ON DELETE SET NULL,
  operacion_item_id  UUID REFERENCES operacion_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_comprobante_items_cbte ON comprobante_items (comprobante_id, orden);

CREATE TABLE IF NOT EXISTS comprobante_iva (
  comprobante_id  UUID NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
  alicuota_id     INT NOT NULL,
  alicuota        NUMERIC(5,2) NOT NULL,
  base_imp        NUMERIC(14,2) NOT NULL,
  importe         NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (comprobante_id, alicuota_id)
);

ALTER TABLE fiscal_eventos
  ADD CONSTRAINT fiscal_eventos_comprobante_fk
  FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE SET NULL;

-- ── Inmutabilidad ────────────────────────────────────────────────────────────
-- Un comprobante autorizado por ARCA ya es un documento fiscal: no se modifica ni se borra
-- (se corrige con una nota de crédito). Solo pueden cambiar campos internos.
CREATE OR REPLACE FUNCTION comprobantes_proteger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado IN ('autorizado', 'emitiendo', 'incierto') OR OLD.numero IS NOT NULL THEN
      RAISE EXCEPTION 'El comprobante % no se puede borrar (ya fue enviado a ARCA)', OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.estado = 'autorizado' THEN
    IF (NEW.estado, NEW.cbte_tipo, NEW.punto_venta, NEW.numero, NEW.fecha, NEW.concepto,
        NEW.receptor_doc_tipo, NEW.receptor_doc_nro, NEW.receptor_nombre, NEW.receptor_condicion_iva_id,
        NEW.imp_neto, NEW.imp_iva, NEW.imp_op_ex, NEW.imp_tot_conc, NEW.imp_trib, NEW.imp_total,
        NEW.cae, NEW.cae_vto, NEW.emisor, NEW.hash_fiscal, NEW.request_json, NEW.response_json, NEW.ambiente)
       IS DISTINCT FROM
       (OLD.estado, OLD.cbte_tipo, OLD.punto_venta, OLD.numero, OLD.fecha, OLD.concepto,
        OLD.receptor_doc_tipo, OLD.receptor_doc_nro, OLD.receptor_nombre, OLD.receptor_condicion_iva_id,
        OLD.imp_neto, OLD.imp_iva, OLD.imp_op_ex, OLD.imp_tot_conc, OLD.imp_trib, OLD.imp_total,
        OLD.cae, OLD.cae_vto, OLD.emisor, OLD.hash_fiscal, OLD.request_json, OLD.response_json, OLD.ambiente) THEN
      RAISE EXCEPTION 'El comprobante % está autorizado por ARCA: sus datos fiscales no se pueden modificar', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comprobantes_proteger BEFORE UPDATE OR DELETE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION comprobantes_proteger();

-- Ítems e IVA de un comprobante autorizado tampoco se tocan.
CREATE OR REPLACE FUNCTION comprobante_detalle_proteger() RETURNS trigger AS $$
DECLARE
  v_cbte UUID := COALESCE(NEW.comprobante_id, OLD.comprobante_id);
BEGIN
  IF EXISTS (SELECT 1 FROM comprobantes WHERE id = v_cbte AND (estado <> 'borrador' AND estado <> 'rechazado')) THEN
    RAISE EXCEPTION 'El detalle del comprobante % no se puede modificar (ya fue enviado a ARCA)', v_cbte;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comprobante_items_proteger BEFORE INSERT OR UPDATE OR DELETE ON comprobante_items
  FOR EACH ROW EXECUTE FUNCTION comprobante_detalle_proteger();
CREATE TRIGGER trg_comprobante_iva_proteger BEFORE INSERT OR UPDATE OR DELETE ON comprobante_iva
  FOR EACH ROW EXECUTE FUNCTION comprobante_detalle_proteger();

INSERT INTO schema_migrations (filename) VALUES ('20261001000001_facturacion_comprobantes.sql') ON CONFLICT DO NOTHING;
