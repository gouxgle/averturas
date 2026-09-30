-- Changelog: Clientes: CUIT propio y datos desde ARCA
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Clientes: CUIT propio y datos desde ARCA', 'La ficha del cliente tiene ahora un campo de CUIT aparte del DNI, domicilio fiscal y todas las condiciones de IVA. Con el botón "Traer de ARCA" se completan razón social, domicilio y condición de IVA desde el padrón (cuando la facturación esté configurada).', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260930000003_changelog_clientes_cuit_propio_y_datos_desde_arca.sql') ON CONFLICT DO NOTHING;
