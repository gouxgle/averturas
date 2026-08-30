-- Changelog: Fotos de Android seguían rechazándose: se saca el chequeo de MIME/extensión
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Fotos de Android seguían rechazándose: se saca el chequeo de MIME/extensión', 'Reproducido con curl: cuando la foto de cámara en Android llega sin extensión reconocible Y sin MIME de imagen al mismo tiempo (pasa según fabricante/navegador), el servidor la rechazaba con ''Formato no permitido'' aunque fuera una foto válida. Se saca esa validación previa por metadata (poco confiable) tanto del servidor como del cliente: ahora sharp() decide por el contenido real del archivo, que es la única señal confiable.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260830000006_changelog_fotos_de_android_seguian_rechazandose_se.sql') ON CONFLICT DO NOTHING;
