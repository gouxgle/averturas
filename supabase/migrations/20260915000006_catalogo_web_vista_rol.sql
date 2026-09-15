-- Contrato de datos del catálogo público + rol de solo lectura para el sitio web.
--
-- El sitio web (cesarbritez.com.ar) corre en otro contenedor de la misma red Docker.
-- El problema es que catalogo_productos mezcla en la misma fila datos públicos con
-- datos comercialmente críticos (costo_base, margen_venta, margen_tipo, precio_manual,
-- proveedor_id, proveedor_sku, codigo/SKU interno, stock_*). Esta vista es el ÚNICO
-- punto por el que el sitio ve la base, y expone una lista blanca de columnas.
--
-- Decisión de negocio: el catálogo web NO muestra precios (el sitio ofrece "Consultar").
-- Por eso precio_base y promocion tampoco están acá: no hacen falta, y cada columna que
-- no se expone es una que no se puede filtrar por error.
--
-- Queda deliberadamente afuera:
--   costo_base, precio_base, precio_por_m2, promocion, margen_venta, margen_tipo,
--   precio_manual, proveedor_id, proveedor_sku, codigo, stock_inicial, stock_minimo,
--   tipo (delata qué se revende vs. qué se fabrica), precio_actualizado_at,
--   disponibilidad_confirmada_at/_by, en_salon, activo.

DROP VIEW IF EXISTS catalogo_web;

CREATE VIEW catalogo_web AS
SELECT
  cp.id,
  -- Fallback al nombre interno si no se cargó un título para la web.
  COALESCE(NULLIF(btrim(cp.nombre_web), ''), cp.nombre) AS titulo,
  cp.descripcion,
  cp.caracteristica_1,
  cp.caracteristica_2,
  cp.caracteristica_3,
  cp.caracteristica_4,
  cp.material,
  cp.color,
  cp.vidrio,
  cp.premarco,
  cp.accesorios,
  cp.ancho,
  cp.alto,
  cp.imagenes,
  cp.imagen_url,
  cp.video_url,
  cp.etiqueta,
  ta.nombre  AS tipo_abertura,
  s.nombre   AS sistema,
  li.nombre  AS linea,
  cat.nombre AS categoria,
  cp.modelo_id,
  -- atributos va por lista blanca, NO entero. Es un JSONB de forma libre: si mañana
  -- alguien guarda ahí un dato comercial, una vista que lo exponga completo lo
  -- publicaría sin que nadie se entere. Así, una clave nueva es invisible hasta que
  -- se la agregue explícitamente acá.
  -- (Se excluye 'stock_tipo' a propósito: insinúa disponibilidad interna.)
  (
    SELECT jsonb_object_agg(t.k, t.v)
    FROM jsonb_each(cp.atributos) AS t(k, v)
    WHERE t.k = ANY (ARRAY[
      -- puertas
      'tipo_puerta', 'uso', 'config_hojas', 'ancho_hoja', 'hoja_principal',
      'tipo_provision', 'estructura', 'sistema', 'espesor', 'modelo',
      'modelo_comercial', 'subtipo_granero', 'diseno_hoja', 'config_estructural',
      'apertura', 'vidrio_incluye', 'vidrio_tipo', 'vidrio_formato', 'herrajes',
      'cerradura', 'componentes', 'instalacion', 'entrega',
      -- ventanas y puertas-balcón
      'tipo_ventana', 'celosia_tipo', 'configuracion_especial', 'diseno',
      'reja', 'mosquitero', 'marco_tipo',
      -- mosquiteras
      'tipo_mosquitera', 'material_marco', 'tipo_malla'
    ])
  ) AS atributos,
  cp.updated_at
FROM catalogo_productos cp
LEFT JOIN tipos_abertura ta  ON ta.id  = cp.tipo_abertura_id
LEFT JOIN sistemas       s   ON s.id   = cp.sistema_id
LEFT JOIN lineas         li  ON li.id  = cp.linea_id
LEFT JOIN categorias     cat ON cat.id = cp.categoria_id
WHERE cp.publicado_web AND cp.activo;

COMMENT ON VIEW catalogo_web IS
  'Contrato público del catálogo web. Lista blanca de columnas: sin costos, márgenes, proveedor, SKU, stock ni precios. Único objeto que puede leer el rol web_catalogo.';

-- Rol de solo lectura para el contenedor del sitio.
-- Nace NOLOGIN y sin password: el secreto no va al repo. Se habilita por entorno con
--   ALTER ROLE web_catalogo LOGIN PASSWORD '<secreto>';
-- (ver docs/catalogo-web.md).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_catalogo') THEN
    CREATE ROLE web_catalogo NOLOGIN;
  END IF;
END
$$;

-- Una vista en Postgres se ejecuta con los permisos de su DUEÑO, no del que consulta
-- (no usamos security_invoker), así que web_catalogo lee la vista sin tener ningún
-- permiso sobre catalogo_productos ni sobre ninguna otra tabla del sistema.
-- CONNECT hay que darlo explícito: en este cluster PUBLIC no lo tiene sobre la base
-- (su ACL es solo =T/postgres, o sea TEMP), así que sin este GRANT el rol ni siquiera
-- llega a autenticarse. El nombre de la base se resuelve en runtime para que esto
-- funcione igual en local, test y prod.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO web_catalogo', current_database());
END
$$;

GRANT USAGE  ON SCHEMA public TO web_catalogo;
GRANT SELECT ON catalogo_web  TO web_catalogo;

-- Cinturón y tiradores: que un GRANT futuro sobre todas las tablas del schema no
-- alcance por accidente a este rol. No puede escribir nada, en ningún lado.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM web_catalogo;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM web_catalogo;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM web_catalogo;
GRANT SELECT ON catalogo_web TO web_catalogo;

INSERT INTO schema_migrations (filename)
VALUES ('20260915000006_catalogo_web_vista_rol.sql') ON CONFLICT DO NOTHING;
