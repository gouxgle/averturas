-- Carga en actividad_log lo que YA estaba registrado en otras tablas.
--
-- El registro de actividad empezó a grabar el día que se creó la tabla, así que
-- la sección arrancaba vacía aunque el sistema tuviera meses de historia. Pero
-- esa historia existe: quién creó cada presupuesto/recibo/remito está en su
-- propio created_by, las ediciones de presupuesto en operacion_versiones, y los
-- cambios de estado en estados_historial. Se traduce todo al formato del log.
--
-- Las filas quedan marcadas con meta->>'origen' = 'backfill' para poder
-- distinguirlas (o borrarlas) sin tocar lo que se registre de acá en adelante:
--   DELETE FROM actividad_log WHERE meta->>'origen' = 'backfill';
--
-- Idempotente: si ya se cargó una vez, no duplica.

INSERT INTO actividad_log (usuario_id, usuario_nombre, entidad, entidad_id, entidad_numero, accion, detalle, meta, created_at)
SELECT * FROM (
  -- Presupuestos creados
  SELECT o.created_by, u.nombre, 'presupuesto', o.id, o.numero, 'crear',
         NULL::text, '{"origen":"backfill"}'::jsonb, o.created_at
  FROM operaciones o LEFT JOIN usuarios u ON u.id = o.created_by
  WHERE o.created_by IS NOT NULL

  UNION ALL
  -- Ediciones de presupuesto: cada versión guardada es una edición previa
  SELECT v.created_by, u.nombre, 'presupuesto', v.operacion_id, o.numero, 'editar',
         'versión ' || v.version, '{"origen":"backfill"}'::jsonb, v.created_at
  FROM operacion_versiones v
  LEFT JOIN operaciones o ON o.id = v.operacion_id
  LEFT JOIN usuarios u ON u.id = v.created_by
  WHERE v.created_by IS NOT NULL

  UNION ALL
  -- Cambios de estado
  SELECT h.changed_by, u.nombre, 'presupuesto', h.operacion_id, o.numero, 'cambio_estado',
         COALESCE(h.estado_anterior::text, '—') || ' → ' || h.estado_nuevo::text,
         '{"origen":"backfill"}'::jsonb, h.created_at
  FROM estados_historial h
  LEFT JOIN operaciones o ON o.id = h.operacion_id
  LEFT JOIN usuarios u ON u.id = h.changed_by
  WHERE h.changed_by IS NOT NULL

  UNION ALL
  -- Recibos emitidos
  SELECT r.created_by, u.nombre, 'recibo', r.id, r.numero, 'crear',
         NULL::text, '{"origen":"backfill"}'::jsonb, r.created_at
  FROM recibos r LEFT JOIN usuarios u ON u.id = r.created_by
  WHERE r.created_by IS NOT NULL

  UNION ALL
  -- Remitos
  SELECT rm.created_by, u.nombre, 'remito', rm.id, rm.numero, 'crear',
         NULL::text, '{"origen":"backfill"}'::jsonb, rm.created_at
  FROM remitos rm LEFT JOIN usuarios u ON u.id = rm.created_by
  WHERE rm.created_by IS NOT NULL
) AS historico
WHERE NOT EXISTS (
  SELECT 1 FROM actividad_log WHERE meta->>'origen' = 'backfill'
);

INSERT INTO schema_migrations (filename) VALUES ('20260910000006_actividad_log_historico.sql') ON CONFLICT DO NOTHING;
