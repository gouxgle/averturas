-- Changelog: Segunda vía de carga de fotos en Visita Técnica seguía fallando en Android
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Segunda vía de carga de fotos en Visita Técnica seguía fallando en Android', 'El botón ''Foto de referencia''/''Cálculo del software'' dentro de ''Editar ítem'' (usado en Visitas de Relevamiento de Datos) rechazaba localmente fotos de cámara en Android cuando el navegador no daba un tipo de archivo reconocible, y aunque pasara esa validación, ocultaba el motivo real de cualquier error del servidor detrás de un mensaje genérico. Se alineó con el mismo criterio (MIME + extensión) ya usado en el resto del formulario, y ahora se muestra el error real.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260830000005_changelog_segunda_via_de_carga_de_fotos_en_visita_.sql') ON CONFLICT DO NOTHING;
