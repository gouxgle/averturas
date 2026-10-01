-- Changelog: Facturación: contingencia si ARCA no responde
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Facturación: contingencia si ARCA no responde', 'Si ARCA se cae se puede seguir facturando con CAEA: el sistema pide el código de cada quincena con anticipación, permite emitir en contingencia registrando la causa, e informa a ARCA lo emitido cuando vuelve (o "sin movimiento"). Nueva pestaña Contingencia en Facturación.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261001000003_changelog_facturacion_contingencia_si_arca_no_resp.sql') ON CONFLICT DO NOTHING;
