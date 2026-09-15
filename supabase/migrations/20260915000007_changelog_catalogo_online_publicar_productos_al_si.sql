-- Changelog: Catálogo online: publicar productos al sitio web
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Catálogo online: publicar productos al sitio web', 'Cada producto tiene ahora un interruptor ''Publicar en catálogo online'' y un nombre opcional para la web. Solo los productos publicados se exponen al sitio público, a través de una vista de base de datos que deja afuera costos, márgenes, proveedor, código interno, stock y precios.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260915000007_changelog_catalogo_online_publicar_productos_al_si.sql') ON CONFLICT DO NOTHING;
