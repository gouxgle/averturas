-- Changelog: Visita técnica: espacio de firma del cliente en el PDF
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Visita técnica: espacio de firma del cliente en el PDF', 'El formulario de visita técnica ahora incluye un apartado al final para la firma del cliente, aclaración y fecha, confirmando conformidad con las medidas relevadas.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260810000006_changelog_visita_tecnica_espacio_de_firma_del_clie.sql') ON CONFLICT DO NOTHING;
