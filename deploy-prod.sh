#!/bin/bash
# ============================================================
# Aberturas — Deploy a producción (cesarbritez.com.ar)
# Uso: bash deploy-prod.sh
# Requiere: acceso SSH configurado a la VM de producción
# ============================================================
set -e

PROD_HOST="179.43.120.103"
PROD_PORT="5912"
PROD_USER="root"
PROD_DEPLOY="/opt/docker/cesarbritez/deploy.sh"

echo "========================================"
echo "Deploy Aberturas → Producción"
echo "Host: $PROD_HOST"
echo "========================================"
echo ""

# Verificar que hay código para pushear
if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo "⚠️  Hay cambios sin commitear. ¿Querés continuar igual? (s/N)"
  read -r resp
  [[ "$resp" =~ ^[sS]$ ]] || exit 0
fi

# Conectar y ejecutar el deploy en el servidor
echo "Conectando a producción..."
ssh -p "$PROD_PORT" "$PROD_USER@$PROD_HOST" "bash $PROD_DEPLOY"
