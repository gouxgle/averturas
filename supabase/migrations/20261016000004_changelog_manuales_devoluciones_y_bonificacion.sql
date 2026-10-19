-- Changelog: Manuales de devoluciones, cambios, saldo a favor y bonificación
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Manuales: ciclo de vida de devoluciones, saldo a favor y bonificaciones', 'Los manuales de Devoluciones y de Presupuestos ahora explican el ciclo de vida completo: de la devolución a la plata (saldo a favor, dinero devuelto, cambio), casos completos paso a paso y cómo viaja una bonificación del presupuesto a la proforma y al recibo. Las ayudas rápidas también se actualizaron.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261016000004_changelog_manuales_devoluciones_y_bonificacion.sql') ON CONFLICT DO NOTHING;
