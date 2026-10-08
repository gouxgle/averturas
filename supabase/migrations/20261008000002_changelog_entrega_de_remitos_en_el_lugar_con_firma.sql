-- Changelog: Entrega de remitos en el lugar con firma del cliente
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Entrega de remitos en el lugar con firma del cliente', 'Desde el celular, en la casa del cliente: botón Entregar y firmar en cada remito pendiente, o Crear y entregar ahora al cargar uno nuevo. Se registra quién recibe (aclaración y DNI), la firma con el dedo y la hora; si estaba en borrador se emite en el mismo paso. Se puede entregar sin firma indicando el motivo (queda marcado Sin firma y se puede firmar después). La firma y los datos salen impresos en el remito.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261008000002_changelog_entrega_de_remitos_en_el_lugar_con_firma.sql') ON CONFLICT DO NOTHING;
