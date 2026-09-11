-- Changelog: Revisiones de proforma con link único
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Revisiones de proforma con link único', 'Cada envío de la proforma (link, WhatsApp o email) congela una revisión con su propio link único. Los links anteriores siguen visibles con aviso de que hay una más nueva, el cliente puede comparar revisiones y descargar el PDF, y desde el panel se puede reconstruir el PDF de cualquier revisión enviada.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260911000001_changelog_revisiones_de_proforma_con_link_unico.sql') ON CONFLICT DO NOTHING;
