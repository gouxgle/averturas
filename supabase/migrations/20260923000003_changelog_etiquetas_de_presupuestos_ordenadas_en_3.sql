-- Changelog: Etiquetas de Presupuestos ordenadas en 3 niveles
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Etiquetas de Presupuestos ordenadas en 3 niveles', 'La fila de cada presupuesto ahora muestra primero el estado (una sola etiqueta sólida), después las señales que piden acción (falta enviar, respuesta del cliente, cobro, vencimiento, sin abrir, prioridad) y al final el rastro en gris (último contacto, visto, ediciones). Además se corrigieron etiquetas que mostraban el valor interno del sistema, como proforma_enviada, listo y entregado.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260923000003_changelog_etiquetas_de_presupuestos_ordenadas_en_3.sql') ON CONFLICT DO NOTHING;
