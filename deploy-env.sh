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
# Test vive en el MISMO VPS que prod desde 2026-10-29 (test.cesarbritez.com.ar): app propia
# (/opt/docker/aberturas-test, contenedor aberturas-test-app en 127.0.0.1:3001) y base propia
# "aberturas_test" dentro del aberturas-db de prod, con un rol sin permisos sobre la base de prod.
# Todo lo que corre acá en test usa estas variables: nunca la base "postgres" ni aberturas-app.
TEST_HOST="179.43.120.103"
TEST_PORT="5912"
TEST_USER="root"
TEST_URL="https://test.cesarbritez.com.ar"
TEST_DIR="/opt/docker/aberturas-test"
TEST_APP_DIR="${TEST_DIR}/app"
TEST_IMAGE="aberturas-app:test"
TEST_APP_CONTAINER="aberturas-test-app"
TEST_DB_CONTAINER="aberturas-db"
TEST_DB_NAME="aberturas_test"
TEST_DB_USER="aberturas_test"

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
  echo -e "  ${CYAN}1)${NC} Test   → ${TEST_URL}"
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

  # Guardas: el servidor es el de prod, así que el deploy de test no puede apuntar
  # nunca a la base ni al contenedor de producción.
  if [ "$TEST_DB_NAME" = "postgres" ] || [ "$TEST_APP_CONTAINER" = "aberturas-app" ]; then
    echo -e "${RED}❌ La config de test apunta a recursos de prod. Abortado.${NC}"; exit 1
  fi

  # ── Build LOCAL + transferencia de la imagen ──────────────────────────────
  # Test corre en el VPS de prod (2 GB): buildear ahí le sacaría la memoria a
  # prod, así que la imagen se construye acá, con el mismo Dockerfile, y viaja
  # ya armada (~440 MB gzip). El servidor solo la carga y la arranca.
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
  if [ "$NECESITA_BUILD" -eq 1 ]; then
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

  echo -e "${BOLD}🧪 Ejecutando deploy en TEST (${TEST_URL})...${NC}"
  echo "────────────────────────────────────────"
  ssh -o BatchMode=yes -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" \
    "SUBIR_IMAGEN=${SUBIR_IMAGEN} NECESITA_BUILD=${NECESITA_BUILD} TEST_DIR=${TEST_DIR} TEST_APP_DIR=${TEST_APP_DIR} TEST_IMAGE=${TEST_IMAGE} APP=${TEST_APP_CONTAINER} DB=${TEST_DB_CONTAINER} DB_NAME=${TEST_DB_NAME} DB_USER=${TEST_DB_USER} bash -s" << 'REMOTE'
set -e
[ "$DB_NAME" = "postgres" ] && { echo "❌ DB_NAME=postgres es la base de prod. Abortado."; exit 1; }
PSQL="docker exec -i $DB psql -v ON_ERROR_STOP=1 -U $DB_USER -d $DB_NAME"
cd "$TEST_APP_DIR"

echo "📥 Actualizando código..."
export GIT_TERMINAL_PROMPT=0
git fetch origin main
git reset --hard origin/main
echo "✅ Código actualizado → $(git rev-parse --short HEAD)"

echo ""
echo "🗄️  Verificando migraciones ($DB_NAME)..."
$PSQL -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL
APLICADAS=$($PSQL -tAc "SELECT filename FROM schema_migrations;")
PENDIENTES=0
for file in $(ls supabase/migrations/*.sql | sort); do
  filename=$(basename "$file")
  if ! echo "$APLICADAS" | grep -qFx "$filename"; then
    echo "  ⏳ $filename — aplicando..."
    # ON_ERROR_STOP: una migración que falla corta el deploy y NO queda registrada.
    $PSQL < "$file"
    $PSQL -qc "INSERT INTO schema_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;"
    echo "  ✅ $filename"
    PENDIENTES=$((PENDIENTES + 1))
  fi
done
[ "$PENDIENTES" -eq 0 ] && echo "  DB al día ($(echo "$APLICADAS" | grep -c .) migraciones)" || echo "  ✅ $PENDIENTES migración(es) nueva(s)"

echo ""
cd "$TEST_DIR"
if [ "$NECESITA_BUILD" -eq 0 ]; then
  echo "🔨 Sin cambios de código — se saltea el build (solo migraciones/docs)"
else
  echo "🔨 Usando la imagen buildeada localmente"
  docker tag aberturas-app:deploy-test "$TEST_IMAGE"
  docker rmi aberturas-app:deploy-test > /dev/null 2>&1 || true
  docker compose up -d --no-build app

  echo ""
  echo "⏳ Verificando..."
  T0=$(date +%s)
  OK=0
  for i in $(seq 1 30); do
    if docker exec "$APP" wget -qO- -T2 http://localhost:3000 > /dev/null 2>&1; then
      OK=1; break
    fi
    sleep 1
  done
  if [ "$OK" -eq 1 ]; then
    echo "✅ App OK ($(( $(date +%s) - T0 ))s) · imagen git.sha=$(docker inspect "$APP" --format '{{index .Config.Labels "git.sha"}}' | cut -c1-7)"
  else
    echo "⚠️  La app no respondió en 30s — revisá: cd $TEST_DIR && docker compose logs app -f"
    exit 1
  fi
  docker image prune -f > /dev/null 2>&1 || true
fi

# Mismo servidor que prod: confirmar que producción sigue respondiendo.
if curl -fsS -o /dev/null -m 5 http://127.0.0.1:3000; then
  echo "✅ Prod sigue respondiendo (aberturas-app)"
else
  echo "⚠️  Prod (127.0.0.1:3000) NO respondió — revisar ya"
fi

echo ""
echo "════════════════════════════"
echo "✅ Deploy test completo"
echo "Versión: $(cd "$TEST_APP_DIR" && git rev-parse --short HEAD)"
echo "════════════════════════════"
REMOTE

fi

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Deploy completado${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
