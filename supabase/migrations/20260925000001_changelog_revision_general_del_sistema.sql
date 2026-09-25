-- Changelog: Revisión general del sistema
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Revisión general del sistema', 'Correcciones encontradas en una revisión completa: los recibos, remitos, pagos y recepciones cargados después de las 21 h ya no salen con la fecha de mañana; vuelve a poder marcarse un compromiso de pago como cumplido o incumplido (y eliminarlo) desde Estado de Cuenta con el link ''Ver compromisos''; guardar el objetivo de ventas en Reportes ya no borra los datos de la empresa; un link de presupuesto o remito cortado muestra el aviso de link inválido en vez de un error; después de enviar un recibo o remito por WhatsApp el botón lleva a su lista (antes decía ''Ver presupuestos''); y el orden por actividad en Estado de Cuenta deja últimos a los clientes sin compras.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260925000001_changelog_revision_general_del_sistema.sql') ON CONFLICT DO NOTHING;
