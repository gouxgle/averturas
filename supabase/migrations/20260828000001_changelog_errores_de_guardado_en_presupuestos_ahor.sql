-- Changelog: Errores de guardado en Presupuestos ahora dicen qué campo falla
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Errores de guardado en Presupuestos ahora dicen qué campo falla', 'Antes, al guardar un presupuesto con datos invalidos solo aparecia ''Datos invalidos'' sin decir cual era el problema. Ahora se muestra el campo y el motivo exacto de cada error, y si el problema es de un item puntual se abre directo su edicion para corregirlo sin tener que adivinar cual de todos.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260828000001_changelog_errores_de_guardado_en_presupuestos_ahor.sql') ON CONFLICT DO NOTHING;
