-- Changelog: Agenda: tareas de clientes con buscador
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Agenda: tareas de clientes con buscador', 'Al cargar una tarea en la Agenda se elige si es de la empresa o de un cliente. El cliente y el proveedor se buscan en la agenda de contactos (nombre, DNI o teléfono) en lugar de escribirlos a mano. Las tareas cargadas a mano se pueden editar y borrar.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261027000001_changelog_agenda_tareas_de_clientes_con_buscador.sql') ON CONFLICT DO NOTHING;
