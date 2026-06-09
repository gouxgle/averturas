#!/bin/bash
# ============================================================
# Aberturas — Deploy completo en VPS
# Uso: bash deploy.sh
# Hace: swap → git pull → migraciones → build → restart → healthcheck
# ============================================================
set -e

APP_URL="http://localhost:3000"
COMPOSE_SERVICE="app"

# ── 0. Swap — garantizar memoria suficiente para el build ─────
echo "🧠 Verificando memoria disponible..."
FREE_MB=$(free -m | awk '/^Mem:/{print $7}')
SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')

if [ "$FREE_MB" -lt 600 ] && [ "$SWAP_TOTAL" -eq 0 ]; then
  echo "⚠️  RAM libre: ${FREE_MB}MB — creando swapfile de 2GB..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "✅ Swap activo: $(free -h | awk '/^Swap:/{print $2}')"
elif [ "$FREE_MB" -lt 600 ]; then
  echo "⚠️  RAM libre: ${FREE_MB}MB — swap ya disponible: $(free -h | awk '/^Swap:/{print $2}')"
else
  echo "✅ RAM libre: ${FREE_MB}MB — OK"
fi

# ── 1. Código actualizado ─────────────────────────────────────
echo ""
echo "📥 Actualizando código..."
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ Ya en la última versión ($(git rev-parse --short HEAD))"
else
  # En producción no debe haber cambios locales; los descarta para no bloquear el pull
  git checkout -- .
  git pull origin main
  echo "✅ Actualizado a $(git rev-parse --short HEAD)"
fi

# ── 2. Migraciones ────────────────────────────────────────────
echo ""
echo "🗄️  Aplicando migraciones pendientes..."
bash migrate.sh

# ── 3. Build solo de la imagen app (no toca DB) ───────────────
echo ""
echo "🔨 Rebuildeando imagen..."
docker compose build $COMPOSE_SERVICE

# ── 4. Restart ────────────────────────────────────────────────
echo ""
echo "🚀 Reiniciando app..."
docker compose up -d --force-recreate $COMPOSE_SERVICE

# ── 5. Healthcheck ────────────────────────────────────────────
echo ""
echo "⏳ Esperando que la app levante..."
for i in $(seq 1 30); do
  if curl -sf "$APP_URL" > /dev/null 2>&1; then
    echo "✅ App respondiendo en $APP_URL"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ La app no respondió en 60 segundos. Últimos logs:"
    docker compose logs $COMPOSE_SERVICE --tail=30
    exit 1
  fi
  sleep 2
done

# ── 6. Resumen ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "✅ Deploy completo"
echo "   Versión: $(git rev-parse --short HEAD)"
echo "   App:     $APP_URL"
echo "   Logs:    docker compose logs $COMPOSE_SERVICE -f"
echo "════════════════════════════════════════"
