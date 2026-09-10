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

  echo -e "${BOLD}🧪 Ejecutando deploy en TEST (${TEST_HOST})...${NC}"
  echo "────────────────────────────────────────"
  ssh -o BatchMode=yes -p "${TEST_PORT}" "${TEST_USER}@${TEST_HOST}" bash << REMOTE
set -e
cd "${TEST_DIR}"

echo "📥 Actualizando código..."
# fetch + reset (no "pull"/merge): si el directorio de deploy divergió de origin
# por el motivo que sea, "git pull" puede abrir un editor para un merge commit
# y quedar colgado esperando input que nunca llega por SSH no interactivo. Este
# directorio es un espejo de deploy, nunca debería tener commits propios.
export GIT_TERMINAL_PROMPT=0
ANTES=\$(git rev-parse HEAD)
git fetch origin main
git reset --hard origin/main
AHORA=\$(git rev-parse HEAD)
echo "✅ Código actualizado → \$(git rev-parse --short HEAD)"

# ¿Hace falta rebuildear? Solo si cambió algo que termina DENTRO de la imagen.
# Las migraciones, el changelog y los .md no la tocan: supabase/ y uploads/ son
# volúmenes montados desde el host. Un deploy de solo-changelog no tiene por qué
# pagar un build completo.
NECESITA_BUILD=1
if [ "\$ANTES" = "\$AHORA" ]; then
  # Nada nuevo: igual seguimos por si la imagen quedó a medias en un intento previo.
  CAMBIOS=""
else
  CAMBIOS=\$(git diff --name-only "\$ANTES" "\$AHORA" \
    | grep -vE '^(supabase/|tests/|docs?/|\.claude/|deploy.*\.sh$|.*\.md$|\.gitignore$)' || true)
  if [ -z "\$CAMBIOS" ]; then NECESITA_BUILD=0; fi
fi

echo ""
echo "🗄️  Verificando migraciones..."
docker exec -i ${TEST_DB_CONTAINER} psql -U postgres -d postgres > /dev/null <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# Una sola consulta para traer las ya aplicadas, en vez de un "docker exec" por
# cada archivo — con 100+ migraciones eso eran 100+ round-trips en cada deploy
# aunque no hubiera nada nuevo para aplicar.
APLICADAS=\$(docker exec ${TEST_DB_CONTAINER} psql -U postgres -d postgres -tAc "SELECT filename FROM schema_migrations;")

PENDIENTES=0
for file in \$(ls "${TEST_DIR}/supabase/migrations/"*.sql | sort); do
  filename=\$(basename "\$file")
  if ! echo "\$APLICADAS" | grep -qFx "\$filename"; then
    echo "  ⏳ \$filename — aplicando..."
    docker exec -i ${TEST_DB_CONTAINER} psql -U postgres -d postgres < "\$file"
    echo "  ✅ \$filename"
    PENDIENTES=\$((PENDIENTES + 1))
  fi
done
[ "\$PENDIENTES" -eq 0 ] && echo "  DB al día (\$(echo "\$APLICADAS" | grep -c .) migraciones)" || echo "  ✅ \$PENDIENTES migración(es) nueva(s)"

echo ""
if [ "\$NECESITA_BUILD" -eq 0 ]; then
  echo "🔨 Sin cambios de código — se saltea el build (solo migraciones/docs)"
else
  echo "🔨 Rebuildeando..."
  T0=\$(date +%s)
  docker compose build ${TEST_COMPOSE_SERVICE}
  echo "   build: \$(( \$(date +%s) - T0 ))s"

  echo ""
  echo "🚀 Reiniciando..."
  # Sin --force-recreate: compose recrea solo si la imagen o la config cambiaron.
  # Forzarlo siempre agregaba una recreación (y su corte de servicio) aun cuando
  # el contenedor ya estaba corriendo exactamente la misma imagen.
  docker compose up -d ${TEST_COMPOSE_SERVICE}

  echo ""
  echo "⏳ Verificando..."
  # Antes: sleep 4 fijo + un solo intento. Si la app tardaba un segundo más
  # imprimía "App tardando" con la app perfectamente sana (falsa alarma real),
  # y si arrancaba en 1s igual esperaba los 4. Ahora se sondea y se corta apenas
  # responde.
  T0=\$(date +%s)
  OK=0
  for i in \$(seq 1 30); do
    if docker exec ${TEST_APP_CONTAINER} wget -qO- -T2 http://localhost:3000 > /dev/null 2>&1; then
      OK=1; break
    fi
    sleep 1
  done
  if [ "\$OK" -eq 1 ]; then
    echo "✅ App OK (\$(( \$(date +%s) - T0 ))s)"
  else
    echo "⚠️  La app no respondió en 30s — revisá: docker compose logs app -f"
    exit 1
  fi
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
