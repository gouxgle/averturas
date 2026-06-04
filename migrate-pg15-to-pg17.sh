#!/bin/bash
# migrate-pg15-to-pg17.sh
# Migra PostgreSQL 15 → 17 en producción sin perder datos.
# Ejecutar desde el directorio del proyecto: bash migrate-pg15-to-pg17.sh

set -e

CONTAINER="aberturas-db"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_DIR="./backups/pg-migration"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/dump_pg15_${TIMESTAMP}.sql"

echo "=== Migración PostgreSQL 15 → 17 ==="
echo "Timestamp: ${TIMESTAMP}"
echo ""

# ── 1. Verificar que el contenedor PG15 esté corriendo ─────────────────────
echo "[1/7] Verificando contenedor PG15..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: Contenedor '${CONTAINER}' no está corriendo. Abortando."
  exit 1
fi

PG_VERSION=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT version();" | head -1)
echo "      Versión actual: ${PG_VERSION}"

# ── 2. Crear directorio de backups ──────────────────────────────────────────
echo "[2/7] Creando backup..."
mkdir -p "${BACKUP_DIR}"

docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${DUMP_FILE}"

DUMP_SIZE=$(wc -l < "${DUMP_FILE}")
if [ "${DUMP_SIZE}" -lt 100 ]; then
  echo "ERROR: Dump tiene solo ${DUMP_SIZE} líneas — parece vacío. Abortando."
  exit 1
fi
echo "      Dump guardado: ${DUMP_FILE} (${DUMP_SIZE} líneas)"

# Verificar tablas clave tienen datos
CLIENTES=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT COUNT(*) FROM clientes;" "${DB_NAME}")
OPERACIONES=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT COUNT(*) FROM operaciones;" "${DB_NAME}")
PROVEEDORES=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT COUNT(*) FROM proveedores;" "${DB_NAME}")
echo "      Clientes: ${CLIENTES} | Operaciones: ${OPERACIONES} | Proveedores: ${PROVEEDORES}"
echo ""
read -p "      ¿Los números son correctos? Continuar? [s/N]: " CONFIRM
if [[ "${CONFIRM}" != "s" && "${CONFIRM}" != "S" ]]; then
  echo "Abortado por el usuario."
  exit 0
fi

# ── 3. Bajar app (no la DB todavía) ────────────────────────────────────────
echo "[3/7] Bajando app (DB sigue corriendo)..."
docker compose stop app 2>/dev/null || true

# ── 4. Actualizar imagen en docker-compose.yml ─────────────────────────────
echo "[4/7] Actualizando imagen postgres:15-alpine → postgres:17-alpine..."
# Solo reemplaza la primera ocurrencia (el servicio db del proyecto)
sed -i '0,/image: postgres:15-alpine/s|image: postgres:15-alpine|image: postgres:17-alpine|' docker-compose.yml
grep "image: postgres" docker-compose.yml

# ── 5. Bajar DB y borrar data dir ──────────────────────────────────────────
echo "[5/7] Bajando DB y borrando data dir..."
docker compose stop db
docker compose rm -f db
rm -rf ./data/db/*
echo "      data/db/ limpio."

# ── 6. Levantar PG17 (init fresh + initdb scripts) ─────────────────────────
echo "[6/7] Levantando PG17..."
docker compose up -d db

echo "      Esperando que PG17 esté listo (incluye initdb scripts)..."
for i in $(seq 1 60); do
  if docker exec "${CONTAINER}" psql -U "${DB_USER}" -d template1 -tAc "SELECT 1;" > /dev/null 2>&1; then
    echo "      PG17 listo y aceptando queries en ${i}s."
    break
  fi
  sleep 2
  if [ "${i}" -eq 60 ]; then
    echo "ERROR: PG17 no respondió en 120s. Verificar logs:"
    docker compose logs db --tail=20
    exit 1
  fi
done

# Pausa extra para asegurar que initdb terminó completamente
sleep 5

# ── 7. Drop DB existente (initdb creó schema), recrear vacía, restaurar ────
echo "[7/7] Restaurando datos..."

docker exec "${CONTAINER}" psql -U "${DB_USER}" -d template1 \
  -c "DROP DATABASE ${DB_NAME} WITH (FORCE);" 2>/dev/null || true

docker exec "${CONTAINER}" psql -U "${DB_USER}" -d template1 \
  -c "CREATE DATABASE ${DB_NAME};"

docker exec -i "${CONTAINER}" psql -U "${DB_USER}" "${DB_NAME}" < "${DUMP_FILE}"

# ── Verificación final ──────────────────────────────────────────────────────
echo ""
echo "=== Verificación post-migración ==="
docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT version();" "${DB_NAME}"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT COUNT(*) || ' clientes' FROM clientes;" "${DB_NAME}"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT COUNT(*) || ' operaciones' FROM operaciones;" "${DB_NAME}"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -tAc "SELECT COUNT(*) || ' proveedores' FROM proveedores;" "${DB_NAME}"

echo ""
echo "=== Levantando app ==="
docker compose up -d --build app
docker compose logs app --tail=10

echo ""
echo "✓ Migración completa. Backup conservado en: ${DUMP_FILE}"
echo "  Commitear docker-compose.yml con la nueva imagen."
