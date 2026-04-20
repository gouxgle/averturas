#!/bin/bash
# ============================================================
# Aberturas — Migrador inteligente
# Aplica solo las migraciones pendientes, sin tocar datos existentes.
# Usar después de cada git pull para actualizar la DB en la VM.
#
# Uso:
#   bash migrate.sh
# ============================================================
set -e

if [ ! -f ".env" ]; then
  echo "❌ No se encontró .env — ejecutar primero: bash setup.sh"
  exit 1
fi

source .env

echo "⏳ Verificando conexión a la base de datos..."
for i in $(seq 1 20); do
  if docker exec aberturas-db pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  if [ $i -eq 20 ]; then
    echo "❌ No se pudo conectar a la base de datos. ¿Está corriendo docker compose up?"
    exit 1
  fi
  sleep 2
done

# ── 1. Crear tabla de tracking si no existe ───────────────────
docker exec -i aberturas-db psql -U postgres -d postgres <<'SQL' > /dev/null
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# ── 2. Auto-detectar migraciones ya aplicadas (para DBs sin tracking) ──
# Detecta el estado real de la DB y marca como aplicadas las migraciones
# que claramente ya corrieron (evita volver a correr CREATE TABLE, etc.)
docker exec -i aberturas-db psql -U postgres -d postgres <<'SQL' > /dev/null
DO $$
BEGIN
  -- Schema inicial (tablas principales)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clientes'
  ) THEN
    INSERT INTO schema_migrations (filename)
    VALUES ('20260414000001_schema.sql')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Seed inicial (tipos_abertura, sistemas, etc.)
  IF EXISTS (
    SELECT 1 FROM tipos_abertura LIMIT 1
  ) THEN
    INSERT INTO schema_migrations (filename)
    VALUES ('20260414000002_seed.sql')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Migración: tipo_persona + documento_nro
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'tipo_persona'
  ) THEN
    INSERT INTO schema_migrations (filename)
    VALUES ('20260415000001_clientes_documento.sql')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Migración: estado + tareas (CRM)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'estado'
  ) THEN
    INSERT INTO schema_migrations (filename)
    VALUES ('20260415000002_crm_clientes.sql')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
SQL

# ── 3. Aplicar migraciones pendientes en orden ────────────────
echo ""
echo "📋 Estado de migraciones:"
echo ""

PENDIENTES=0

for file in $(ls supabase/migrations/*.sql | sort); do
  filename=$(basename "$file")

  applied=$(docker exec aberturas-db psql -U postgres -d postgres -tAc \
    "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';" 2>/dev/null)

  if [ "$applied" = "1" ]; then
    echo "  ✓  $filename"
  else
    echo "  ⏳ $filename — aplicando..."
    docker exec -i aberturas-db psql -U postgres -d postgres < "$file"
    docker exec aberturas-db psql -U postgres -d postgres -c \
      "INSERT INTO schema_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;" > /dev/null
    echo "  ✅ $filename — aplicada"
    PENDIENTES=$((PENDIENTES + 1))
  fi
done

echo ""
if [ "$PENDIENTES" -eq 0 ]; then
  echo "✅ Base de datos al día. No había migraciones pendientes."
else
  echo "✅ $PENDIENTES migración(es) aplicada(s) correctamente."
fi
echo ""
