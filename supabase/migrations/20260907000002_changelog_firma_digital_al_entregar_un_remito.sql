-- Changelog: Firma digital al entregar un remito
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Firma digital al entregar un remito', 'Al marcar un remito como entregado, ahora se puede capturar la firma de conformidad directamente desde el celular — mismo mecanismo ya usado en Visitas de Relevamiento de Datos. La firma queda guardada y visible en el detalle del remito.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260907000002_changelog_firma_digital_al_entregar_un_remito.sql') ON CONFLICT DO NOTHING;
