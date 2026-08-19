-- Changelog: Visita tecnica ahora se llama Visita de Relevamiento de Datos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Visita tecnica ahora se llama Visita de Relevamiento de Datos', 'Se renombro en toda la app: menu, botones, mensajes y el PDF impreso. Es solo un cambio de nombre visible, no afecta datos ni presupuestos existentes.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260816000007_changelog_visita_tecnica_ahora_se_llama_visita_de_.sql') ON CONFLICT DO NOTHING;
