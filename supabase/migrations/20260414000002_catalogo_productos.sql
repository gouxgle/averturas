-- =====================================================
-- Catálogo de productos
-- =====================================================

CREATE TABLE IF NOT EXISTS catalogo_productos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  tipo             tipo_operacion NOT NULL DEFAULT 'estandar',
  tipo_abertura_id UUID REFERENCES tipos_abertura(id) ON DELETE SET NULL,
  sistema_id       UUID REFERENCES sistemas(id) ON DELETE SET NULL,
  -- Medidas fijas (principalmente para estándar)
  ancho            NUMERIC(8,2),
  alto             NUMERIC(8,2),
  -- Precios base
  costo_base       NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_base      NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Precio por m² (útil para a_medida)
  precio_por_m2    BOOLEAN NOT NULL DEFAULT false,
  activo           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_catalogo
  BEFORE UPDATE ON catalogo_productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE catalogo_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_catalogo" ON catalogo_productos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_vendedor_write_catalogo" ON catalogo_productos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'vendedor')
        AND activo = true
    )
  );
