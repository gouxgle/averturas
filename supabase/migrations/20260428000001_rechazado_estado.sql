-- Agrega estado 'rechazado' al enum de operaciones
-- Flujo: enviado → rechazado → presupuesto (revisar y reenviar)
ALTER TYPE estado_operacion ADD VALUE IF NOT EXISTS 'rechazado';

INSERT INTO schema_migrations (filename)
VALUES ('20260428000001_rechazado_estado.sql')
ON CONFLICT DO NOTHING;
