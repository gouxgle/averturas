-- Changelog: Corregido error al enviar el estado de cuenta por WhatsApp
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corregido error al enviar el estado de cuenta por WhatsApp', 'El botón "WhatsApp PDF" fallaba con error interno en clientes con compromisos de pago pendientes.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260907000004_changelog_corregido_error_al_enviar_el_estado_de_c.sql') ON CONFLICT DO NOTHING;
