-- Changelog: Botones e inputs más grandes en el celular
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Botones e inputs más grandes en el celular', 'Etapa 5 de la auditoría responsive: en el celular, los botones de acción por fila (WhatsApp, ver detalle) de Presupuestos, Remitos, Pedidos y Recibos ahora tienen un área de toque de 44px en vez de 28px, y los inputs de los formularios más usados pasan a 16px para que iOS no haga zoom automático al tocarlos. En computadora la densidad visual queda exactamente igual.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260830000003_changelog_botones_e_inputs_mas_grandes_en_el_celul.sql') ON CONFLICT DO NOTHING;
