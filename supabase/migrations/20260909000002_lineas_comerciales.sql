-- Separa dos conceptos que hasta hoy se pisaban bajo la palabra "Línea":
--
--   Sistema — técnico: perfiles usados y método de construcción (Herrero, Módena, A30).
--   Línea   — marketing: agrupa productos por características comerciales.
--
-- Antes de esto: el catálogo `sistemas` se mostraba al cliente rotulado como "Línea" en
-- proformas y remitos, el atributo JSONB `linea` (herrero/modena/a30 — que es sistema
-- técnico) se llamaba "Línea" en el alta de producto, y la clasificación comercial existía
-- como `nivel_comercial` con 4 valores fijos en un CHECK.

-- ── Línea comercial: catálogo configurable desde Configuración ─────────────────
-- FK (no texto libre como `materiales`) para que renombrar una línea se propague solo a
-- todos los productos que la usan — es el caso de uso que motivó la tabla.
CREATE TABLE IF NOT EXISTS lineas (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden  INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- Sin duplicados por nombre (case-insensitive) — el alta valida contra esto.
CREATE UNIQUE INDEX IF NOT EXISTS lineas_nombre_lower_uniq ON lineas (lower(nombre));

-- Se siembran los valores del viejo nivel_comercial: la idea es reutilizarlos y
-- renombrarlos desde Configuración a las líneas reales del negocio.
INSERT INTO lineas (nombre, orden) VALUES
  ('Económica', 1),
  ('Estándar', 2),
  ('Premium', 3),
  ('Alta seguridad', 4)
ON CONFLICT DO NOTHING;

ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS linea_id UUID REFERENCES lineas(id) ON DELETE SET NULL;

COMMENT ON COLUMN catalogo_productos.linea_id IS
  'Línea comercial (marketing) — agrupa productos para venderlos como colección. NO confundir con sistema_id ni con atributos->>''sistema'', que son el sistema técnico (perfiles).';

UPDATE catalogo_productos cp SET linea_id = l.id
FROM lineas l
WHERE cp.nivel_comercial IS NOT NULL
  AND l.nombre = CASE cp.nivel_comercial
    WHEN 'economica'      THEN 'Económica'
    WHEN 'estandar'       THEN 'Estándar'
    WHEN 'premium'        THEN 'Premium'
    WHEN 'alta_seguridad' THEN 'Alta seguridad'
  END;

ALTER TABLE catalogo_productos DROP COLUMN IF EXISTS nivel_comercial;

-- ── El atributo `linea` era el sistema técnico: se renombra la clave ───────────
-- Los valores (herrero/modena/a30) son líneas de perfil de aluminio, o sea sistema.
-- Dejar la clave llamada `linea` perpetuaría la confusión que esta migración elimina.
-- Las migraciones históricas que leen atributos->>'linea' (el backfill de material)
-- corren antes en el orden cronológico, así que no se rompen.
UPDATE catalogo_productos
SET atributos = (atributos - 'linea') || jsonb_build_object('sistema', atributos->'linea')
WHERE atributos ? 'linea' AND COALESCE(atributos->>'linea', '') <> '';

-- Los que la tenían vacía pierden la clave (no se crea un `sistema` vacío).
UPDATE catalogo_productos SET atributos = atributos - 'linea' WHERE atributos ? 'linea';

INSERT INTO schema_migrations (filename) VALUES ('20260909000002_lineas_comerciales.sql') ON CONFLICT DO NOTHING;
