#!/bin/bash
# ============================================================
# Aberturas — Aplicar migraciones a una DB ya existente
# Usar cuando: hay migraciones nuevas y la DB ya tiene datos
# En deploy desde cero NO hace falta: las migraciones corren
# automáticamente al iniciar el contenedor de PostgreSQL.
# ============================================================
set -e

if [ ! -f ".env" ]; then
  echo "❌ No se encontró .env — ejecutar primero: bash setup.sh"
  exit 1
fi

source .env

echo "⏳ Esperando que la base de datos esté disponible..."
for i in $(seq 1 30); do
  if docker exec aberturas-db pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  echo "  ... intento $i/30"
  sleep 2
done

echo "📦 Aplicando migraciones..."
docker exec -i aberturas-db psql -U postgres -d postgres \
  < supabase/migrations/20260414000001_schema.sql

docker exec -i aberturas-db psql -U postgres -d postgres \
  < supabase/migrations/20260414000002_seed.sql

echo ""
echo "✅ Migraciones aplicadas."
echo ""
echo "   URL:         http://localhost:${APP_PORT:-3000}"
echo "   Email:       admin@aberturas.local"
echo "   Contraseña:  admin1234"
echo ""
echo "⚠️  Cambiá la contraseña del admin después del primer ingreso."
