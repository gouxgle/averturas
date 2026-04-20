#!/bin/bash
# ============================================================
# Aberturas — Setup inicial
# Ejecutar UNA VEZ en el servidor antes de docker compose up
# ============================================================
set -e

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
  echo "⚠️  Ya existe un .env — salteando generación de secretos."
  echo "   Borrá el archivo y volvé a correr si querés regenerar."
  exit 0
fi

echo "🔧 Generando configuración..."

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)

cat > "$ENV_FILE" <<EOF
# Aberturas — Variables de entorno
# NO subir este archivo al repositorio

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}

# Puertos (cambiar si hay conflicto con otros servicios)
APP_PORT=3000
DB_PORT=5432
EOF

echo "✅ Archivo .env creado"
echo ""
echo "Próximos pasos:"
echo "  1. docker compose up -d --build"
echo "  2. Ingresar en http://localhost:\${APP_PORT:-3000}"
echo "     Email: admin@aberturas.local"
echo "     Contraseña: admin1234"
echo ""
echo "⚠️  Cambiá la contraseña del admin después del primer ingreso."
