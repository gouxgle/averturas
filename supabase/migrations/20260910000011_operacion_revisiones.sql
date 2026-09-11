-- Versionado de proformas por revisión enviada: cada vez que se comparte la
-- proforma (link / WhatsApp / email) se congela un snapshot autocontenido con
-- su propio token único. Los links anteriores siguen funcionando pero muestran
-- su revisión, no el estado vivo. Ver plan: versionado de proformas.

CREATE TABLE IF NOT EXISTS operacion_revisiones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id   UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  revision       INT  NOT NULL,
  token          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  snapshot       JSONB NOT NULL,
  contenido_hash TEXT NOT NULL,
  enviada_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviada_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  canal          TEXT,
  aprobada_at    TIMESTAMPTZ,
  rechazada_at   TIMESTAMPTZ,
  UNIQUE (operacion_id, revision)
);

CREATE INDEX IF NOT EXISTS operacion_revisiones_op_idx
  ON operacion_revisiones (operacion_id, revision DESC);

-- Snapshot público autocontenido (sin costos/márgenes): la unión de lo que
-- necesitan ImprimirPresupuesto.tsx y VistaPublicaPresupuesto.tsx. `empresa`
-- queda afuera a propósito: se sirve viva en ambos lados.
CREATE OR REPLACE FUNCTION proforma_snapshot(p_op uuid) RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'numero', o.numero, 'tipo', o.tipo, 'estado', o.estado,
    'forma_pago', o.forma_pago, 'forma_envio', o.forma_envio, 'costo_envio', o.costo_envio,
    'tiempo_entrega', o.tiempo_entrega, 'fecha_validez', o.fecha_validez, 'notas', o.notas,
    'incluye_instalacion', o.incluye_instalacion, 'precio_total', o.precio_total,
    'created_at', o.created_at,
    'visita_tecnica', (
      SELECT jsonb_build_object(
        'id', vt.id, 'numero', vt.numero, 'cobro_estado', vt.cobro_estado,
        'costo_cobrado', vt.costo_cobrado)
      FROM visitas_tecnicas vt
      WHERE vt.operacion_id = o.id
      ORDER BY vt.created_at DESC LIMIT 1
    ),
    'cliente', jsonb_build_object(
      'nombre',        cl.nombre,
      'apellido',      cl.apellido,
      'razon_social',  cl.razon_social,
      'tipo_persona',  cl.tipo_persona,
      'documento_nro', cl.documento_nro,
      'telefono',      cl.telefono,
      'email',         cl.email,
      'direccion',     cl.direccion,
      'localidad',     cl.localidad
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'orden', oi.orden, 'descripcion', oi.descripcion, 'cantidad', oi.cantidad,
        'precio_unitario', oi.precio_unitario, 'precio_lista', oi.precio_lista,
        'precio_instalacion', oi.precio_instalacion, 'incluye_instalacion', oi.incluye_instalacion,
        'precio_total', (oi.precio_unitario + CASE WHEN oi.incluye_instalacion THEN oi.precio_instalacion ELSE 0 END) * oi.cantidad,
        'medida_ancho', oi.medida_ancho, 'medida_alto', oi.medida_alto, 'color', oi.color,
        'vidrio', oi.vidrio, 'premarco', oi.premarco, 'accesorios', to_jsonb(oi.accesorios),
        'notas', oi.notas, 'tipo_item', oi.tipo_item, 'calculo_url', oi.calculo_url,
        'tipo_abertura_id', oi.tipo_abertura_id, 'sistema_id', oi.sistema_id,
        'producto_id', oi.producto_id, 'servicio_id', oi.servicio_id,
        'tipo_abertura_nombre', ta.nombre, 'sistema_nombre', si.nombre, 'servicio_nombre', cs.nombre,
        'producto_nombre', cp.nombre, 'producto_imagen_url', cp.imagen_url, 'producto_atributos', cp.atributos
      ) ORDER BY oi.orden, oi.id)
      FROM operacion_items oi
      LEFT JOIN tipos_abertura     ta ON ta.id = oi.tipo_abertura_id
      LEFT JOIN sistemas           si ON si.id = oi.sistema_id
      LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
      LEFT JOIN catalogo_servicios cs ON cs.id = oi.servicio_id
      WHERE oi.operacion_id = o.id
    ), '[]'::jsonb),
    'formas_pago_alternativas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nombre', fp.nombre, 'descuento_pct', fp.descuento_pct) ORDER BY fp.orden)
      FROM operacion_formas_pago fp WHERE fp.operacion_id = o.id
    ), '[]'::jsonb)
  )
  FROM operaciones o
  JOIN clientes cl ON cl.id = o.cliente_id
  WHERE o.id = p_op;
$$ LANGUAGE sql STABLE;

-- Hash de contenido: detecta si la propuesta cambió entre dos envíos. Deja
-- afuera cliente, ids de ítems, nombres resueltos, imagen/atributos de
-- producto y estado — nada de eso es "cambio de propuesta".
CREATE OR REPLACE FUNCTION proforma_hash(s jsonb) RETURNS text AS $$
  SELECT md5(jsonb_build_object(
    'forma_pago', s->'forma_pago', 'forma_envio', s->'forma_envio', 'costo_envio', s->'costo_envio',
    'tiempo_entrega', s->'tiempo_entrega', 'fecha_validez', s->'fecha_validez', 'notas', s->'notas',
    'precio_total', s->'precio_total',
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'descripcion', it->'descripcion', 'cantidad', it->'cantidad',
        'precio_unitario', it->'precio_unitario', 'precio_lista', it->'precio_lista',
        'precio_instalacion', it->'precio_instalacion', 'incluye_instalacion', it->'incluye_instalacion',
        'medida_ancho', it->'medida_ancho', 'medida_alto', it->'medida_alto', 'color', it->'color',
        'vidrio', it->'vidrio', 'premarco', it->'premarco', 'accesorios', it->'accesorios',
        'notas', it->'notas', 'tipo_item', it->'tipo_item',
        'tipo_abertura_id', it->'tipo_abertura_id', 'sistema_id', it->'sistema_id',
        'producto_id', it->'producto_id', 'servicio_id', it->'servicio_id'
      ))
      FROM jsonb_array_elements(s->'items') it
    ),
    'formas_pago_alternativas', s->'formas_pago_alternativas'
  )::text)
$$ LANGUAGE sql IMMUTABLE;

-- Backfill: cada operación con link ya enviado recibe la Rev. 1 con el MISMO
-- token — los links ya compartidos con clientes siguen funcionando, ahora
-- apuntando a un snapshot congelado en vez de al estado vivo.
INSERT INTO operacion_revisiones (operacion_id, revision, token, snapshot, contenido_hash, enviada_at, canal)
SELECT o.id, 1, o.token_acceso, x.s, proforma_hash(x.s),
       COALESCE(o.token_acceso_at, o.updated_at, o.created_at), 'backfill'
FROM operaciones o, LATERAL (SELECT proforma_snapshot(o.id) AS s) x
WHERE o.token_acceso IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE operacion_revisiones r
SET aprobada_at = o.aprobado_online_at
FROM operaciones o
WHERE o.id = r.operacion_id AND o.aprobado_online_at IS NOT NULL AND r.aprobada_at IS NULL;

INSERT INTO schema_migrations (filename) VALUES ('20260910000011_operacion_revisiones.sql') ON CONFLICT DO NOTHING;
