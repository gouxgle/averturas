-- Changelog: Recibos por WhatsApp con PDF desde la lista y el detalle, elección obligatoria total/parcial, aviso de link visto y color libre de proveedor
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibos por WhatsApp con PDF desde la lista y el detalle, elección obligatoria total/parcial, aviso de link visto y color libre de proveedor', 'El botón de WhatsApp de la lista de recibos ahora adjunta el PDF (antes mandaba solo un texto) y el detalle del recibo tiene botón para enviarlo. Al crear un recibo hay que elegir explícitamente pago total o parcial. Presupuestos y remitos muestran si el cliente ya abrió el link. Los links públicos vencen a los 30 días. El color de cada proveedor se elige de la paleta completa.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260917000002_changelog_recibos_por_whatsapp_con_pdf_desde_la_li.sql') ON CONFLICT DO NOTHING;
