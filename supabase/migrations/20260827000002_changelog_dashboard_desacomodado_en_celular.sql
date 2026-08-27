-- Changelog: Dashboard desacomodado en celular
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Dashboard desacomodado en celular', 'El encabezado del Dashboard (saludo, dolar/clima, boton Nuevo presupuesto) no se adaptaba a pantallas chicas y quedaba con elementos cortados. Ahora se apila en celular y el dolar/clima se muestra solo en pantallas grandes, igual que en el resto de la app.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260827000002_changelog_dashboard_desacomodado_en_celular.sql') ON CONFLICT DO NOTHING;
