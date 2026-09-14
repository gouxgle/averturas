-- Changelog: Recibo por WhatsApp: faltaban los datos de la empresa en el PDF
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibo por WhatsApp: faltaban los datos de la empresa en el PDF', 'El PDF que se envía por WhatsApp podía traer los datos de la empresa (CUIT, teléfono, email, dirección) en blanco debajo del logo, mientras que el PDF del modal en Recibos siempre los mostraba bien. La causa: la consulta de datos de la empresa no tenía un orden definido y podía traer una fila vieja/incompleta en vez de la vigente. Corregido acá y en el resto de los lugares donde se repetía el mismo patrón (estado de cuenta, presupuesto y remito públicos, reportes).', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260914000002_changelog_recibo_por_whatsapp_faltaban_los_datos_d.sql') ON CONFLICT DO NOTHING;
