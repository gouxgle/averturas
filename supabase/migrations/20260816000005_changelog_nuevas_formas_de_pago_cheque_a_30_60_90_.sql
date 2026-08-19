-- Changelog: Nuevas formas de pago: cheque a 30/60/90 dias
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Nuevas formas de pago: cheque a 30/60/90 dias', 'Se agregaron 3 alternativas de pago para ofrecer en los presupuestos: Cheque a 30 dias, Cheque a 30-60 dias y Cheque a 30-60-90 dias. Se pueden editar los porcentajes desde Configuracion > Formas de pago.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260816000005_changelog_nuevas_formas_de_pago_cheque_a_30_60_90_.sql') ON CONFLICT DO NOTHING;
