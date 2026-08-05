-- Changelog: Encabezado unificado con Dolar y Clima en todas las secciones
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Encabezado unificado con Dolar y Clima en todas las secciones', 'El encabezado de cada seccion ahora muestra tambien el valor del dolar y el pronostico del tiempo, igual que en el Dashboard (solo en pantallas de escritorio). Ademas, Venta rapida de mostrador ahora usa el mismo ancho y margenes que el resto de las secciones.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000006_changelog_encabezado_unificado_con_dolar_y_clima_e.sql') ON CONFLICT DO NOTHING;
