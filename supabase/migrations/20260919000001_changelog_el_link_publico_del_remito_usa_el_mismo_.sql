-- Changelog: El link público del remito usa el mismo encabezado y pie que el PDF
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El link público del remito usa el mismo encabezado y pie que el PDF', 'La página que abre el cliente desde el link del remito ahora muestra la marca igual que el PDF: logo grande, datos de la empresa en una fila, título grande ''Remito de Entrega'' y pie con línea azul. Antes tenía un diseño distinto.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260919000001_changelog_el_link_publico_del_remito_usa_el_mismo_.sql') ON CONFLICT DO NOTHING;
