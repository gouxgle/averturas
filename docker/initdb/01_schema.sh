#!/bin/bash
# Inicialización automática de la DB en el primer arranque (data/db vacío).
# PostgreSQL ejecuta este script solo cuando el directorio de datos está vacío.
set -e

psql -U postgres -d postgres -f /migrations/20260414000001_schema.sql
psql -U postgres -d postgres -f /migrations/20260414000002_seed.sql
psql -U postgres -d postgres -f /migrations/20260415000001_clientes_documento.sql
psql -U postgres -d postgres -f /migrations/20260415000002_crm_clientes.sql

# Registrar todas las migraciones aplicadas en el tracking
psql -U postgres -d postgres <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (filename) VALUES
  ('20260414000001_schema.sql'),
  ('20260414000002_seed.sql'),
  ('20260415000001_clientes_documento.sql'),
  ('20260415000002_crm_clientes.sql')
ON CONFLICT DO NOTHING;
SQL

echo "✅ Base de datos inicializada con todas las migraciones."
