-- Changelog: Productos: filtro de proveedor siempre a mano y renovar validez al toque
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Productos: filtro de proveedor siempre a mano y renovar validez al toque', 'En Productos hay un selector de proveedor siempre visible (ya no desaparece al elegir una familia). Cada producto tiene un botón Renovar en la tarjeta y en el detalle para renovar la validez del precio sin cambiarlo, y al editar el costo o el precio la validez se renueva sola con un período nuevo. Los colores del semáforo usan los días configurados en la revisión de precios.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261021000001_changelog_productos_filtro_de_proveedor_siempre_a_.sql') ON CONFLICT DO NOTHING;
