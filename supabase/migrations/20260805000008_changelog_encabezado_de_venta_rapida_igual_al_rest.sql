-- Changelog: Encabezado de Venta rapida igual al resto de las secciones
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Encabezado de Venta rapida igual al resto de las secciones', 'Venta rapida de mostrador tenia un encabezado propio distinto (con boton volver). Ahora usa el mismo SectionHero que el resto de las secciones, incluida la franja de Dolar y Clima en escritorio.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260805000008_changelog_encabezado_de_venta_rapida_igual_al_rest.sql') ON CONFLICT DO NOTHING;
