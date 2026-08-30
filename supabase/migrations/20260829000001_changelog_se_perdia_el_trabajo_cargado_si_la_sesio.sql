-- Changelog: Se perdia el trabajo cargado si la sesion vencia
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Se perdia el trabajo cargado si la sesion vencia', 'Un chequeo automatico de notificaciones (cada 10 segundos) podia expulsar al usuario a la pantalla de login sin avisar si la sesion vencia, borrando de golpe todo lo que estaba sin guardar en una carga larga. Ahora eso ya no pasa, y ademas la carga de un presupuesto nuevo se guarda sola como borrador cada pocos segundos, para poder recuperarla si algo interrumpe la pagina.', 'fix');

INSERT INTO schema_migrations (filename) VALUES ('20260829000001_changelog_se_perdia_el_trabajo_cargado_si_la_sesio.sql') ON CONFLICT DO NOTHING;
