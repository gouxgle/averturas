-- Bonificación elegida en el presupuesto (opcional): se muestra en la proforma y el recibo la
-- toma como punto de partida. precio_total sigue siendo el precio de lista.
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS bonificacion_tipo   TEXT CHECK (bonificacion_tipo IN ('porcentaje','monto')),
  ADD COLUMN IF NOT EXISTS bonificacion_valor  NUMERIC(14,2) CHECK (bonificacion_valor IS NULL OR bonificacion_valor > 0),
  ADD COLUMN IF NOT EXISTS bonificacion_motivo TEXT,
  ADD COLUMN IF NOT EXISTS bonificacion_monto  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE operaciones DROP CONSTRAINT IF EXISTS operaciones_bonificacion_coherente;
ALTER TABLE operaciones ADD CONSTRAINT operaciones_bonificacion_coherente
  CHECK ((bonificacion_tipo IS NULL) = (bonificacion_valor IS NULL));

-- Qué parte del descuento de un recibo es la bonificación del presupuesto (el resto es la de la forma de pago).
ALTER TABLE recibos ADD COLUMN IF NOT EXISTS bonificacion_presupuesto_monto NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Bonificación del presupuesto que todavía no se materializó en recibos.
-- descuentos de una operación = lo descontado en recibos emitidos + esto.
CREATE OR REPLACE FUNCTION operacion_bonif_pendiente(p_op uuid) RETURNS numeric AS $$
  SELECT GREATEST(
    COALESCE((SELECT bonificacion_monto FROM operaciones WHERE id = p_op), 0)
    - COALESCE((SELECT SUM(bonificacion_presupuesto_monto) FROM recibos WHERE operacion_id = p_op AND estado = 'emitido'), 0),
    0)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE VIEW operacion_cobranza AS
SELECT
  o.id AS operacion_id,
  COALESCE(o.precio_total, 0)::numeric AS precio_total,
  COALESCE(r.cobrado, 0)::numeric      AS cobrado,
  (COALESCE(r.descuentos, 0) + operacion_bonif_pendiente(o.id))::numeric AS descuentos,
  COALESCE(d.aplicado, 0)::numeric     AS devuelto_a_saldo,
  (COALESCE(o.precio_total, 0) - COALESCE(r.cobrado, 0) - COALESCE(r.descuentos, 0)
     - operacion_bonif_pendiente(o.id) - COALESCE(d.aplicado, 0))::numeric AS saldo
FROM operaciones o
LEFT JOIN LATERAL (
  SELECT SUM(monto_total) AS cobrado, SUM(monto_descuento) AS descuentos
  FROM recibos
  WHERE operacion_id = o.id AND estado = 'emitido'
) r ON true
LEFT JOIN LATERAL (
  SELECT SUM(aplicado_a_saldo) AS aplicado
  FROM devoluciones
  WHERE operacion_id = o.id AND estado = 'emitida'
) d ON true;

-- Snapshot de la proforma: agrega la bonificación.
CREATE OR REPLACE FUNCTION proforma_snapshot(p_op uuid) RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'numero', o.numero, 'tipo', o.tipo, 'estado', o.estado,
    'forma_pago', o.forma_pago, 'forma_envio', o.forma_envio, 'costo_envio', o.costo_envio,
    'tiempo_entrega', o.tiempo_entrega, 'fecha_validez', o.fecha_validez, 'notas', o.notas,
    'incluye_instalacion', o.incluye_instalacion, 'precio_total', o.precio_total,
    'bonificacion_tipo', o.bonificacion_tipo, 'bonificacion_valor', o.bonificacion_valor,
    'bonificacion_motivo', o.bonificacion_motivo, 'bonificacion_monto', o.bonificacion_monto,
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

-- Hash: la bonificación entra solo si existe, así los presupuestos ya enviados conservan su hash.
CREATE OR REPLACE FUNCTION proforma_hash(s jsonb) RETURNS text AS $$
  SELECT md5((jsonb_build_object(
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
  ) || CASE WHEN s->'bonificacion_tipo' IS NOT NULL AND s->>'bonificacion_tipo' IS NOT NULL
         THEN jsonb_build_object('bonificacion', jsonb_build_array(s->'bonificacion_tipo', s->'bonificacion_valor', s->'bonificacion_motivo'))
         ELSE '{}'::jsonb END)::text)
$$ LANGUAGE sql IMMUTABLE;

INSERT INTO schema_migrations (filename) VALUES ('20261016000002_bonificacion_presupuesto.sql') ON CONFLICT DO NOTHING;
