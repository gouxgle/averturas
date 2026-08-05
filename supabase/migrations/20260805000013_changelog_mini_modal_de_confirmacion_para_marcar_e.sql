-- Changelog: Mini modal de confirmacion para marcar En salon
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Mini modal de confirmacion para marcar En salon', 'Reemplaza el boton de doble click por un mini modal que pregunta si estas seguro antes de marcar o quitar Exhibido en salon desde la galeria del catalogo.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000013_changelog_mini_modal_de_confirmacion_para_marcar_e.sql') ON CONFLICT DO NOTHING;
