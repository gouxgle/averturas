#!/bin/bash
# ============================================================
# Aberturas — Deploy en servidor de producción
# Ejecutar: bash /opt/docker/cesarbritez/deploy.sh
# ============================================================
set -e

# ── Rutas y nombres ─────────────────────────────────────────
APP_DIR="/opt/docker/cesarbritez/aberturas"   # git repo + docker-compose.yml
DB_CONTAINER="aberturas-db"                    # container_name explícito en compose
APP_CONTAINER="aberturas-app"                  # container_name explícito en compose
COMPOSE_SERVICE="app"                           # nombre del servicio dentro de docker-compose.yml

echo ""
echo "════════════════════════════════════════"
echo "  Aberturas — Deploy Producción"
echo "════════════════════════════════════════"

# ── 0. Swap — garantizar memoria para el build ───────────────
FREE_MB=$(free -m | awk '/^Mem:/{print $7}')
SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')
if [ "$FREE_MB" -lt 600 ] && [ "$SWAP_TOTAL" -eq 0 ]; then
  echo "⚠️  RAM: ${FREE_MB}MB libre — creando swap 2GB..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo "✅ Swap activo"
else
  echo "✅ Memoria OK (${FREE_MB}MB libre)"
fi

# ── 1. Git pull ───────────────────────────────────────────────
echo ""
echo "📥 Actualizando código..."
cd "$APP_DIR"

git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "  Ya en la última versión ($(git rev-parse --short HEAD))"
  echo "  ¿Forzar rebuild igual? (s/N)"
  read -r resp
  if [[ ! "$resp" =~ ^[sS]$ ]]; then
    echo "Nada que hacer."
    exit 0
  fi
else
  git pull origin main
  echo "  ✅ Actualizado → $(git rev-parse --short HEAD)"
fi

# ── 2. Migraciones ───────────────────────────────────────────
echo ""
echo "🗄️  Aplicando migraciones..."

# Crear tabla de tracking si no existe
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres > /dev/null <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

PENDIENTES=0
for file in $(ls "$APP_DIR/supabase/migrations/"*.sql | sort); do
  filename=$(basename "$file")
  applied=$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc \
    "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';" 2>/dev/null || echo "0")
  if [ "$applied" = "1" ]; then
    echo "  ✓  $filename"
  else
    echo "  ⏳ $filename — aplicando..."
    # Las migraciones ya incluyen el INSERT INTO schema_migrations al final
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$file"
    echo "  ✅ $filename"
    PENDIENTES=$((PENDIENTES + 1))
  fi
done

if [ "$PENDIENTES" -eq 0 ]; then
  echo "  DB al día, sin migraciones pendientes"
else
  echo "  ✅ $PENDIENTES migración(es) aplicada(s)"
fi

# ── 3. Build ──────────────────────────────────────────────────
echo ""
echo "🔨 Rebuildeando imagen..."
# docker compose corre desde APP_DIR donde está el docker-compose.yml
cd "$APP_DIR"
docker compose build "$COMPOSE_SERVICE"

# ── 4. Restart ────────────────────────────────────────────────
echo ""
echo "🚀 Reiniciando app..."
docker compose up -d --force-recreate "$COMPOSE_SERVICE"

# ── 5. Healthcheck ────────────────────────────────────────────
echo ""
echo "⏳ Esperando que la app levante..."
for i in $(seq 1 30); do
  if docker exec "$APP_CONTAINER" wget -qO- http://localhost:3000/api/auth/me > /dev/null 2>&1 || \
     docker exec "$APP_CONTAINER" wget -qO- http://localhost:3000 > /dev/null 2>&1; then
    echo "  ✅ App respondiendo"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "  ❌ App no respondió en 60s. Últimos logs:"
    docker compose logs "$COMPOSE_SERVICE" --tail=30
    exit 1
  fi
  sleep 2
done

# ── 6. Limpieza ───────────────────────────────────────────────
docker image prune -f > /dev/null
DISK_FREE=$(df -h / | awk 'NR==2{print $4}')

# ── 7. Resumen ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  ✅ Deploy completo"
echo "  Versión: $(git rev-parse --short HEAD)"
echo "  Disco libre: $DISK_FREE"
echo "  Logs en vivo: docker compose logs $COMPOSE_SERVICE -f"
echo "════════════════════════════════════════"
