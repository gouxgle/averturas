#!/bin/bash
# ===========================================
# Setup script - Supabase Self-Hosted (Averturas)
# Genera secretos, crea .env y actualiza kong.yml
# Uso: bash setup.sh [local|prod] [IP_VPS]
# ===========================================

MODE=${1:-local}
VPS_IP=${2:-localhost}

if [ -f ".env" ]; then
  echo "⚠ Ya existe un .env. Para regenerar, eliminalo primero."
  echo "  rm .env && bash setup.sh"
  exit 1
fi

echo "Generando secretos..."

# Generar secretos
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
SECRET_KEY_BASE=$(openssl rand -base64 96 | tr -dc 'a-zA-Z0-9' | head -c 80)

# Generar ANON_KEY (JWT con role: anon)
ANON_PAYLOAD=$(echo -n '{"role":"anon","iss":"supabase","iat":'"$(date +%s)"',"exp":'"$(($(date +%s) + 315360000))"'}' | base64 | tr -d '\n=' | tr '+/' '-_')
ANON_HEADER=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 | tr -d '\n=' | tr '+/' '-_')
ANON_SIGNATURE=$(echo -n "${ANON_HEADER}.${ANON_PAYLOAD}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 | tr -d '\n=' | tr '+/' '-_')
ANON_KEY="${ANON_HEADER}.${ANON_PAYLOAD}.${ANON_SIGNATURE}"

# Generar SERVICE_ROLE_KEY (JWT con role: service_role)
SVC_PAYLOAD=$(echo -n '{"role":"service_role","iss":"supabase","iat":'"$(date +%s)"',"exp":'"$(($(date +%s) + 315360000))"'}' | base64 | tr -d '\n=' | tr '+/' '-_')
SVC_HEADER=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 | tr -d '\n=' | tr '+/' '-_')
SVC_SIGNATURE=$(echo -n "${SVC_HEADER}.${SVC_PAYLOAD}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 | tr -d '\n=' | tr '+/' '-_')
SERVICE_ROLE_KEY="${SVC_HEADER}.${SVC_PAYLOAD}.${SVC_SIGNATURE}"

# Configurar URLs según modo
if [ "$MODE" = "prod" ]; then
  API_URL="http://${VPS_IP}:8000"
  SITE_URL_VAL="http://${VPS_IP}"
  ADDITIONAL_REDIRECTS="http://${VPS_IP},http://${VPS_IP}:8000"
  WEB_URL="http://${VPS_IP}"
else
  API_URL="http://localhost:8000"
  SITE_URL_VAL="http://localhost:5173"
  ADDITIONAL_REDIRECTS="http://localhost:5173,http://localhost:8080"
  WEB_URL="http://localhost:8080"
fi

# Crear .env
cat > .env <<EOF
############
# Secrets - NO COMMITEAR ESTE ARCHIVO
############

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SECRET_KEY_BASE=${SECRET_KEY_BASE}

############
# URLs
############

SUPABASE_PUBLIC_URL=${API_URL}
API_EXTERNAL_URL=${API_URL}
SITE_URL=${SITE_URL_VAL}
ADDITIONAL_REDIRECT_URLS=${ADDITIONAL_REDIRECTS}

############
# Auth Settings
############

DISABLE_SIGNUP=false
JWT_EXPIRY=3600
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

############
# SMTP (opcional si ENABLE_EMAIL_AUTOCONFIRM=true)
############

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_ADMIN_EMAIL=admin@averturas.local

MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

############
# Database
############

PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Web App
############

VITE_SUPABASE_URL=${API_URL}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}

############
# Misc
############

STUDIO_DEFAULT_ORGANIZATION=Averturas
STUDIO_DEFAULT_PROJECT=averturas-db
FUNCTIONS_VERIFY_JWT=false
IMGPROXY_ENABLE_WEBP_DETECTION=false
EOF

# Actualizar kong.yml con los tokens generados
KONG_FILE="volumes/kong/kong.yml"
if [ -f "$KONG_FILE" ]; then
  # Reemplazar tokens en kong.yml usando sed
  sed -i "s|key: ANON_KEY_PLACEHOLDER|key: ${ANON_KEY}|g" "$KONG_FILE"
  sed -i "s|key: SERVICE_ROLE_KEY_PLACEHOLDER|key: ${SERVICE_ROLE_KEY}|g" "$KONG_FILE"
  echo "✓ kong.yml actualizado con los tokens"
fi

# Crear directorios de volúmenes
mkdir -p volumes/db/data volumes/db/init volumes/storage volumes/functions
chmod -R 777 volumes/

echo ""
echo "✓ Archivo .env creado"
echo "✓ Directorios de volúmenes creados"
echo ""
echo "===================================="
echo "IMPORTANTE: Guardá estos datos"
echo "===================================="
echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
echo "JWT_SECRET:        ${JWT_SECRET}"
echo "ANON_KEY:          ${ANON_KEY}"
echo "SERVICE_ROLE_KEY:  ${SERVICE_ROLE_KEY}"
echo "===================================="
echo ""
echo "Para el frontend (.env.local):"
echo "VITE_SUPABASE_URL=${API_URL}"
echo "VITE_SUPABASE_ANON_KEY=${ANON_KEY}"
echo ""
if [ "$MODE" = "local" ]; then
  echo "Siguiente paso:"
  echo "  cd ../../  (raíz del proyecto)"
  echo "  docker compose up -d --build"
  echo "  (luego aplicar migraciones con: bash apply-migrations.sh)"
else
  echo "Siguiente paso:"
  echo "  docker compose up -d --build"
fi
