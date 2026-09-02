-- Por qué se editó el presupuesto: a pedido del cliente o corrección interna.
--
-- `operacion_versiones` contaba TODA edición por igual, así que no se podía mostrarle
-- al cliente cuántas modificaciones pidió él sin incluir también las correcciones
-- propias (un precio mal tipeado, un ajuste de redacción). Con este campo, el número
-- que se muestra en la proforma y en el link público solo cuenta las del cliente.
--
-- El origen describe la EDICIÓN que reemplazó a esa versión, no la versión en sí:
-- v3.origen = 'cliente' significa "el estado v3 se cambió porque el cliente lo pidió".
--
-- Las filas ya existentes quedan en 'interna' a propósito: no hay forma de saber
-- retroactivamente quién pidió cada cambio, y es preferible sub-contar antes que
-- atribuirle al cliente una modificación que no pidió.

ALTER TABLE operacion_versiones
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'interna';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operacion_versiones_origen_check'
  ) THEN
    ALTER TABLE operacion_versiones
      ADD CONSTRAINT operacion_versiones_origen_check
      CHECK (origen IN ('cliente', 'interna'));
  END IF;
END $$;

COMMENT ON COLUMN operacion_versiones.origen IS
  'Motivo de la edición que reemplazó esta versión: cliente = la pidió el cliente (se muestra en la proforma y el link público) | interna = corrección propia.';

CREATE INDEX IF NOT EXISTS idx_operacion_versiones_origen
  ON operacion_versiones (operacion_id) WHERE origen = 'cliente';

INSERT INTO schema_migrations (filename)
VALUES ('20260902000001_operacion_versiones_origen.sql') ON CONFLICT DO NOTHING;
