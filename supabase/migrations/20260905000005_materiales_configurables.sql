-- "Material" (Aluminio/Acero/PVC/...) pasa a ser una lista configurable desde
-- Configuración, igual que colores / tipos_abertura. Hasta hoy estaba hardcodeada
-- en NuevoProducto.tsx (const MATERIAL_FIJOS). La columna catalogo_productos.material
-- sigue siendo texto libre (la consume la búsqueda en cascada) — esta tabla solo
-- alimenta el desplegable al cargar o editar un producto.
CREATE TABLE IF NOT EXISTS materiales (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden  INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- Sin duplicados por nombre (case-insensitive) — el alta valida contra esto.
CREATE UNIQUE INDEX IF NOT EXISTS materiales_nombre_lower_uniq ON materiales (lower(nombre));

-- Semilla: las 3 gamas que ya manejaba el negocio.
INSERT INTO materiales (nombre, orden) VALUES
  ('Aluminio', 1),
  ('Acero', 2),
  ('PVC', 3)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('20260905000005_materiales_configurables.sql') ON CONFLICT DO NOTHING;
