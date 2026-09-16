-- Changelog: Seguridad y mantenimiento: CORS, cabeceras, vencimiento de links, validación de productos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Seguridad y mantenimiento: CORS, cabeceras, vencimiento de links, validación de productos', 'Los links públicos de proformas y remitos ahora vencen a los 90 días (la página pública explica cómo pedir uno nuevo). La API solo acepta peticiones desde el propio sistema, suma cabeceras de seguridad estándar y valida los datos de productos antes de guardarlos. Sin cambios visibles en el uso diario.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260916000002_changelog_seguridad_y_mantenimiento_cors_cabeceras.sql') ON CONFLICT DO NOTHING;
