#!/bin/bash
# Aplica las migraciones SQL al contenedor de la base de datos
# Uso: bash apply-migrations.sh

ENV_FILE="docker/supabase-selfhosted/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: No se encontró $ENV_FILE"
  echo "Primero corré: cd docker/supabase-selfhosted && bash setup.sh"
  exit 1
fi

source "$ENV_FILE"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "Error: POSTGRES_PASSWORD no está definido en $ENV_FILE"
  exit 1
fi

MIGRATIONS_DIR="supabase/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Error: No se encontró el directorio $MIGRATIONS_DIR"
  exit 1
fi

OK=0
ERRORS=0

for FILE in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  echo -n "Aplicando $(basename $FILE)... "
  docker exec -i averturas-db psql -U postgres -d postgres < "$FILE" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "OK"
    OK=$((OK + 1))
  else
    echo "ERROR"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "Migraciones: $OK OK, $ERRORS con errores"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "Para ver el error de una migración específica:"
  echo "  docker exec -i averturas-db psql -U postgres -d postgres < supabase/migrations/ARCHIVO.sql"
fi
