-- La búsqueda del catálogo necesita "Material" (Aluminio/PVC/Acero/...) como primer
-- filtro, pero hoy no existe como campo propio y confiable: lo más cercano es
-- sistemas.material (vía sistema_id, casi sin usar — 2 de 8 productos reales en local)
-- y atributos.linea/estructura (texto libre cargado desde NuevoProducto.tsx, pero no
-- todas las familias lo piden). Se promueve a columna real en catalogo_productos,
-- igual que color/nivel_comercial — mismo patrón ya establecido en esta tabla.
ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS material TEXT;

COMMENT ON COLUMN catalogo_productos.material IS
  'Material principal del producto (Aluminio/PVC/Acero/Chapa/Madera/MDF/otro texto libre). '
  'Primer filtro de la búsqueda en cascada Material → Familia → Tipología → Medida.';

-- Backfill best-effort para productos ya cargados: solo donde el dato es inequívoco.
-- Lo que quede en NULL sigue funcionando (el filtro por Material es opcional, no
-- bloqueante) hasta que se edite el producto y se cargue a mano.
UPDATE catalogo_productos
SET material = 'Aluminio'
WHERE material IS NULL
  AND (atributos->>'linea' IS NOT NULL AND atributos->>'linea' <> ''
       OR atributos->>'estructura' = 'aluminio_completo');

UPDATE catalogo_productos
SET material = 'PVC'
WHERE material IS NULL AND atributos->>'estructura' = 'pvc';

INSERT INTO schema_migrations (filename) VALUES ('20260904000002_catalogo_productos_material.sql') ON CONFLICT DO NOTHING;
