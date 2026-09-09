-- Changelog: Línea y Sistema pasan a ser dos cosas distintas
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Línea y Sistema pasan a ser dos cosas distintas', 'Línea es ahora la clasificación comercial del producto (reemplaza a ''Nivel comercial'') y se administra desde Configuración → Líneas: podés renombrar y agregar. Lo que antes figuraba como ''Línea'' en proformas, remitos y en la carga de productos era el sistema técnico y ahora se llama ''Sistema''.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260909000003_changelog_linea_y_sistema_pasan_a_ser_dos_cosas_di.sql') ON CONFLICT DO NOTHING;
