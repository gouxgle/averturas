-- Plantilla editable para el mensaje de WhatsApp al enviar un recibo al cliente
INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES

('recibo_cliente',
 'Recibo al cliente',
 E'Hola {{nombre}}, adjuntamos el comprobante de pago recibo *N° {{numero}}* por *{{monto}}*. ¡Muchas gracias! 🏠',
 '{{nombre}}, {{numero}}, {{monto}}'
)

ON CONFLICT (clave) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('20260711000001_mensaje_recibo.sql') ON CONFLICT DO NOTHING;
