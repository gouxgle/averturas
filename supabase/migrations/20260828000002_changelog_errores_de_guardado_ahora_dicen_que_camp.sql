-- Changelog: Errores de guardado ahora dicen que campo falla, en todo el sistema
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Errores de guardado ahora dicen que campo falla, en todo el sistema', 'La mejora que se hizo en Presupuestos (mostrar el campo y motivo exacto de un error al guardar, en vez de un mensaje generico que no dejaba saber que corregir) ahora aplica en todas las pantallas: clientes, recibos, pedidos, remitos, productos, venta rapida, visitas tecnicas, oportunidades y mas.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260828000002_changelog_errores_de_guardado_ahora_dicen_que_camp.sql') ON CONFLICT DO NOTHING;
