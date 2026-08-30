-- Changelog: Vista pública de presupuesto adaptada a mobile
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Vista pública de presupuesto adaptada a mobile', 'Etapa 4 de la auditoría responsive: en la vista pública que reciben los clientes (sin login, mayormente por WhatsApp), las opciones para pedir cambios o indicar el motivo de rechazo ya no se aprietan en 2 columnas fijas en el celular.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260830000002_changelog_vista_publica_de_presupuesto_adaptada_a_.sql') ON CONFLICT DO NOTHING;
