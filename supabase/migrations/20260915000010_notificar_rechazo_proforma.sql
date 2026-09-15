-- Los rechazos de proforma no notificaban nada.
--
-- El link público, al rechazar, solo seteaba estado='rechazado' + motivo, sin tocar
-- notif_leida ni ningún timestamp de evento. La consulta de /notificaciones filtra por
-- (aprobado_online_at IS NOT NULL OR respuesta_cliente_at IS NOT NULL) AND notif_leida
-- = false, así que un rechazo nunca entraba: la campanita no sonaba y el rechazo se
-- enteraba recién si alguien miraba la lista de presupuestos.
--
-- Se agrega el timestamp propio del rechazo online, en espejo de aprobado_online_at,
-- para poder ordenar y mostrar el evento igual que una aprobación.
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS rechazado_online_at TIMESTAMPTZ;

COMMENT ON COLUMN operaciones.rechazado_online_at IS
  'Cuándo el cliente rechazó la proforma desde el link público. Espejo de aprobado_online_at; alimenta las notificaciones.';

-- Backfill: los rechazos ya ocurridos toman la fecha de rechazo de su última revisión,
-- y si no tienen revisión, el updated_at de la operación. Se dejan como YA LEÍDOS
-- (notif_leida queda como está, true por defecto) para no llenar la campanita de
-- avisos viejos al deployar.
UPDATE operaciones o
SET rechazado_online_at = COALESCE(
      (SELECT MAX(r.rechazada_at) FROM operacion_revisiones r WHERE r.operacion_id = o.id),
      o.updated_at)
WHERE o.estado = 'rechazado' AND o.rechazado_online_at IS NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260915000010_notificar_rechazo_proforma.sql') ON CONFLICT DO NOTHING;
