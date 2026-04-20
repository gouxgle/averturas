# Aberturas — Sistema de gestión

Sistema CRM y de operaciones para negocio de venta e instalación de aberturas.
Stack: React + TypeScript + Vite + Tailwind + Supabase self-hosted + Docker.

## Funcionalidades

- **Presupuestos** — cotizaciones con selector desde catálogo, precios por m², validez con alertas
- **Operaciones** — seguimiento del ciclo completo: presupuesto → aprobado → producción → entregado
- **Clientes** — CRM con historial de interacciones, operaciones y valor total
- **Productos** — catálogo de aberturas con precios base (estándar, a medida, fabricación propia)
- **Dashboard** — estadísticas del mes, presupuestos pendientes, últimas operaciones

---

## Instalación desde cero

### Requisitos

- Docker + Docker Compose
- Git
- `openssl` (viene en Linux/Mac)

### Pasos

**1. Clonar el repositorio**

```bash
git clone git@github.com:gouxgle/aberturas.git
cd aberturas
```

**2. Generar secretos y configuración**

```bash
cd docker/supabase-selfhosted
bash setup.sh
# Para producción (VPS): bash setup.sh prod IP_DEL_VPS
cd ../..
```

El script genera:
- `.env` con POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
- Actualiza `volumes/kong/kong.yml` con los tokens JWT
- Crea los directorios necesarios

**3. Crear el `.env` principal (symlink)**

```bash
ln -s docker/supabase-selfhosted/.env .env
```

**4. Levantar todos los servicios**

```bash
docker compose up -d --build
```

Esto levanta: base de datos, Kong (API gateway), GoTrue (auth), PostgREST y el frontend.

**5. Inicializar la base de datos**

Esperar ~15 segundos a que la DB esté lista, luego crear los roles internos de Supabase:

```bash
source docker/supabase-selfhosted/.env

docker exec -i aberturas-db psql -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator NOINHERIT LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOINHERIT LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin NOINHERIT LOGIN; END IF;
END $$;
SQL

# Setear passwords con el valor generado
docker exec -i aberturas-db psql -U postgres -d postgres -c "
  ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE authenticator SET search_path = public, auth;
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;
  CREATE SCHEMA IF NOT EXISTS auth;
  ALTER SCHEMA auth OWNER TO supabase_auth_admin;
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
  ALTER ROLE supabase_auth_admin SET search_path = auth;
  GRANT CREATE ON SCHEMA public TO supabase_auth_admin;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
"
```

**6. Aplicar migraciones**

```bash
bash apply-migrations.sh
```

**7. Crear el primer usuario administrador**

```bash
source docker/supabase-selfhosted/.env

# Crear usuario en GoTrue
curl -s -X POST http://localhost:8001/auth/v1/admin/users \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aberturas.local","password":"Admin1234!","email_confirm":true}'

# Obtener el UUID del usuario recién creado
USER_ID=$(curl -s http://localhost:8001/auth/v1/admin/users \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | \
  python3 -c "import sys,json; users=json.load(sys.stdin)['users']; print(users[0]['id'])")

# Crear perfil
docker exec -i aberturas-db psql -U postgres -d postgres -c \
  "INSERT INTO public.profiles (id, nombre, email, role, activo) VALUES ('${USER_ID}', 'Admin', 'admin@aberturas.local', 'admin', true);"
```

---

## Acceso

| Servicio   | URL                        |
|------------|----------------------------|
| App web    | http://localhost:8082       |
| API (Kong) | http://localhost:8001       |
| PostgreSQL | localhost:5433              |

**Credenciales por defecto:**
- Email: `admin@aberturas.local`
- Contraseña: `Admin1234!` (cambiar después del primer login)

---

## Puertos

Aberturas usa puertos alternativos para no pisar otros servicios:

| Servicio   | Puerto |
|------------|--------|
| Web        | 8082   |
| Kong (API) | 8001   |
| PostgreSQL | 5433   |

Para cambiarlos editar `docker-compose.yml`.

---

## Desarrollo local

```bash
# Instalar dependencias
npm install --legacy-peer-deps

# Variables de entorno
cp .env.example .env.local
# Editar .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
# (los valores los muestra setup.sh al finalizar)

# Servidor de desarrollo
npm run dev
```

---

## Estructura

```
aberturas/
├── src/
│   ├── pages/          # Vistas principales
│   ├── components/     # Layout, componentes reutilizables
│   ├── hooks/          # useAuth
│   ├── integrations/   # Cliente Supabase
│   ├── lib/            # utils (cn, formatCurrency, formatDate)
│   └── types/          # TypeScript types
├── supabase/
│   └── migrations/     # SQL — schema y datos iniciales
├── docker/
│   └── supabase-selfhosted/
│       ├── setup.sh    # Genera secretos + configura kong.yml
│       └── volumes/    # Configuración de servicios
├── docker-compose.yml  # Orquestación completa
├── Dockerfile          # Build multi-stage React → nginx
└── nginx.conf          # SPA routing + cache headers
```
