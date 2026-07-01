#!/bin/bash
# ============================================================
# deploy-env.sh — Deploy a test o producción desde local
# Uso:
#   bash deploy-env.sh          → menú interactivo
#   bash deploy-env.sh test     → directo a test
#   bash deploy-env.sh prod     → directo a producción
# ============================================================

set -e

# ── Config entornos ──────────────────────────────────────────
TEST_HOST="149.50.150.131"
TEST_USER="root"
TEST_DIR="/home/sistemas/claude/Aberturas"
TEST_COMPOSE_SERVICE="app"
TEST_APP_CONTAINER="aberturas-app"
TEST_DB_CONTAINER="aberturas-db"

PROD_HOST="179.43.120.103"
PROD_USER="root"
PROD_DEPLOY_SCRIPT="/opt/docker/cesarbritez/deploy.sh"

# ── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Selección de entorno ─────────────────────────────────────
ENV="${1:-}"

if [ -z "$ENV" ]; then
  echo ""
  echo -e "${BOLD}════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Aberturas — Deploy${NC}"
  echo -e "${BOLD}════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}1)${NC} Test   → ${TEST_HOST}"
  echo -e "  ${YELLOW}2)${NC} Prod   → ${PROD_HOST}  ${RED}[producción]${NC}"
  echo -e "  ${NC}q)${NC} Salir"
  echo ""
  read -rp "  Elegí entorno [1/2/q]: " choice
  case "$choice" in
    1) ENV="test" ;;
    2) ENV="prod" ;;
    q|Q) echo "Cancelado."; exit 0 ;;
    *) echo "Opción inválida."; exit 1 ;;
  esac
fi

# ── Mostrar estado git ────────────────────────────────────────
echo ""
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')

echo -e "${BOLD}📋 Estado git${NC}"
echo -e "   Rama:   ${CYAN}${BRANCH}${NC}"
echo -e "   Commit: ${COMMIT}"
if [ "$DIRTY" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  $DIRTY archivo(s) sin commitear${NC}"
  git status --short
fi
echo ""

# ── Confirmación para prod ────────────────────────────────────
if [ "$ENV" = "prod" ]; then
  echo -e "${RED}${BOLD}  ⚠️  ATENCIÓN: vas a deployar a PRODUCCIÓN${NC}"
  echo -e "  Host: ${PROD_HOST}"
  echo ""
  read -rp "  Confirmar deploy a PROD? (si/N): " confirm
  if [[ ! "$confirm" =~ ^(si|SI|Si)$ ]]; then
    echo "Cancelado."
    exit 0
  fi
fi

# ── Git push ─────────────────────────────────────────────────
echo -e "${BOLD}📤 Pusheando a GitHub...${NC}"
git push origin main
echo -e "${GREEN}   ✅ Push OK${NC}"
echo ""

# ── Deploy remoto ────────────────────────────────────────────
if [ "$ENV" = "prod" ]; then

  echo -e "${BOLD}🚀 Ejecutando deploy en PROD (${PROD_HOST})...${NC}"
  echo "────────────────────────────────────────"
  ssh "${PROD_USER}@${PROD_HOST}" "bash ${PROD_DEPLOY_SCRIPT}"

elif [ "$ENV" = "test" ]; then

  echo -e "${BOLD}🧪 Ejecutando deploy en TEST (${TEST_HOST})...${NC}"
  echo "────────────────────────────────────────"
  ssh "${TEST_USER}@${TEST_HOST}" bash << REMOTE
set -e
cd "${TEST_DIR}"

echo "📥 Git pull..."
git pull origin main
echo "✅ Código actualizado → \$(git rev-parse --short HEAD)"

echo ""
echo "🗄️  Verificando migraciones..."
docker exec -i ${TEST_DB_CONTAINER} psql -U postgres -d postgres > /dev/null <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

PENDIENTES=0
for file in \$(ls "${TEST_DIR}/supabase/migrations/"*.sql | sort); do
  filename=\$(basename "\$file")
  applied=\$(docker exec ${TEST_DB_CONTAINER} psql -U postgres -d postgres -tAc \
    "SELECT COUNT(*) FROM schema_migrations WHERE filename = '\$filename';" 2>/dev/null || echo "0")
  if [ "\$applied" = "1" ]; then
    echo "  ✓  \$filename"
  else
    echo "  ⏳ \$filename — aplicando..."
    docker exec -i ${TEST_DB_CONTAINER} psql -U postgres -d postgres < "\$file"
    echo "  ✅ \$filename"
    PENDIENTES=\$((PENDIENTES + 1))
  fi
done
[ "\$PENDIENTES" -eq 0 ] && echo "  DB al día" || echo "  ✅ \$PENDIENTES migración(es)"

echo ""
echo "🔨 Rebuildeando..."
docker compose build ${TEST_COMPOSE_SERVICE}

echo ""
echo "🚀 Reiniciando..."
docker compose up -d --force-recreate ${TEST_COMPOSE_SERVICE}

echo ""
echo "⏳ Verificando..."
sleep 4
if docker exec ${TEST_APP_CONTAINER} wget -qO- http://localhost:3000 > /dev/null 2>&1; then
  echo "✅ App OK"
else
  echo "⚠️  App tardando — revisá logs con: docker compose logs app -f"
fi

echo ""
echo "════════════════════════════"
echo "✅ Deploy test completo"
echo "Versión: \$(git rev-parse --short HEAD)"
echo "URL: http://${TEST_HOST}:3000"
echo "════════════════════════════"
REMOTE

fi

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Deploy completado${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
