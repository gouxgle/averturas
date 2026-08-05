-- Changelog: Boton rapido En salon desde el detalle del producto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Boton rapido En salon desde el detalle del producto', 'El detalle del producto (galeria de Catalogo) ahora tiene un boton para marcar/quitar Exhibido en salon directamente, sin entrar a editar. Si no hay stock, sugiere cargar al menos 1 unidad antes de activarlo.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260805000010_changelog_boton_rapido_en_salon_desde_el_detalle_d.sql') ON CONFLICT DO NOTHING;
