-- Changelog: El resumen del presupuesto en Nuevo recibo muestra lo bonificado
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'El resumen del presupuesto en Nuevo recibo muestra lo bonificado', 'Cuando un recibo anterior tuvo bonificación, el resumen mostraba total, cobrado y saldo sin el descuento, y la cuenta parecía no cerrar. Ahora aparece la tarjeta Bonificado y la cuenta completa.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260917000003_changelog_el_resumen_del_presupuesto_en_nuevo_reci.sql') ON CONFLICT DO NOTHING;
