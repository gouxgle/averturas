-- Changelog: Buscador de productos unificado al armar un presupuesto
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Buscador de productos unificado al armar un presupuesto', 'El botón Galería abre ahora el catálogo completo en un modal, con la misma búsqueda de la sección Productos: navegación por categorías, filtros por proveedor, color, nivel y medida, y orden por precio, stock o entrega más rápida. Cada producto muestra el proveedor con su plazo de entrega declarado y un indicador de disponibilidad (inmediata, confirmada, estimada o a confirmar), para elegir la opción más conveniente según la demora de cada proveedor. Al cargar ítems, el tiempo de entrega del presupuesto sugiere el plazo del proveedor más lento.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260901000003_changelog_buscador_de_productos_unificado_al_armar.sql') ON CONFLICT DO NOTHING;
