-- Changelog: Manual de la Revisión integral de precios
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Manual de la Revisión integral de precios', 'Nuevo manual en Manuales del sistema que explica paso a paso la Revisión integral de precios: cómo decide el sistema qué renovar y qué actualizar, cómo aplicar un aumento con vista previa, cómo cargar la lista de un proveedor, qué significa cada etiqueta, el historial y preguntas frecuentes. Se puede imprimir o guardar en PDF.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261005000002_changelog_manual_de_la_revision_integral_de_precio.sql') ON CONFLICT DO NOTHING;
