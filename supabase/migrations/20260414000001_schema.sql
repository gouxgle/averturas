-- ============================================================
-- Averturas — Schema principal (sin dependencias Supabase)
-- ============================================================

-- ENUMs
CREATE TYPE app_role        AS ENUM ('admin', 'vendedor', 'consulta');
CREATE TYPE tipo_operacion  AS ENUM ('estandar', 'a_medida_proveedor', 'fabricacion_propia');
CREATE TYPE estado_operacion AS ENUM (
  'presupuesto','enviado','aprobado','en_produccion',
  'listo','instalado','entregado','cancelado'
);

-- ── Trigger helper ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── Usuarios (reemplaza auth.users + profiles de Supabase) ──
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol           app_role NOT NULL DEFAULT 'vendedor',
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Empresa ──────────────────────────────────────────────────
CREATE TABLE empresa (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL DEFAULT 'Mi Empresa',
  cuit        TEXT,
  telefono    TEXT,
  email       TEXT,
  direccion   TEXT,
  logo_url    TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO empresa (nombre) VALUES ('Averturas');

-- ── Catálogo de referencia ───────────────────────────────────
CREATE TABLE tipos_abertura (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  icono       TEXT,
  orden       INT NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE sistemas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  material     TEXT,
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE colores (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  hex    TEXT,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- ── Proveedores ───────────────────────────────────────────────
CREATE TABLE proveedores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  contacto   TEXT,
  telefono   TEXT,
  email      TEXT,
  notas      TEXT,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_proveedores_updated BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Catálogo de productos ─────────────────────────────────────
CREATE TABLE catalogo_productos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  tipo            tipo_operacion NOT NULL,
  tipo_abertura_id UUID REFERENCES tipos_abertura(id) ON DELETE SET NULL,
  sistema_id      UUID REFERENCES sistemas(id) ON DELETE SET NULL,
  ancho           NUMERIC(8,2),
  alto            NUMERIC(8,2),
  costo_base      NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_base     NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_por_m2   BOOLEAN NOT NULL DEFAULT false,
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_catalogo_updated BEFORE UPDATE ON catalogo_productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Categorías de cliente ─────────────────────────────────────
CREATE TABLE categorias_cliente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  orden       INT NOT NULL DEFAULT 0
);

-- ── Clientes ──────────────────────────────────────────────────
CREATE TABLE clientes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                TEXT NOT NULL,
  apellido              TEXT,
  razon_social          TEXT,
  telefono              TEXT,
  email                 TEXT,
  direccion             TEXT,
  localidad             TEXT,
  categoria_id          UUID REFERENCES categorias_cliente(id) ON DELETE SET NULL,
  notas                 TEXT,
  ultima_interaccion    TIMESTAMPTZ,
  valor_total_historico NUMERIC(14,2) NOT NULL DEFAULT 0,
  operaciones_count     INT NOT NULL DEFAULT 0,
  activo                BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Interacciones / Notas CRM ─────────────────────────────────
CREATE TABLE interacciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'nota',
  descripcion TEXT NOT NULL,
  created_by  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Operaciones ───────────────────────────────────────────────
CREATE SEQUENCE operaciones_numero_seq START 1;

CREATE TABLE operaciones (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               TEXT UNIQUE NOT NULL DEFAULT 'OP-' || LPAD(nextval('operaciones_numero_seq')::TEXT, 5, '0'),
  tipo                 tipo_operacion NOT NULL,
  estado               estado_operacion NOT NULL DEFAULT 'presupuesto',
  cliente_id           UUID NOT NULL REFERENCES clientes(id),
  vendedor_id          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  proveedor_id         UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  costo_total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  margen               NUMERIC(5,2) NOT NULL DEFAULT 0,
  incluye_instalacion  BOOLEAN NOT NULL DEFAULT false,
  fecha_validez        DATE,
  fecha_entrega_estimada DATE,
  notas                TEXT,
  notas_internas       TEXT,
  created_by           UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_operaciones_updated BEFORE UPDATE ON operaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Ítems de operación ────────────────────────────────────────
CREATE TABLE operacion_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id        UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  orden               INT NOT NULL DEFAULT 0,
  tipo_abertura_id    UUID REFERENCES tipos_abertura(id) ON DELETE SET NULL,
  sistema_id          UUID REFERENCES sistemas(id) ON DELETE SET NULL,
  descripcion         TEXT NOT NULL,
  medida_ancho        NUMERIC(8,2),
  medida_alto         NUMERIC(8,2),
  cantidad            INT NOT NULL DEFAULT 1,
  costo_unitario      NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_unitario     NUMERIC(12,2) NOT NULL DEFAULT 0,
  incluye_instalacion BOOLEAN NOT NULL DEFAULT false,
  costo_instalacion   NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_instalacion  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas               TEXT
);

-- ── Historial de estados ──────────────────────────────────────
CREATE TABLE estados_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id    UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  estado_anterior estado_operacion,
  estado_nuevo    estado_operacion NOT NULL,
  notas           TEXT,
  changed_by      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Trigger: recalcular totales de operación ─────────────────
CREATE OR REPLACE FUNCTION recalcular_totales_operacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_costo  NUMERIC := 0;
  v_precio NUMERIC := 0;
  v_margen NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(SUM((costo_unitario  + CASE WHEN incluye_instalacion THEN costo_instalacion  ELSE 0 END) * cantidad), 0),
    COALESCE(SUM((precio_unitario + CASE WHEN incluye_instalacion THEN precio_instalacion ELSE 0 END) * cantidad), 0)
  INTO v_costo, v_precio
  FROM operacion_items
  WHERE operacion_id = COALESCE(NEW.operacion_id, OLD.operacion_id);

  IF v_precio > 0 THEN
    v_margen := ROUND((v_precio - v_costo) / v_precio * 100, 2);
  END IF;

  UPDATE operaciones
  SET costo_total = v_costo, precio_total = v_precio, margen = v_margen
  WHERE id = COALESCE(NEW.operacion_id, OLD.operacion_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalcular_totales
  AFTER INSERT OR UPDATE OR DELETE ON operacion_items
  FOR EACH ROW EXECUTE FUNCTION recalcular_totales_operacion();

-- ── Trigger: actualizar CRM del cliente ──────────────────────
CREATE OR REPLACE FUNCTION actualizar_crm_cliente()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  v_total NUMERIC;
  v_ultima TIMESTAMPTZ;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(precio_total), 0),
    MAX(created_at)
  INTO v_count, v_total, v_ultima
  FROM operaciones
  WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id)
    AND estado NOT IN ('cancelado');

  UPDATE clientes
  SET
    operaciones_count     = v_count,
    valor_total_historico = v_total,
    ultima_interaccion    = GREATEST(ultima_interaccion, v_ultima)
  WHERE id = COALESCE(NEW.cliente_id, OLD.cliente_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_actualizar_crm
  AFTER INSERT OR UPDATE OR DELETE ON operaciones
  FOR EACH ROW EXECUTE FUNCTION actualizar_crm_cliente();

-- ── Trigger: registrar cambio de estado ──────────────────────
CREATE OR REPLACE FUNCTION registrar_cambio_estado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO estados_historial (operacion_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registrar_estado
  AFTER UPDATE ON operaciones
  FOR EACH ROW EXECUTE FUNCTION registrar_cambio_estado();

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX idx_clientes_nombre      ON clientes(nombre);
CREATE INDEX idx_clientes_activo      ON clientes(activo);
CREATE INDEX idx_operaciones_estado   ON operaciones(estado);
CREATE INDEX idx_operaciones_cliente  ON operaciones(cliente_id);
CREATE INDEX idx_operaciones_created  ON operaciones(created_at DESC);
CREATE INDEX idx_items_operacion      ON operacion_items(operacion_id, orden);
CREATE INDEX idx_interacciones_cliente ON interacciones(cliente_id);
