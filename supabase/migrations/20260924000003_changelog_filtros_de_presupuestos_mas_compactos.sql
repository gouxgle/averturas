-- Changelog: Filtros de Presupuestos más compactos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Filtros de Presupuestos más compactos', 'Los 7 filtros rápidos (Todos, Seguimiento, Sin respuesta, Por vencer, Vencidos, Aprobados, Perdidos) que antes eran botones en fila y ocupaban hasta 3 líneas ahora son un único combo desplegable, igual que Ordenar por. Se gana espacio para ver más presupuestos en pantalla, tanto en la notebook como en el celular.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260924000003_changelog_filtros_de_presupuestos_mas_compactos.sql') ON CONFLICT DO NOTHING;
