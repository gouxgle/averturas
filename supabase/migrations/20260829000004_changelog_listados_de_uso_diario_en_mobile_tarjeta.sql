-- Changelog: Listados de uso diario en mobile: tarjetas en vez de scroll horizontal
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Listados de uso diario en mobile: tarjetas en vez de scroll horizontal', 'Etapa 2 de la auditoría responsive: Presupuestos, Remitos, Recibos, Pedidos, Clientes, Stock, Proveedores y Estado de Cuenta Global ya no fuerzan scroll horizontal en el celular — cada fila se reordena en una tarjeta legible, sin perder ninguna acción ni información.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260829000004_changelog_listados_de_uso_diario_en_mobile_tarjeta.sql') ON CONFLICT DO NOTHING;
