-- Changelog: Venta rápida: envío a domicilio y costo de envío
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Venta rápida: envío a domicilio y costo de envío', 'Ahora se puede elegir envío a domicilio (con medio de envío real, ya no queda fijo en flete propio) y cargar el costo de envío, que genera un recibo aparte y una leyenda en el remito. El resumen de la venta pasó a un panel lateral con filtros por promoción y tipo de abertura.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260810000002_changelog_venta_rapida_envio_a_domicilio_y_costo_d.sql') ON CONFLICT DO NOTHING;
