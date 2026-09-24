-- Changelog: Deshacer una aprobación
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Deshacer una aprobación', 'Si un presupuesto se aprobó por error (a mano o porque el cliente lo aceptó por el link), ahora se puede deshacer desde el botón Deshacer aprobación en el detalle. Vuelve al estado anterior. Solo funciona si todavía no se generó recibo, pedido al proveedor ni remito sobre ese presupuesto.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260924000002_changelog_deshacer_una_aprobacion.sql') ON CONFLICT DO NOTHING;
