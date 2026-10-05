-- Changelog: Clientes: completar un contacto que ya existe
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Clientes: completar un contacto que ya existe', 'Si al agendar un cliente el número ya estaba guardado (por ejemplo con un nombre provisorio como Contacto), el aviso ahora ofrece Completar este contacto: muestra qué se va a agregar, reemplaza el nombre provisorio por el real, no pisa los datos que ya tenía y abre la ficha para revisar antes de guardar. Además, editar un contacto cuyo número también está en otro ya no impide guardar: solo avisa. Se corrige que los números importados de la agenda se recortaban al editarlos.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261005000003_changelog_clientes_completar_un_contacto_que_ya_ex.sql') ON CONFLICT DO NOTHING;
