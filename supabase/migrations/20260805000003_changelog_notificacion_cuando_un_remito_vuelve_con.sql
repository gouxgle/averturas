-- Changelog: Notificacion cuando un remito vuelve con observaciones
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Notificacion cuando un remito vuelve con observaciones', 'La campanita ahora avisa tambien cuando un cliente confirma la recepcion de un remito con observaciones o no conforme, igual que ya avisaba por aprobaciones de presupuesto.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260805000003_changelog_notificacion_cuando_un_remito_vuelve_con.sql') ON CONFLICT DO NOTHING;
