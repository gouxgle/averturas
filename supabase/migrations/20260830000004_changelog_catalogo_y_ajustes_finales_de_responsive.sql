-- Changelog: Catálogo y ajustes finales de responsive
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Catálogo y ajustes finales de responsive', 'Etapa 6 y 7 de la auditoría responsive: el formulario de Nuevo Producto (el más largo del sistema, 25 secciones) y el alta de Proveedores ya no aprietan sus campos en el celular. También se corrigieron paneles flotantes (notificaciones, contacto) sin margen de seguridad y las grillas fijas de Reportes.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260830000004_changelog_catalogo_y_ajustes_finales_de_responsive.sql') ON CONFLICT DO NOTHING;
