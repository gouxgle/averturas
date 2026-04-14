-- ============================================================
-- AVERTURAS - Schema inicial v1.0
-- Diseñado para: gestión interna + CRM + tienda online futura
-- ============================================================

-- ============================================================
-- TIPOS ENUM
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'consulta');
CREATE TYPE public.tipo_operacion AS ENUM ('estandar', 'a_medida_proveedor', 'fabricacion_propia');
CREATE TYPE public.estado_operacion AS ENUM (
  'presupuesto', 'enviado', 'aprobado', 'en_produccion',
  'listo', 'instalado', 'entregado', 'cancelado'
);
CREATE TYPE public.tipo_interaccion AS ENUM (
  'llamada', 'visita', 'whatsapp', 'email', 'presupuesto', 'venta', 'nota'
);

-- ============================================================
-- AUTH & USUARIOS
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  apellido      TEXT,
  email         TEXT,
  role          app_role NOT NULL DEFAULT 'vendedor',
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONFIGURACIÓN
-- ============================================================
CREATE TABLE public.empresa (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL DEFAULT 'Mi Empresa',
  telefono      TEXT,
  email         TEXT,
  direccion     TEXT,
  cuit          TEXT,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CATÁLOGO BASE
-- ============================================================
CREATE TABLE public.proveedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  contacto      TEXT,
  telefono      TEXT,
  email         TEXT,
  notas         TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tipos_abertura (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,            -- ventana, puerta, mampara, portón, etc.
  descripcion   TEXT,
  icono         TEXT,                     -- nombre del ícono lucide
  orden         INTEGER DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.sistemas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,            -- Herrero, Módena, A30, etc.
  material      TEXT,                     -- aluminio, PVC, madera, hierro
  proveedor_id  UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  descripcion   TEXT,
  -- para tienda online
  publicado_web BOOLEAN NOT NULL DEFAULT false,
  foto_url      TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.colores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  codigo_hex    TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- CRM / CLIENTES
-- ============================================================
CREATE TABLE public.categorias_cliente (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  color         TEXT NOT NULL DEFAULT '#6B7280',  -- tailwind gray-500
  orden         INTEGER DEFAULT 0
);

CREATE TABLE public.clientes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                    TEXT NOT NULL,
  apellido                  TEXT,
  razon_social              TEXT,
  telefono                  TEXT,
  email                     TEXT,
  direccion                 TEXT,
  localidad                 TEXT,
  categoria_id              UUID REFERENCES public.categorias_cliente(id) ON DELETE SET NULL,
  notas                     TEXT,
  -- CRM automático (actualizado por triggers)
  ultima_interaccion        TIMESTAMPTZ,
  valor_total_historico     NUMERIC(12,2) NOT NULL DEFAULT 0,
  operaciones_count         INTEGER NOT NULL DEFAULT 0,
  -- control
  activo                    BOOLEAN NOT NULL DEFAULT true,
  created_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.interacciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo          tipo_interaccion NOT NULL DEFAULT 'nota',
  descripcion   TEXT NOT NULL,
  usuario_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.recordatorios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  operacion_id  UUID,                     -- FK se agrega después
  titulo        TEXT NOT NULL,
  fecha         TIMESTAMPTZ NOT NULL,
  completado    BOOLEAN NOT NULL DEFAULT false,
  usuario_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OPERACIONES (núcleo del sistema)
-- ============================================================
CREATE SEQUENCE public.operaciones_numero_seq START WITH 1;

CREATE TABLE public.operaciones (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                    TEXT NOT NULL UNIQUE DEFAULT ('OP-' || LPAD(nextval('operaciones_numero_seq')::TEXT, 5, '0')),
  tipo                      tipo_operacion NOT NULL,
  estado                    estado_operacion NOT NULL DEFAULT 'presupuesto',
  -- relaciones
  cliente_id                UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vendedor_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  proveedor_id              UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  -- económico (calculado de los items)
  costo_total               NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_total              NUMERIC(12,2) NOT NULL DEFAULT 0,
  margen                    NUMERIC(5,2) GENERATED ALWAYS AS (
                              CASE WHEN precio_total > 0
                              THEN ROUND(((precio_total - costo_total) / precio_total * 100)::NUMERIC, 2)
                              ELSE 0 END
                            ) STORED,
  -- logística
  incluye_instalacion       BOOLEAN NOT NULL DEFAULT false,
  fecha_validez             DATE,
  fecha_entrega_estimada    DATE,
  -- notas
  notas                     TEXT,           -- visibles para el cliente
  notas_internas            TEXT,           -- solo internas
  -- control
  created_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.operacion_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id        UUID NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tipo_abertura_id    UUID REFERENCES public.tipos_abertura(id) ON DELETE SET NULL,
  sistema_id          UUID REFERENCES public.sistemas(id) ON DELETE SET NULL,
  color_id            UUID REFERENCES public.colores(id) ON DELETE SET NULL,
  descripcion         TEXT NOT NULL,
  -- medidas (para a_medida)
  medida_ancho        NUMERIC(6,2),        -- en cm
  medida_alto         NUMERIC(6,2),        -- en cm
  -- cantidades y precios
  cantidad            INTEGER NOT NULL DEFAULT 1,
  costo_unitario      NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_unitario     NUMERIC(10,2) NOT NULL DEFAULT 0,
  incluye_instalacion BOOLEAN NOT NULL DEFAULT false,
  costo_instalacion   NUMERIC(10,2) DEFAULT 0,
  precio_instalacion  NUMERIC(10,2) DEFAULT 0,
  notas               TEXT,
  orden               INTEGER DEFAULT 0
);

-- Historial de estados (trazabilidad CRM)
CREATE TABLE public.estados_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id    UUID NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,
  estado_anterior estado_operacion,
  estado_nuevo    estado_operacion NOT NULL,
  notas           TEXT,
  usuario_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK diferida para recordatorios -> operaciones
ALTER TABLE public.recordatorios
  ADD CONSTRAINT recordatorios_operacion_id_fkey
  FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE SET NULL;

-- ============================================================
-- STOCK
-- ============================================================
CREATE TABLE public.stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_abertura_id  UUID REFERENCES public.tipos_abertura(id) ON DELETE SET NULL,
  sistema_id        UUID REFERENCES public.sistemas(id) ON DELETE SET NULL,
  color_id          UUID REFERENCES public.colores(id) ON DELETE SET NULL,
  descripcion       TEXT NOT NULL,
  cantidad          INTEGER NOT NULL DEFAULT 0,
  cantidad_minima   INTEGER NOT NULL DEFAULT 0,   -- alerta de bajo stock
  costo_unitario    NUMERIC(10,2) DEFAULT 0,
  precio_unitario   NUMERIC(10,2) DEFAULT 0,
  -- para tienda online
  publicado_web     BOOLEAN NOT NULL DEFAULT false,
  foto_url          TEXT,
  descripcion_web   TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.movimientos_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id      UUID NOT NULL REFERENCES public.stock(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad      INTEGER NOT NULL,
  motivo        TEXT,
  operacion_id  UUID REFERENCES public.operaciones(id) ON DELETE SET NULL,
  usuario_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TIENDA ONLINE (estructura preparada, población posterior)
-- ============================================================
CREATE TABLE public.pedidos_web (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,
  nombre_cliente  TEXT NOT NULL,
  email_cliente   TEXT NOT NULL,
  telefono        TEXT,
  mensaje         TEXT,
  estado          TEXT NOT NULL DEFAULT 'nuevo',  -- nuevo, contactado, convertido
  -- cuando se convierte en operación interna
  operacion_id    UUID REFERENCES public.operaciones(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_operaciones_cliente ON public.operaciones(cliente_id);
CREATE INDEX idx_operaciones_estado ON public.operaciones(estado);
CREATE INDEX idx_operaciones_tipo ON public.operaciones(tipo);
CREATE INDEX idx_operaciones_created ON public.operaciones(created_at DESC);
CREATE INDEX idx_operacion_items_operacion ON public.operacion_items(operacion_id);
CREATE INDEX idx_clientes_nombre ON public.clientes(nombre, apellido);
CREATE INDEX idx_interacciones_cliente ON public.interacciones(cliente_id, created_at DESC);
CREATE INDEX idx_stock_bajo ON public.stock(cantidad) WHERE cantidad <= cantidad_minima;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_operaciones_updated_at
  BEFORE UPDATE ON public.operaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recalcular totales de operación cuando cambian los items
CREATE OR REPLACE FUNCTION public.recalcular_totales_operacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_op_id UUID;
BEGIN
  v_op_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
  UPDATE public.operaciones SET
    costo_total = (
      SELECT COALESCE(SUM((costo_unitario + COALESCE(costo_instalacion,0)) * cantidad), 0)
      FROM public.operacion_items WHERE operacion_id = v_op_id
    ),
    precio_total = (
      SELECT COALESCE(SUM((precio_unitario + COALESCE(precio_instalacion,0)) * cantidad), 0)
      FROM public.operacion_items WHERE operacion_id = v_op_id
    )
  WHERE id = v_op_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalcular_totales
  AFTER INSERT OR UPDATE OR DELETE ON public.operacion_items
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_totales_operacion();

-- Actualizar stats CRM del cliente cuando cambia una operación
CREATE OR REPLACE FUNCTION public.actualizar_crm_cliente()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.clientes SET
    ultima_interaccion    = now(),
    valor_total_historico = (
      SELECT COALESCE(SUM(precio_total), 0)
      FROM public.operaciones
      WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id)
        AND estado NOT IN ('cancelado', 'presupuesto')
    ),
    operaciones_count = (
      SELECT COUNT(*) FROM public.operaciones
      WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id)
    )
  WHERE id = COALESCE(NEW.cliente_id, OLD.cliente_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_crm_cliente
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_crm_cliente();

-- Registrar historial de estados automáticamente
CREATE OR REPLACE FUNCTION public.registrar_cambio_estado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.estados_historial(operacion_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historial_estado
  AFTER UPDATE ON public.operaciones
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio_estado();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacion_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordatorios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estados_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_web       ENABLE ROW LEVEL SECURITY;

-- Función helper para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Usuarios autenticados pueden leer todo
CREATE POLICY "authenticated_read" ON public.clientes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.operaciones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.operacion_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.interacciones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.recordatorios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.estados_historial
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.stock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.movimientos_stock
  FOR SELECT TO authenticated USING (true);

-- Escritura para vendedor y admin
CREATE POLICY "vendedor_write" ON public.clientes
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));
CREATE POLICY "vendedor_write" ON public.operaciones
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));
CREATE POLICY "vendedor_write" ON public.operacion_items
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));
CREATE POLICY "vendedor_write" ON public.interacciones
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));
CREATE POLICY "vendedor_write" ON public.recordatorios
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));
CREATE POLICY "admin_write" ON public.stock
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));
CREATE POLICY "admin_write" ON public.movimientos_stock
  FOR ALL TO authenticated USING (public.get_user_role() IN ('admin', 'vendedor'));

