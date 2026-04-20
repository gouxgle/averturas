#!/bin/bash
# Actualiza la VM desde GitHub: código + DB + containers
set -e

echo "📥 Actualizando código..."
git pull

echo ""
echo "🗄️  Aplicando migraciones pendientes..."
bash migrate.sh

echo ""
echo "🔨 Rebuildeando imagen..."
docker compose build

echo ""
echo "🚀 Reiniciando app..."
docker compose up -d --force-recreate app

echo ""
echo "✅ Deploy completo. App disponible en http://localhost:3000"
