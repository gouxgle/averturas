-- Changelog: Datos completos en el historial de versiones del presupuesto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Datos completos en el historial de versiones del presupuesto', 'Al ver una versión anterior de un presupuesto, cada ítem ahora muestra tipo de abertura, línea, color, cantidad de hojas y medida — lo mismo que ya se ve en la proforma vigente. Antes solo aparecía el texto de descripción.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260905000004_changelog_datos_completos_en_el_historial_de_versi.sql') ON CONFLICT DO NOTHING;
