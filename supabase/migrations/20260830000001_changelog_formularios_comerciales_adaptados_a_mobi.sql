-- Changelog: Formularios comerciales adaptados a mobile
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Formularios comerciales adaptados a mobile', 'Etapa 3 de la auditoría responsive: los campos de Nueva Operación, Nuevo Cliente, Nuevo Recibo y Nuevo Pedido ya no se aprietan en 2-3 columnas fijas en el celular. También se agregó límite de alto con scroll a los modales de Nuevo Lead, Mover etapa, Anular recibo y Nuevo compromiso de pago.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260830000001_changelog_formularios_comerciales_adaptados_a_mobi.sql') ON CONFLICT DO NOTHING;
