-- Changelog: Aviso de visita de relevamiento bonificada en la proforma
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Aviso de visita de relevamiento bonificada en la proforma', 'Cuando la visita de relevamiento se hizo sin cargo, la proforma ahora lo aclara junto al total, tanto en el PDF como en el link que ve el cliente.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260915000004_changelog_aviso_de_visita_de_relevamiento_bonifica.sql') ON CONFLICT DO NOTHING;
