-- Changelog: Nuevo cliente: corrige teléfono y tipo de persona
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Nuevo cliente: corrige teléfono y tipo de persona', 'Al pegar un número de teléfono ya no se corta a 5 dígitos, y cambiar entre persona física/jurídica ya no borra el nombre cargado.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260810000007_changelog_nuevo_cliente_corrige_telefono_y_tipo_de.sql') ON CONFLICT DO NOTHING;
