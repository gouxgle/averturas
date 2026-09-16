#!/bin/bash
# ============================================================
# deploy-env.sh — Deploy a test o producción desde local
# Uso:
#   bash deploy-env.sh          → menú interactivo
#   bash deploy-env.sh test     → directo a test
#   bash deploy-env.sh prod     → directo a producción
# ============================================================

set -e
set -o pipefail

# ── Config entornos ──────────────────────────────────────────
TEST_HOST="149.50.150.131"
TEST_PORT="5889"
TEST_USER="root"
TEST_DIR="/etc/docker/averturas"
TEST_COMPOSE_SERVICE="app"
TEST_APP_CONTAINER="aberturas-app"
TEST_DB_CONTAINER="aberturas-db"

PROD_HOST="179.43.120.103"
PROD_PORT="5912"
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
  ssh -p "${PROD_PORT}" "${PROD_USER}@${PROD_HOST}" "bash ${PROD_DEPLOY_SCRIPT}"

elif [ "$ENV" = "test" ]; then

  # ── Build LOCAL + transferencia de la imagen ──────────────────────────────
  # El servidor de test tiene 1.9 GB de RAM compartidos con ~11 contenedores
  # ajenos: buildear ahí colgaba la VPS entera (hasta sshd). Ahora la imagen se
  # construye acá, con el mismo Dockerfile, y viaja ya armada (~440 MB gzip,
  # ~2 min). El servidor solo la carga y la arranca. Fallback al build remoto:
  #   DEPLOY_BUILD_REMOTO=1 bash deploy-env.sh test
  REMOTE_HEAD=$(ssh -o BatchMode=yes -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" \
    "cd ${TEST_DIR} && git rev-parse HEAD" 2>/dev/null || echo "")
  LOCAL_HEAD=$(git rev-parse HEAD)
  NECESITA_BUILD=1
  if [ -n "$REMOTE_HEAD" ] && [ "$REMOTE_HEAD" != "$LOCAL_HEAD" ]; then
    CAMBIOS=$(git diff --name-only "$REMOTE_HEAD" "$LOCAL_HEAD" 2>/dev/null \
      | grep -vE '^(supabase/|tests/|docs?/|\.claude/|deploy.*\.sh$|.*\.md$|\.gitignore$)' || true)
    [ -z "$CAMBIOS" ] && NECESITA_BUILD=0
  fi

  SUBIR_IMAGEN=0
  if [ "$NECESITA_BUILD" -eq 1 ] && [ "${DEPLOY_BUILD_REMOTO:-0}" != "1" ]; then
    echo -e "${BOLD}🔨 Build local de la imagen para test...${NC}"
    # El DSN de Sentry se hornea en el bundle del frontend: se toma el del .env
    # del servidor para que la imagen sea idéntica a la que se buildearía allá.
    TEST_DSN=$(ssh -o BatchMode=yes -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" \
      "grep '^VITE_SENTRY_DSN=' ${TEST_DIR}/.env | cut -d= -f2-" 2>/dev/null || echo "")
    T0=$(date +%s)
    docker build -t aberturas-app:deploy-test \
      --build-arg "VITE_SENTRY_DSN=${TEST_DSN}" \
      --build-arg "SRC_HASH=$(git rev-parse HEAD:src)" \
      --build-arg "SERVER_HASH=$(git rev-parse HEAD:server/src)" \
      . | tail -3
    echo -e "   build local: $(( $(date +%s) - T0 ))s"
    # La imagen queda etiquetada con el commit: el post-deploy lo verifica.
    docker image inspect aberturas-app:deploy-test > /dev/null

    echo -e "${BOLD}📦 Transfiriendo imagen a test...${NC}"
    # rsync sobre un .tar sin comprimir, contra el .tar del deploy anterior que
    # queda en el servidor: el algoritmo delta manda solo los bloques que cambiaron
    # (las capas base — node, chromium, node_modules — son idénticas entre deploys),
    # --partial --inplace lo hace reanudable si se corta, y ServerAliveInterval
    # evita el "Broken pipe" en transferencias largas (pasó: 55 min y se cayó).
    # Antes: `docker save | gzip | ssh docker load`, 440 MB enteros cada vez y sin
    # reanudación.
    T0=$(date +%s)
    IMG_TAR="$(mktemp -d)/aberturas-app.tar"
    docker save aberturas-app:deploy-test -o "$IMG_TAR"
    echo "   tar local: $(du -h "$IMG_TAR" | cut -f1)"
    RSYNC_OK=0
    for intento in 1 2 3; do
      if rsync -a --partial --inplace --compress-level=1 -z --info=progress2 \
           -e "ssh -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=8 -p ${TEST_PORT}" \
           "$IMG_TAR" "${TEST_USER}@${TEST_HOST}:/var/tmp/aberturas-app.tar" 2>&1 | tail -1; then
        RSYNC_OK=1; break
      fi
      echo "   rsync cortado (intento $intento) — reanudando..."
      sleep 5
    done
    rm -rf "$(dirname "$IMG_TAR")"
    if [ "$RSYNC_OK" -ne 1 ]; then
      echo -e "${RED}❌ No se pudo transferir la imagen. El servidor NO fue tocado.${NC}"
      exit 1
    fi
    echo -e "   transferencia: $(( $(date +%s) - T0 ))s"
    echo -e "${BOLD}📥 Cargando imagen en test...${NC}"
    ssh -o BatchMode=yes -o ServerAliveInterval=15 -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" \
      "docker load -i /var/tmp/aberturas-app.tar | tail -1 && docker image inspect aberturas-app:deploy-test > /dev/null" \
      || { echo -e "${RED}❌ docker load falló en el servidor. El contenedor NO fue tocado.${NC}"; exit 1; }
    SUBIR_IMAGEN=1
  fi

  echo -e "${BOLD}🧪 Ejecutando deploy en TEST (${TEST_HOST})...${NC}"
  echo "────────────────────────────────────────"
  ssh -o BatchMode=yes -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" \
    "SUBIR_IMAGEN=${SUBIR_IMAGEN} NECESITA_BUILD=${NECESITA_BUILD} BUILD_REMOTO=${DEPLOY_BUILD_REMOTO:-0} bash -s" << 'REMOTE'
set -e
cd /etc/docker/averturas

echo "📥 Actualizando código..."
export GIT_TERMINAL_PROMPT=0
git fetch origin main
git reset --hard origin/main
echo "✅ Código actualizado → $(git rev-parse --short HEAD)"

echo ""
echo "🗄️  Verificando migraciones..."
docker exec -i aberturas-db psql -U postgres -d postgres > /dev/null <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL
APLICADAS=$(docker exec aberturas-db psql -U postgres -d postgres -tAc "SELECT filename FROM schema_migrations;")
PENDIENTES=0
for file in $(ls supabase/migrations/*.sql | sort); do
  filename=$(basename "$file")
  if ! echo "$APLICADAS" | grep -qFx "$filename"; then
    echo "  ⏳ $filename — aplicando..."
    docker exec -i aberturas-db psql -U postgres -d postgres < "$file"
    echo "  ✅ $filename"
    PENDIENTES=$((PENDIENTES + 1))
  fi
done
[ "$PENDIENTES" -eq 0 ] && echo "  DB al día ($(echo "$APLICADAS" | grep -c .) migraciones)" || echo "  ✅ $PENDIENTES migración(es) nueva(s)"

echo ""
if [ "$NECESITA_BUILD" -eq 0 ]; then
  echo "🔨 Sin cambios de código — se saltea el build (solo migraciones/docs)"
else
  if [ "$SUBIR_IMAGEN" -eq 1 ]; then
    echo "🔨 Usando la imagen buildeada localmente"
    docker tag aberturas-app:deploy-test aberturas-app:latest
    docker rmi aberturas-app:deploy-test > /dev/null 2>&1 || true
    docker compose up -d --no-build app
  else
    echo "🔨 Rebuildeando en el servidor (DEPLOY_BUILD_REMOTO=1)..."
    T0=$(date +%s)
    docker compose build app
    echo "   build: $(( $(date +%s) - T0 ))s"
    docker compose up -d app
  fi

  echo ""
  echo "⏳ Verificando..."
  T0=$(date +%s)
  OK=0
  for i in $(seq 1 30); do
    if docker exec aberturas-app wget -qO- -T2 http://localhost:3000 > /dev/null 2>&1; then
      OK=1; break
    fi
    sleep 1
  done
  if [ "$OK" -eq 1 ]; then
    echo "✅ App OK ($(( $(date +%s) - T0 ))s)"
  else
    echo "⚠️  La app no respondió en 30s — revisá: docker compose logs app -f"
    exit 1
  fi
  docker image prune -f > /dev/null 2>&1 || true
fi

echo ""
echo "════════════════════════════"
echo "✅ Deploy test completo"
echo "Versión: $(git rev-parse --short HEAD)"
echo "════════════════════════════"
REMOTE

fi

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Deploy completado${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
