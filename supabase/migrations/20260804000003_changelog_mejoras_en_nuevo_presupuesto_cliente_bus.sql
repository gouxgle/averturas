-- Changelog: Mejoras en Nuevo presupuesto: cliente, busqueda y promociones
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Mejoras en Nuevo presupuesto: cliente, busqueda y promociones', 'Foco automatico en el buscador de cliente al entrar; la busqueda ahora encuentra por nombre y apellido aunque falte un segundo nombre (Hugo Lescano encuentra a Hugo Alberto Lescano); la galeria y el resumen de la proforma ahora muestran precio de lista, precio de oferta y el ahorro cuando el producto esta en promocion.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260804000003_changelog_mejoras_en_nuevo_presupuesto_cliente_bus.sql') ON CONFLICT DO NOTHING;
