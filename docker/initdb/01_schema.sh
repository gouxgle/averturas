#!/bin/bash
# Inicialización automática de la DB en el primer arranque (data/db vacío).
# PostgreSQL ejecuta este script solo cuando el directorio de datos está vacío.
set -e

psql -U postgres -d postgres -f /migrations/20260414000001_schema.sql
psql -U postgres -d postgres -f /migrations/20260414000002_seed.sql
psql -U postgres -d postgres -f /migrations/20260415000001_clientes_documento.sql
psql -U postgres -d postgres -f /migrations/20260415000002_crm_clientes.sql
psql -U postgres -d postgres -f /migrations/20260419000001_clientes_genero.sql
psql -U postgres -d postgres -f /migrations/20260419000002_clientes_fidelizacion.sql
psql -U postgres -d postgres -f /migrations/20260420000001_clientes_telefono_fijo.sql
psql -U postgres -d postgres -f /migrations/20260420000002_productos_nuevos_campos.sql
psql -U postgres -d postgres -f /migrations/20260420000003_productos_caracteristicas.sql
psql -U postgres -d postgres -f /migrations/20260421000001_productos_medida_fields.sql
psql -U postgres -d postgres -f /migrations/20260421000002_presupuesto_campos.sql
psql -U postgres -d postgres -f /migrations/20260421000003_proveedores_campos.sql
psql -U postgres -d postgres -f /migrations/20260422000001_stock_module.sql
psql -U postgres -d postgres -f /migrations/20260422000002_remitos.sql
psql -U postgres -d postgres -f /migrations/20260423000001_atributos_jsonb.sql
psql -U postgres -d postgres -f /migrations/20260424000001_clientes_domicilio_obra.sql
psql -U postgres -d postgres -f /migrations/20260424000002_catalogo_atributos_schema.sql
psql -U postgres -d postgres -f /migrations/20260425000001_recibos.sql

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
  ('20260415000002_crm_clientes.sql'),
  ('20260419000001_clientes_genero.sql'),
  ('20260419000002_clientes_fidelizacion.sql'),
  ('20260420000001_clientes_telefono_fijo.sql'),
  ('20260420000002_productos_nuevos_campos.sql'),
  ('20260420000003_productos_caracteristicas.sql'),
  ('20260421000001_productos_medida_fields.sql'),
  ('20260421000002_presupuesto_campos.sql'),
  ('20260421000003_proveedores_campos.sql'),
  ('20260422000001_stock_module.sql'),
  ('20260422000002_remitos.sql'),
  ('20260423000001_atributos_jsonb.sql'),
  ('20260424000001_clientes_domicilio_obra.sql'),
  ('20260424000002_catalogo_atributos_schema.sql'),
  ('20260425000001_recibos.sql')
ON CONFLICT DO NOTHING;
SQL

echo "✅ Base de datos inicializada con todas las migraciones."
