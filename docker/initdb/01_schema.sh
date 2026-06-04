#!/bin/bash
# Inicialización automática de la DB en el primer arranque (data/db vacío).
# PostgreSQL ejecuta este script solo cuando el directorio de datos está vacío.
# Auto-descubre todos los .sql en /migrations/ en orden — no editar al agregar migraciones.
set -e

MIGRATIONS_DIR="/migrations"

for file in $(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$file")
  echo "→ Aplicando: $filename"
  psql -U postgres -d postgres -f "$file"
done

echo "✅ Base de datos inicializada."
