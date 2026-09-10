-- Changelog: Buscar un cliente por su teléfono ahora funciona con cualquier formato
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Buscar un cliente por su teléfono ahora funciona con cualquier formato', 'El sistema avisaba "este teléfono ya existe" pero después ese cliente no aparecía al buscarlo por ese mismo número, porque la búsqueda comparaba el texto tal cual y los números están guardados en formatos distintos (+549..., con espacios, sin prefijo). Ahora la búsqueda normaliza el número igual que la validación de duplicados.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260910000004_changelog_buscar_un_cliente_por_su_telefono_ahora_.sql') ON CONFLICT DO NOTHING;
