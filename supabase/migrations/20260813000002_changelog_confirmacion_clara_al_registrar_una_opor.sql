-- Changelog: Confirmacion clara al registrar una oportunidad futura
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Confirmacion clara al registrar una oportunidad futura', 'Al guardar una oportunidad futura desde un presupuesto rechazado o vencido, ahora se muestra Oportunidad futura cargada con la fecha de contacto en vez de seguir ofreciendo registrarla de nuevo.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260813000002_changelog_confirmacion_clara_al_registrar_una_opor.sql') ON CONFLICT DO NOTHING;
