-- Fija el timezone de sesión de la base a Argentina (Formosa, UTC-3, sin horario de
-- verano). Sin esto, CURRENT_DATE/now()/DATE(created_at) usan UTC — cualquier registro
-- creado entre ~21:00 y 23:59 hora Formosa cae en el día UTC siguiente, y queda mal
-- clasificado como "de hoy" (dashboard ventas_hoy, vencimientos, remitos para_hoy, etc.)
-- Requiere reconectar (restart de la app) para que las conexiones tomen el nuevo default.
ALTER DATABASE postgres SET timezone TO 'America/Argentina/Buenos_Aires';

INSERT INTO schema_migrations (filename) VALUES ('20260725000003_timezone_argentina.sql')
  ON CONFLICT DO NOTHING;
