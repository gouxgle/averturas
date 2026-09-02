-- Changelog: El presupuesto muestra cuántas modificaciones pidió el cliente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El presupuesto muestra cuántas modificaciones pidió el cliente', 'En la proforma impresa y en el link público aparece la revisión y cuántas veces se rehizo el presupuesto a pedido del cliente. Al editar, se marca si el cambio lo pidió el cliente o si es una corrección interna: solo las del cliente se cuentan. Además, desde el historial de versiones ahora se puede abrir cualquier versión anterior completa, con sus ítems, condiciones y observaciones, tal como se le mostró al cliente.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260902000002_changelog_el_presupuesto_muestra_cuantas_modificac.sql') ON CONFLICT DO NOTHING;
