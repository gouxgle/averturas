-- Changelog: Corrige calculo de Hoy/Ayer en todo el sistema
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Corrige calculo de Hoy/Ayer en todo el sistema', 'Varios lugares (Clientes, CRM, Dashboard, Estado de cuenta, Presupuestos, Stock) calculaban dias transcurridos con bloques de 24 horas en vez de dia calendario, mostrando como Hoy algo hecho ayer a la tarde si se veia antes de esas 24hs completas. Corregido en el backend (Postgres, dia calendario en horario Argentina) y centralizado en el frontend en un helper unico.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260805000014_changelog_corrige_calculo_de_hoy_ayer_en_todo_el_s.sql') ON CONFLICT DO NOTHING;
