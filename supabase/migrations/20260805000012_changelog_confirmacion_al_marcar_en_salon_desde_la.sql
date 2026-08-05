-- Changelog: Confirmacion al marcar En salon desde la galeria
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Confirmacion al marcar En salon desde la galeria', 'El boton rapido de En salon en la tarjeta del catalogo ahora pide un segundo click para confirmar (se desarma solo a los 2.5s si no se confirma), para evitar marcarlo por error en tarjetas chicas una al lado de la otra.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000012_changelog_confirmacion_al_marcar_en_salon_desde_la.sql') ON CONFLICT DO NOTHING;
