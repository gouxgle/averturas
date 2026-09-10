-- Changelog: Remito de entrega: dónde firma el cliente, más claro
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Remito de entrega: dónde firma el cliente, más claro', 'El campo pasa a decir "Recibido por" (lo completa quien recibe), la zona de firma del cliente ahora es un recuadro señalizado con "Firmar aquí" y "Recibí conforme" bien visible, y el remito entra completo en una sola hoja — antes la firma quedaba cortada al borde y el nombre de la empresa se iba a una segunda página.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260910000010_changelog_remito_de_entrega_donde_firma_el_cliente.sql') ON CONFLICT DO NOTHING;
