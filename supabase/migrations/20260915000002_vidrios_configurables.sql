-- "Tipo de vidrio" pasa a ser una lista configurable desde Configuración, igual
-- que Materiales/Líneas. Hasta hoy había TRES listas hardcodeadas distintas en
-- NuevoProducto.tsx (VIDRIO_TIPO para puertas, VIDRIO_TIPO_VNT para ventanas, y un
-- array inline para el campo "Vidrio" de productos a medida) con valores
-- ligeramente distintos entre sí — ya no van a existir tres fuentes de verdad.
-- Las columnas que guardan el valor elegido (catalogo_productos.vidrio, y
-- atributos->>'vidrio_tipo' en JSONB) siguen siendo texto libre — esta tabla
-- solo alimenta el desplegable/selector al cargar o editar un producto.
CREATE TABLE IF NOT EXISTS vidrios (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden  INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS vidrios_nombre_lower_uniq ON vidrios (lower(nombre));

-- Semilla: unión de las tres listas viejas, sin duplicar "Doble vidrio"/"DVH" —
-- se deja solo "DVH", que es como el negocio lo nombra en la práctica.
INSERT INTO vidrios (nombre, orden) VALUES
  ('Transparente', 1),
  ('Laminado', 2),
  ('DVH', 3),
  ('Traslúcido', 4),
  ('Sin vidrio', 5)
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('20260915000002_vidrios_configurables.sql') ON CONFLICT DO NOTHING;
