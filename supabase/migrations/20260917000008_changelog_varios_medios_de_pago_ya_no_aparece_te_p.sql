-- Changelog: Varios medios de pago: ya no aparece 'te pasaste' sin motivo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Varios medios de pago: ya no aparece ''te pasaste'' sin motivo', 'Al dividir en varios medios, el primer renglón ya no se precarga con el saldo completo (eso hacía que cualquier segundo monto ''se pasara''). Si se aplica una bonificación después de cargar los medios, el último se ajusta solo para seguir cerrando. Cuando los medios realmente se pasan, el aviso explica cuánto suman, cuál es el saldo y cómo corregirlo.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260917000008_changelog_varios_medios_de_pago_ya_no_aparece_te_p.sql') ON CONFLICT DO NOTHING;
