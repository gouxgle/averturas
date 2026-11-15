#!/bin/bash
# ============================================================
# deploy-env.sh — Deploy a test o producción desde la PC
#   bash deploy-env.sh test          → test
#   bash deploy-env.sh prod          → producción (pide "si"; -y para no preguntar)
#
# Cómo funciona (2026-11-14): la imagen se buildea ACÁ y viaja por un registro
# privado que corre en el VPS (contenedor "registry", solo en 127.0.0.1:5000),
# al que se llega por un túnel SSH. `docker push` sube solo las capas que
# cambiaron: un cambio de código son ~6 MB (frontend + backend), no los 450 MB
# de la imagen entera (Chromium y node_modules ya están allá). Test y prod usan
# la MISMA imagen (etiqueta = commit): prod no buildea nada, solo la baja.
# ============================================================
set -euo pipefail

ENV="${1:-}"; YES="${2:-}"
[[ "$ENV" =~ ^(test|prod)$ ]] || { echo "Uso: bash deploy-env.sh test|prod [-y]"; exit 1; }

HOST="179.43.120.103"; PORT="5912"; USER_SSH="root"
SSH="ssh -o BatchMode=yes -o ServerAliveInterval=15 -p ${PORT} ${USER_SSH}@${HOST}"
REG="127.0.0.1:5000"
LOCAL_REG_PORT=5000

if [ "$ENV" = "test" ]; then
  # Test vive en el mismo VPS que prod: nunca la base "postgres" ni el contenedor de prod.
  COMPOSE_DIR="/opt/docker/aberturas-test"; REPO_DIR="/opt/docker/aberturas-test/app"
  SERVICE="app"; CONTAINER="aberturas-test-app"; IMAGE="aberturas-app:test"
  DB_NAME="aberturas_test"; DB_USER="aberturas_test"
else
  COMPOSE_DIR="/opt/docker/cesarbritez"; REPO_DIR="/opt/docker/cesarbritez/aberturas"
  SERVICE="aberturas-app"; CONTAINER="aberturas-app"; IMAGE="aberturas-app:prod"
  DB_NAME="postgres"; DB_USER="postgres"
fi
if [ "$ENV" = "test" ] && { [ "$DB_NAME" = "postgres" ] || [ "$CONTAINER" = "aberturas-app" ]; }; then
  echo "❌ La config de test apunta a recursos de prod. Abortado."; exit 1
fi

T_INICIO=$(date +%s)
SHA=$(git rev-parse HEAD)
TAG="${REG}/aberturas-app:${SHA}"
echo "📋 $(git rev-parse --abbrev-ref HEAD) @ ${SHA:0:7} → ${ENV}"
[ -n "$(git status --porcelain)" ] && echo "⚠️  Hay cambios sin commitear: NO viajan (se deploya el commit)."

if [ "$ENV" = "prod" ] && [ "$YES" != "-y" ]; then
  read -rp "⚠️  Deploy a PRODUCCIÓN. Confirmar (si/N): " ok
  [[ "$ok" =~ ^(si|SI|Si)$ ]] || { echo "Cancelado."; exit 0; }
fi

git push -q origin HEAD:main

# ── Túnel al registro del VPS ────────────────────────────────
CTL=$(mktemp -u /tmp/deploy-ssh-XXXX)
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -M -S "$CTL" -fN \
  -L "${LOCAL_REG_PORT}:127.0.0.1:5000" -p "$PORT" "${USER_SSH}@${HOST}"
trap 'ssh -S "$CTL" -O exit x 2>/dev/null || true' EXIT

# ── Imagen: buildear y subir solo si ese commit no está en el registro ──
if curl -fs -o /dev/null -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
     -H 'Accept: application/vnd.oci.image.index.v1+json' "http://127.0.0.1:${LOCAL_REG_PORT}/v2/aberturas-app/manifests/${SHA}"; then
  echo "📦 La imagen de ${SHA:0:7} ya está en el registro (la usó el otro entorno): no se buildea."
