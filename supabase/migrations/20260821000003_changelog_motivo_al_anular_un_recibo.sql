-- Changelog: Motivo al anular un recibo
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Motivo al anular un recibo', 'Al anular un recibo ahora se pide el motivo (lista de motivos frecuentes o uno propio a mano) y queda guardado y visible en el detalle del recibo.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260821000003_changelog_motivo_al_anular_un_recibo.sql') ON CONFLICT DO NOTHING;
