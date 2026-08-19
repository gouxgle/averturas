-- Changelog: Centro de alertas en el Dashboard
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Centro de alertas en el Dashboard', 'Nueva seccion destacada arriba del Dashboard que junta todo lo programado y pendiente para hoy o atrasado: contactos, entregas, visitas, cobranzas. Se puede marcar como hecho directo desde ahi.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260816000003_changelog_centro_de_alertas_en_el_dashboard.sql') ON CONFLICT DO NOTHING;
