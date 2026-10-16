-- Changelog: Devoluciones: desde la ficha del cliente, comprobante de reintegro y compromisos de pago
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Devoluciones: desde la ficha del cliente, comprobante de reintegro y compromisos de pago', 'Se puede registrar una devolución desde la ficha del cliente (menú ⋮), y el buscador de remitos ahora encuentra por número, cliente, presupuesto o producto. Cada reintegro de dinero tiene su comprobante imprimible para que el cliente firme que lo recibió. Y al anular una devolución se reabren los compromisos de pago que había cerrado.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261015000009_changelog_devoluciones_desde_la_ficha_del_cliente_.sql') ON CONFLICT DO NOTHING;