else
  T0=$(date +%s)
  docker build -q -t "$TAG" --label "git.sha=${SHA}" \
    --build-arg "VITE_SENTRY_DSN=$(grep '^VITE_SENTRY_DSN=' .env 2>/dev/null | cut -d= -f2- || true)" \
    --build-arg "SRC_HASH=$(git rev-parse HEAD:src)" \
    --build-arg "SERVER_HASH=$(git rev-parse HEAD:server/src)" . > /dev/null
  echo "🔨 Build: $(( $(date +%s) - T0 ))s"
  T0=$(date +%s)
  docker push -q "$TAG" > /dev/null
  echo "📤 Subida (solo capas nuevas): $(( $(date +%s) - T0 ))s"
fi

# ── Servidor: backup (prod), código para migraciones, migraciones, imagen, reinicio ──
$SSH "ENV=$ENV SHA=$SHA TAG=$TAG IMAGE=$IMAGE COMPOSE_DIR=$COMPOSE_DIR REPO_DIR=$REPO_DIR SERVICE=$SERVICE CONTAINER=$CONTAINER DB_NAME=$DB_NAME DB_USER=$DB_USER bash -s" <<'REMOTE'
set -euo pipefail
if [ "$ENV" = "prod" ]; then
  B=/var/lib/docker-data/backups/aberturas_predeploy_$(date +%Y%m%d_%H%M%S).sql.gz
  docker exec aberturas-db pg_dump -U postgres -d postgres | gzip > "$B"
  [ "$(stat -c %s "$B")" -gt 100000 ] || { echo "❌ Backup sospechoso ($B). Abortado, nada tocado."; exit 1; }
  echo "💾 Backup: $B ($(du -h "$B" | cut -f1))"
  ls -1t /var/lib/docker-data/backups/aberturas_predeploy_*.sql.gz | tail -n +11 | xargs -r rm -f
fi

docker pull -q "$TAG" > /dev/null &   # baja la imagen mientras corren las migraciones
PULL=$!

cd "$REPO_DIR"
GIT_TERMINAL_PROMPT=0 git fetch -q origin main
git reset -q --hard "$SHA"

# -i solo con stdin propio: con bash -s, docker exec sin redirección se come el resto del script.
PSQL="docker exec -i aberturas-db psql -q -v ON_ERROR_STOP=1 -U $DB_USER -d $DB_NAME"
APLICADAS=$(docker exec aberturas-db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT filename FROM schema_migrations" < /dev/null)
N=0
for f in $(ls supabase/migrations/*.sql | sort); do
  n=$(basename "$f")
  grep -qFx "$n" <<< "$APLICADAS" && continue
  echo "  ⏳ $n"
  $PSQL < "$f"
  $PSQL <<< "INSERT INTO schema_migrations (filename) VALUES ('$n') ON CONFLICT DO NOTHING;"
  N=$((N + 1))
done
echo "🗄️  Migraciones nuevas: $N"

wait $PULL || { echo "❌ No se pudo bajar la imagen del registro. App sin tocar."; exit 1; }
docker tag "$TAG" "$IMAGE"
docker rmi "$TAG" > /dev/null 2>&1 || true

cd "$COMPOSE_DIR"
if [ "$(docker inspect "$CONTAINER" --format '{{index .Config.Labels "git.sha"}}' 2>/dev/null)" = "$SHA" ]; then
  echo "🚀 El contenedor ya corre ${SHA:0:7}: no se reinicia."
else
  docker compose up -d --no-build "$SERVICE" 2>&1 | grep -v -E 'Running|Waiting|Healthy' || true
  for i in $(seq 1 40); do
    docker exec "$CONTAINER" wget -qO- -T2 http://localhost:3000/api/pub/entorno > /dev/null 2>&1 && break
    [ "$i" -eq 40 ] && { echo "❌ La app no respondió. Logs:"; docker logs --tail 30 "$CONTAINER"; exit 1; }
    sleep 1
  done
  echo "🚀 App OK en $(docker inspect "$CONTAINER" --format '{{index .Config.Labels "git.sha"}}' | cut -c1-7)"
fi
docker image prune -f > /dev/null 2>&1 || true
curl -fsS -o /dev/null -m 5 http://127.0.0.1:3000 || echo "⚠️  Prod (127.0.0.1:3000) NO responde — revisar ya"
REMOTE

echo "✅ ${ENV} en ${SHA:0:7} — total $(( $(date +%s) - T_INICIO ))s"
