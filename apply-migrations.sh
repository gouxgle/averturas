#!/bin/bash
# ============================================================
# Averturas — Aplicar migraciones y crear usuario admin
# Ejecutar después de: docker compose up -d --build
# ============================================================
set -e

if [ ! -f ".env" ]; then
  echo "❌ No se encontró .env — ejecutar primero: bash setup.sh"
  exit 1
fi

source .env

echo "⏳ Esperando que la base de datos esté disponible..."
for i in $(seq 1 30); do
  if docker exec averturas-db pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  echo "  ... intento $i/30"
  sleep 2
done

echo "📦 Aplicando migraciones..."
docker exec -i averturas-db psql -U postgres -d postgres \
  < supabase/migrations/20260414000001_schema.sql

docker exec -i averturas-db psql -U postgres -d postgres \
  < supabase/migrations/20260414000002_seed.sql

echo "👤 Creando usuario admin..."
ADMIN_PASS="${ADMIN_PASSWORD:-admin1234}"

HASH=$(docker exec averturas-app node -e "
  const b = require('bcryptjs');
  console.log(b.hashSync('${ADMIN_PASS}', 10));
" 2>/dev/null)

if [ -z "$HASH" ]; then
  echo "⚠️  No se pudo generar el hash."
  echo "   Asegurate de que 'docker compose up -d --build' haya terminado y volvé a intentar."
  exit 1
fi

docker exec -i averturas-db psql -U postgres -d postgres <<SQL
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Administrador', 'admin@averturas.local', '${HASH}', 'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
SQL

echo ""
echo "✅ Listo. Sistema configurado."
echo ""
echo "   URL:         http://localhost:${APP_PORT:-3000}"
echo "   Email:       admin@averturas.local"
echo "   Contraseña:  ${ADMIN_PASS}"
echo ""
echo "⚠️  Cambiá la contraseña del admin después del primer ingreso."
