-- Changelog: Avisos que no se pierden + rechazos de proforma notificados
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Avisos que no se pierden + rechazos de proforma notificados', 'Las novedades importantes (aprobación o rechazo de una proforma, devoluciones del cliente por el link, objeciones a un remito) ahora aparecen como un aviso que se queda en pantalla hasta que se lo acepta, sin bloquear el trabajo. Además, el rechazo de una proforma no generaba ninguna notificación: ahora sí. En Presupuestos, aprobado y rechazado se distinguen con mucho más contraste.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260915000011_changelog_avisos_que_no_se_pierden_rechazos_de_pro.sql') ON CONFLICT DO NOTHING;
