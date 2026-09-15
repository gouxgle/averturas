-- Publicación selectiva de productos al catálogo del sitio web público.
--
-- DEFAULT false es deliberado: publicar es opt-in explícito por producto. No se
-- puede reusar `activo` para esto — `activo` es DEFAULT true y significa "no
-- discontinuado" (107 de 110 productos lo tienen en true), así que reusarlo
-- publicaría de golpe todo el catálogo interno, proveedores incluidos.
--
-- `nombre_web` es opcional: si está vacío, la vista cae al `nombre` interno. Sirve
-- porque el nombre interno está optimizado para buscar ("Pta Vna Balcón 1,20x2,05 cm",
-- "120X100") y no siempre sirve de cara al cliente.
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS publicado_web BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nombre_web    TEXT;

COMMENT ON COLUMN catalogo_productos.publicado_web IS
  'Opt-in explícito: el producto se muestra en el catálogo público del sitio web. Ver vista catalogo_web.';
COMMENT ON COLUMN catalogo_productos.nombre_web IS
  'Título de cara al cliente en la web. Si es NULL o vacío, catalogo_web usa nombre.';

-- Índice parcial: las consultas del sitio siempre filtran por publicado_web = true,
-- y esperamos que sean una minoría de las filas.
CREATE INDEX IF NOT EXISTS idx_catalogo_publicado_web
  ON catalogo_productos (publicado_web) WHERE publicado_web;

INSERT INTO schema_migrations (filename)
VALUES ('20260915000005_catalogo_publicado_web.sql') ON CONFLICT DO NOTHING;
