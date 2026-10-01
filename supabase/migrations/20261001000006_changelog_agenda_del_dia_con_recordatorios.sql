-- Changelog: Agenda del día con recordatorios
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Agenda del día con recordatorios', 'Al entrar aparece Tu agenda de hoy con lo pendiente del día y lo atrasado (llamados, recotizaciones, visitas, entregas, oportunidades y tareas internas). Cada tarea se marca Hecha, Leída (vuelve en 1 hora), se recuerda más tarde o a una hora exacta, o se pasa a otro día. Nunca bloquea: Seguir trabajando cierra el aviso y el botón de arriba lo vuelve a abrir. Nueva pantalla Agenda con tareas internas de la empresa (compras, proveedores, pagos), que pueden repetirse cada semana o cada mes. Recotizar una proforma se agenda sola cuando el cliente pide cambios.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261001000006_changelog_agenda_del_dia_con_recordatorios.sql') ON CONFLICT DO NOTHING;
