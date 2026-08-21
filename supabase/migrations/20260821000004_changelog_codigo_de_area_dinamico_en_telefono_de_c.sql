-- Changelog: Código de área dinámico en teléfono de clientes
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Código de área dinámico en teléfono de clientes', 'El campo de WhatsApp/celular ahora ajusta el largo del número según el código de área (ej: 11 + 8 dígitos para Buenos Aires, 3704 + 6 dígitos para Resistencia) en vez de limitar siempre a 6 dígitos.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260821000004_changelog_codigo_de_area_dinamico_en_telefono_de_c.sql') ON CONFLICT DO NOTHING;
