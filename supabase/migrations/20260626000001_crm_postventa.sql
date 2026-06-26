-- Agregar etapa "postventa" al pipeline CRM
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_crm_etapa_check;
ALTER TABLE clientes
  ADD CONSTRAINT clientes_crm_etapa_check
  CHECK (crm_etapa IN (
    'nuevo','en_contacto','presupuestado','en_decision',
    'cerrado_ganado','cerrado_perdido','postventa'
  ));

-- Agregar tipo_accion "entrega" e "instalacion" a tareas
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_tipo_accion_check;
ALTER TABLE tareas
  ADD CONSTRAINT tareas_tipo_accion_check
  CHECK (tipo_accion IN ('whatsapp','llamada','email','visita','nota','entrega','instalacion','cobranza','seguimiento','cumpleanos'));

INSERT INTO schema_migrations (filename)
VALUES ('20260626000001_crm_postventa.sql')
ON CONFLICT DO NOTHING;
