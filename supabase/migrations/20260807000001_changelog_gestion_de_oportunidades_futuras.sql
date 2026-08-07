-- Changelog: Gestión de Oportunidades Futuras
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Gestión de Oportunidades Futuras', 'Registrá clientes que postergaron una decisión de compra: el CRM te avisa solo cuando llega la fecha de recontacto, con acceso directo a WhatsApp, llamada o email y un mensaje sugerido.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260807000001_changelog_gestion_de_oportunidades_futuras.sql') ON CONFLICT DO NOTHING;
