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
  # Se compara contra el commit horneado en la imagen que ESTÁ CORRIENDO (label
  # git.sha), no contra el git del servidor: un deploy que falló después del
  # `git reset` deja el git actualizado y el contenedor viejo, y el siguiente
  # intento creía que no había nada que buildear (pasó). Imagen sin label
  # (anterior a esto) → se buildea.
  REMOTE_HEAD=$(ssh -o BatchMode=yes -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" \
    "docker inspect ${TEST_APP_CONTAINER} --format '{{index .Config.Labels \"git.sha\"}}'" 2>/dev/null || echo "")
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
      --label "git.sha=${LOCAL_HEAD}" \
      --build-arg "VITE_SENTRY_DSN=${TEST_DSN}" \
      --build-arg "SRC_HASH=$(git rev-parse HEAD:src)" \
      --build-arg "SERVER_HASH=$(git rev-parse HEAD:server/src)" \
      . | tail -3
    echo -e "   build local: $(( $(date +%s) - T0 ))s"
    # La imagen queda etiquetada con el commit: el post-deploy lo verifica.
    docker image inspect aberturas-app:deploy-test > /dev/null

    echo -e "${BOLD}📦 Transfiriendo imagen a test...${NC}"
    # Subida REANUDABLE sin herramientas extra (no hay rsync en esta máquina y no
    # hay sudo): el .tar.gz se manda con `tail -c +offset | ssh 'cat >>'`, y si la
    # conexión se corta (pasó: 55 min y Broken pipe) el siguiente intento sigue
    # desde el byte donde quedó. Al final se compara el SHA-256 en ambos lados
    # antes de cargar nada. El archivo remoto lleva el commit en el nombre para
    # nunca reanudar sobre los restos de otra imagen.
    T0=$(date +%s)
    IMG_DIR=$(mktemp -d); IMG_GZ="$IMG_DIR/img.tar.gz"
    docker save aberturas-app:deploy-test | gzip -1 > "$IMG_GZ"
    LOCAL_SIZE=$(stat -c %s "$IMG_GZ"); LOCAL_SHA=$(sha256sum "$IMG_GZ" | cut -d' ' -f1)
    REMOTE_GZ="/var/tmp/aberturas-app-${LOCAL_HEAD:0:12}.tar.gz"
    SSH_T="ssh -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=8 -p ${TEST_PORT} ${TEST_USER}@${TEST_HOST}"
    echo "   imagen comprimida: $(( LOCAL_SIZE / 1048576 )) MB"
    SUBIDA_OK=0
    for intento in 1 2 3 4 5; do
      REMOTE_SIZE=$($SSH_T "stat -c %s '$REMOTE_GZ' 2>/dev/null || echo 0")
      if [ "$REMOTE_SIZE" -gt "$LOCAL_SIZE" ]; then $SSH_T "rm -f '$REMOTE_GZ'"; REMOTE_SIZE=0; fi
      if [ "$REMOTE_SIZE" -eq "$LOCAL_SIZE" ]; then SUBIDA_OK=1; break; fi
      [ "$intento" -gt 1 ] && echo "   reanudando desde $(( REMOTE_SIZE / 1048576 )) MB (intento $intento)..."
      tail -c +$(( REMOTE_SIZE + 1 )) "$IMG_GZ" | $SSH_T "cat >> '$REMOTE_GZ'" || true
      sleep 3
    done
    if [ "$SUBIDA_OK" -eq 1 ]; then
      REMOTE_SHA=$($SSH_T "sha256sum '$REMOTE_GZ' | cut -d' ' -f1")
      [ "$REMOTE_SHA" = "$LOCAL_SHA" ] || SUBIDA_OK=0
    fi
    rm -rf "$IMG_DIR"
    if [ "$SUBIDA_OK" -ne 1 ]; then
      echo -e "${RED}❌ No se pudo transferir la imagen íntegra. El servidor NO fue tocado.${NC}"
      $SSH_T "rm -f '$REMOTE_GZ'" || true
      exit 1
    fi
    echo -e "   transferencia: $(( $(date +%s) - T0 ))s · SHA-256 verificado"
    echo -e "${BOLD}📥 Cargando imagen en test...${NC}"
    $SSH_T "gunzip -c '$REMOTE_GZ' | docker load | tail -1 && docker image inspect aberturas-app:deploy-test > /dev/null && rm -f /var/tmp/aberturas-app-*.tar.gz /var/tmp/aberturas-app.tar" \
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
    echo "✅ App OK ($(( $(date +%s) - T0 ))s) · imagen git.sha=$(docker inspect aberturas-app --format '{{index .Config.Labels "git.sha"}}' | cut -c1-7)"
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
