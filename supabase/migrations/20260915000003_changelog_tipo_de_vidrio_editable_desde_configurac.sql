-- Changelog: Tipo de vidrio editable desde Configuración
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Tipo de vidrio editable desde Configuración', 'El campo ''Tipo de vidrio'' en Nuevo producto (puertas, ventanas y productos a medida) usaba tres listas fijas distintas en el código, con valores levemente distintos entre sí. Ahora es un catálogo único editable desde Configuración → Tipos de vidrio — mismo patrón que Materiales y Líneas: agregar, renombrar o desactivar sin tocar código. Se sembró con los valores que ya se usaban (Transparente, Laminado, DVH, Traslúcido, Sin vidrio).', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260915000003_changelog_tipo_de_vidrio_editable_desde_configurac.sql') ON CONFLICT DO NOTHING;
