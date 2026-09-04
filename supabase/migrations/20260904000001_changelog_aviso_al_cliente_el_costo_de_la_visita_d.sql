-- Changelog: Aviso al cliente: el costo de la visita de relevamiento se descuenta del total
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Aviso al cliente: el costo de la visita de relevamiento se descuenta del total', 'Cuando la visita de relevamiento que originó el presupuesto fue cobrada, la proforma (link público y PDF) ahora muestra una leyenda indicando que ese importe se toma a cuenta del total.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260904000001_changelog_aviso_al_cliente_el_costo_de_la_visita_d.sql') ON CONFLICT DO NOTHING;
