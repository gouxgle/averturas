-- Facturación electrónica ARCA — etapa F1: configuración fiscal, conexión y registro.
-- Plan: ~/.claude/plans/con-respecto-a-la-fancy-gosling.md. La facturación nace APAGADA
-- (habilitada=false) y se prende recién en la puesta en marcha (F9), con los datos reales.

-- ── Configuración fiscal del emisor (una sola fila) ─────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_config (
  id                   INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  habilitada           BOOLEAN NOT NULL DEFAULT false,
  ambiente             TEXT NOT NULL DEFAULT 'homologacion'
                         CHECK (ambiente IN ('homologacion', 'produccion')),
  cuit                 TEXT,          -- 11 dígitos, sin guiones
  razon_social         TEXT,
  condicion_iva        TEXT NOT NULL DEFAULT 'responsable_inscripto',
  iibb                 TEXT,          -- número de Ingresos Brutos o "Convenio multilateral"
  inicio_actividades   DATE,
  domicilio_fiscal     TEXT,
  leyenda_pie          TEXT,          -- texto libre al pie del comprobante
  -- Certificado: la clave y el .crt viven en disco (secrets/arca), acá solo metadatos.
  cert_estado          TEXT NOT NULL DEFAULT 'sin_clave'
                         CHECK (cert_estado IN ('sin_clave', 'csr_generado', 'activo')),
  cert_ambiente        TEXT CHECK (cert_ambiente IN ('homologacion', 'produccion')),
  cert_subject         TEXT,
  cert_vencimiento     TIMESTAMPTZ,
  cert_huella          TEXT,          -- SHA-256 del certificado
  csr_generado_at      TIMESTAMPTZ,
  ultima_prueba_at     TIMESTAMPTZ,
  ultima_prueba_ok     BOOLEAN,
  ultima_prueba_json   JSONB,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO fiscal_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── Puntos de venta habilitados para web service ────────────────────────────
-- CAE = emisión online normal; CAEA = contingencia (RG 5852). Tienen que ser puntos de
-- venta de tipo web service, distintos del que usa "Comprobantes en línea".
CREATE TABLE IF NOT EXISTS fiscal_puntos_venta (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      INT NOT NULL CHECK (numero BETWEEN 1 AND 99998),
  modo        TEXT NOT NULL DEFAULT 'CAE' CHECK (modo IN ('CAE', 'CAEA')),
  domicilio   TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero)
);

-- ── Caché del ticket de acceso de WSAA (dura 12 h; pedir otro antes da error) ─
CREATE TABLE IF NOT EXISTS arca_tokens (
  servicio    TEXT NOT NULL,          -- wsfe, ws_sr_constancia_inscripcion
  ambiente    TEXT NOT NULL CHECK (ambiente IN ('homologacion', 'produccion')),
  cuit        TEXT NOT NULL,
  token       TEXT NOT NULL,
  sign        TEXT NOT NULL,
  generado_at TIMESTAMPTZ NOT NULL,
  expira_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (servicio, ambiente, cuit)
);

-- ── Registro de todo lo que pasa con ARCA y con los envíos ──────────────────
-- Cada llamada (XML de ida y vuelta, duración, errores), cada envío y cada falla con su
-- causa: es también el registro de contingencias que pide la RG 5852.
CREATE TABLE IF NOT EXISTS fiscal_eventos (
  id               BIGSERIAL PRIMARY KEY,
  tipo             TEXT NOT NULL,     -- arca_llamada, envio_whatsapp, envio_email, contingencia, config
  servicio         TEXT,              -- wsaa, wsfe, padron
  metodo           TEXT,              -- FECAESolicitar, loginCms, ...
  ambiente         TEXT,
  ok               BOOLEAN,
  duracion_ms      INT,
  error_codigo     TEXT,
  error_mensaje    TEXT,
  request          TEXT,
  response         TEXT,
  comprobante_id   UUID,              -- FK se agrega en F2, cuando exista la tabla
  usuario_id       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_eventos_created ON fiscal_eventos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_eventos_cbte    ON fiscal_eventos (comprobante_id);

-- ── Cola de trabajos en Postgres (sin Redis) ────────────────────────────────
-- Envíos, conciliación de comprobantes inciertos y tareas de CAEA, con reintentos.
-- (Se llama trabajos_cola porque `tareas` ya son las tareas del CRM.)
CREATE TABLE IF NOT EXISTS trabajos_cola (
  id            BIGSERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'en_curso', 'hecho', 'fallido')),
  intentos      INT NOT NULL DEFAULT 0,
  max_intentos  INT NOT NULL DEFAULT 8,
  ejecutar_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_error  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trabajos_cola_pendientes
  ON trabajos_cola (ejecutar_at) WHERE estado = 'pendiente';

INSERT INTO schema_migrations (filename) VALUES ('20260930000001_facturacion_base.sql') ON CONFLICT DO NOTHING;
