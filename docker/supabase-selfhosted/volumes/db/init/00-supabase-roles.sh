#!/bin/bash
# Crea los roles internos que Supabase necesita.
# PostgreSQL ejecuta este script automáticamente la primera vez que el volumen está vacío.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

  -- Roles sin login (usados por RLS y PostgREST)
  DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT CREATEROLE;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
      CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_user') THEN
      CREATE ROLE dashboard_user NOLOGIN NOINHERIT;
    END IF;
  END \$\$;

  -- authenticator: rol de login que PostgREST y GoTrue usan para conectarse
  DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
      CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END \$\$;
  ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';

  -- authenticator puede cambiar a cualquiera de estos roles (SET ROLE)
  GRANT anon              TO authenticator;
  GRANT authenticated     TO authenticator;
  GRANT service_role      TO authenticator;
  GRANT supabase_auth_admin TO authenticator;

  -- Permisos sobre el schema public
  GRANT USAGE  ON SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL    ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL    ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;

  -- Permisos por defecto para tablas futuras
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES    TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;

  -- Schema de GoTrue (auth)
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

  -- Schema de Storage
  CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

EOSQL

echo "✓ Roles Supabase creados correctamente."