-- Profiles: cada uno ve el suyo, admin ve todos
CREATE POLICY "own_profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.get_user_role() = 'admin');
CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.get_user_role() = 'admin');

-- Pedidos web: lectura pública (para la tienda), escritura pública (para que pidan)
CREATE POLICY "public_read_pedidos" ON public.pedidos_web
  FOR SELECT USING (true);
CREATE POLICY "public_insert_pedidos" ON public.pedidos_web
  FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_manage_pedidos" ON public.pedidos_web
  FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Stock publicado: lectura pública para tienda online
CREATE POLICY "public_read_stock_web" ON public.stock
  FOR SELECT USING (publicado_web = true);

-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT INTO public.categorias_cliente (nombre, descripcion, color, orden) VALUES
  ('Particular',    'Cliente individual',                    '#3B82F6', 1),
  ('Empresa',       'Empresa o comercio',                    '#8B5CF6', 2),
  ('Constructor',   'Constructor / empresa constructora',    '#F59E0B', 3),
  ('Inmobiliaria',  'Empresa inmobiliaria',                  '#10B981', 4),
  ('Arquitecto',    'Arquitecto o estudio',                  '#EC4899', 5);

INSERT INTO public.tipos_abertura (nombre, icono, orden) VALUES
  ('Ventana',     'square',       1),
  ('Puerta',      'door-open',    2),
  ('Portón',      'gate',         3),
  ('Mampara',     'layout',       4),
  ('Celosía',     'grid',         5),
  ('Persiana',    'align-justify',6),
  ('Mosquitero',  'filter',       7);

INSERT INTO public.colores (nombre, codigo_hex) VALUES
  ('Natural',         '#D4C5A9'),
  ('Blanco',          '#FFFFFF'),
  ('Negro',           '#1F2937'),
  ('Bronce',          '#8B6914'),
  ('Champagne',       '#F5E6CC'),
  ('Gris oscuro',     '#4B5563'),
  ('Marrón',          '#78350F');

INSERT INTO public.empresa (nombre) VALUES ('Mi Empresa de Aberturas');
