-- La migración anterior (catalogo_productos_material) backfillió `material` solo por
-- heurística (atributos.linea/estructura) y dejó afuera los productos sin ninguna de
-- esas dos señales — en local, la mosquitera y las puertas placa quedaron en NULL.
-- Dato de negocio confirmado por el usuario: TODO el catálogo cargado hasta hoy es
-- Aluminio — recién de acá en adelante se van a cargar productos de otros materiales
-- (PVC, Acero, etc.) usando el selector nuevo de NuevoProducto.tsx. No hace falta
-- heurística: lo que siga en NULL es, sin excepción, Aluminio.
UPDATE catalogo_productos SET material = 'Aluminio' WHERE material IS NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260904000004_catalogo_productos_material_backfill_aluminio.sql') ON CONFLICT DO NOTHING;
