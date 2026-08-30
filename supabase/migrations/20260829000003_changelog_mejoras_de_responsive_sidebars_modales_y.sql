-- Changelog: Mejoras de responsive: sidebars, modales y tablas
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Mejoras de responsive: sidebars, modales y tablas', 'Etapa 1 de la auditoría responsive: sidebars que no se apilaban en mobile (Remitos, Estado de Cuenta Global, Proveedores, Reportes, Stock), paneles flotantes de ayuda/comentarios sin límite de ancho, modales usando dvh en vez de vh, tablas sin scroll horizontal en Actualización de Precios/Visitas Técnicas/Stock, y la fila de ítems de Nuevo Remito inutilizable en pantallas chicas.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260829000003_changelog_mejoras_de_responsive_sidebars_modales_y.sql') ON CONFLICT DO NOTHING;
