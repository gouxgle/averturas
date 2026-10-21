-- Changelog: Post venta: preguntarle al cliente cómo le fue
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Post venta: preguntarle al cliente cómo le fue', 'Nuevo módulo Post venta: unos días después de cada entrega aparece en una lista y en la Agenda del día para escribirle al cliente por WhatsApp. El mensaje se arma con una plantilla editable (Configuración → Mensajes), se revisa y se envía con un clic, e incluye un link a una encuesta corta (producto, entrega y atención, de 1 a 5). Las respuestas quedan guardadas y una nota baja avisa como cliente insatisfecho.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261021000005_changelog_post_venta_preguntarle_al_cliente_como_l.sql') ON CONFLICT DO NOTHING;
