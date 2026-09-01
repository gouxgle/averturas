-- Color identificatorio del proveedor: al ver varios productos juntos en el
-- catálogo (o en un buscador) no había forma de saber de qué proveedor era cada
-- uno. Se guarda la CLAVE de la paleta ('violeta', 'celeste', ...), no un hex
-- libre, para que el badge tenga siempre contraste legible — la paleta vive en
-- src/lib/coloresProveedor.ts y se valida en server/src/lib/schemas.ts.
-- NULL = todavía no eligió color: el frontend deriva uno estable a partir del id,
-- así la función sirve desde el día uno sin tener que editar cada proveedor.

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN proveedores.color IS
  'Clave de la paleta de colores identificatorios (ver src/lib/coloresProveedor.ts). NULL = color derivado automáticamente del id.';

INSERT INTO schema_migrations (filename)
VALUES ('20260831000002_proveedores_color.sql') ON CONFLICT DO NOTHING;
