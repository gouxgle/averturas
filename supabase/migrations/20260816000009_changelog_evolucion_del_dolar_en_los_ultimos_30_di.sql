-- Changelog: Evolucion del dolar en los ultimos 30 dias
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Evolucion del dolar en los ultimos 30 dias', 'Al hacer clic en el indicador de Valor Dolar del header ahora se despliega un grafico con la evolucion de los ultimos 30 dias, la variacion porcentual del periodo y el minimo/maximo. El valor se va registrando solo, un dato por dia.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260816000009_changelog_evolucion_del_dolar_en_los_ultimos_30_di.sql') ON CONFLICT DO NOTHING;
