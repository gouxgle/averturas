-- Changelog: Historial del cliente: estado de la proforma y motivo de rechazo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Historial del cliente: estado de la proforma y motivo de rechazo', 'El historial ahora muestra si cada proforma quedó aprobada, rechazada o sin respuesta, y si el cliente la rechazó desde el link también queda registrado el motivo. Se agregó un indicador rápido de cuántas proformas se aprobaron/rechazaron para tener el perfil del cliente a la vista.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260810000003_changelog_historial_del_cliente_estado_de_la_profo.sql') ON CONFLICT DO NOTHING;
