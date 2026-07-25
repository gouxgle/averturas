-- Árbol de categorías para navegación del catálogo (Familia → Uso → Material → Línea…)
-- Independiente de tipos_abertura/sistemas (que siguen definiendo material/sistema para
-- atributos y márgenes) — categorias es solo el eje de NAVEGACIÓN, los atributos siguen
-- siendo el eje de FILTRADO (ver buildFacets en Productos.tsx).

CREATE TABLE categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  parent_id  UUID REFERENCES categorias(id) ON DELETE CASCADE,
  orden      INT NOT NULL DEFAULT 0,
  activo     BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_categorias_parent ON categorias(parent_id);

ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nivel_comercial TEXT
    CHECK (nivel_comercial IN ('economica','estandar','premium','alta_seguridad'));

CREATE INDEX IF NOT EXISTS idx_catalogo_productos_categoria ON catalogo_productos(categoria_id);

COMMENT ON COLUMN catalogo_productos.nivel_comercial IS
  'Etiqueta comercial cara al cliente (Económica/Estándar/Premium/Alta seguridad) — NO reemplaza margen_tipo (bajo/medio/alto), que es interno (% de descuento en promo). Independiente del material/tipo_abertura.';

-- Semilla no destructiva: un nodo de categoría (nivel Familia) por cada tipo_abertura
-- existente, mismo nombre — así el árbol arranca poblado y nada desaparece de la
-- navegación. Sub-niveles (Uso/Material/Línea) se cargan a mano en Configuración.
INSERT INTO categorias (nombre, orden)
SELECT nombre, orden FROM tipos_abertura
ON CONFLICT DO NOTHING;

-- Backfill: cada producto existente apunta a la categoría (Familia) recién creada con
-- el mismo nombre que su tipo_abertura actual — así ningún producto queda "sin
-- categoría" al activar la navegación por árbol.
UPDATE catalogo_productos cp
SET categoria_id = cat.id
FROM tipos_abertura ta
JOIN categorias cat ON cat.nombre = ta.nombre AND cat.parent_id IS NULL
WHERE cp.tipo_abertura_id = ta.id AND cp.categoria_id IS NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260725000001_categorias_jerarquicas.sql')
  ON CONFLICT DO NOTHING;
