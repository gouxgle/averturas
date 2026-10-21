-- Changelog: Listas de precios subidas, historial y reversión
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Listas de precios subidas, historial y reversión', 'En la Revisión de precios hay una pestaña Listas subidas con cada lista de proveedor que se aplicó (qué valía cada producto antes y después, cambios raros resaltados). Un administrador puede revertir una lista. El detalle del producto muestra Precios y listas con la lista vigente y su historial. Al cargar una lista se ve cómo se leyó el archivo y se pueden elegir las columnas a mano; los importes con cero inicial (0,125) ya no se leen mal, los códigos repetidos se avisan y los cambios absurdos no se preseleccionan.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261021000003_changelog_listas_de_precios_subidas_historial_y_re.sql') ON CONFLICT DO NOTHING;
