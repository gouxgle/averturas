-- Changelog: Edición de recibos y remitos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Edición de recibos y remitos', 'Editar un recibo ya no borra su bonificación y el saldo que muestra es correcto. No se puede subir su importe por encima del saldo del presupuesto. El presupuesto vinculado se ve aunque esté entregado o saldado. En remitos se controla la cantidad contra el presupuesto, cambiar la fecha actualiza la Agenda y uno que no está en borrador se abre en la lista.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20261106000002_changelog_edicion_de_recibos_y_remitos.sql') ON CONFLICT DO NOTHING;
