#!/bin/bash
# Aplica el schema y el seed en la primera inicialización de la DB.
# Este script corre automáticamente solo cuando data/db está vacío (primer deploy).
set -e
psql -U postgres -d postgres -f /migrations/20260414000001_schema.sql
psql -U postgres -d postgres -f /migrations/20260414000002_seed.sql
psql -U postgres -d postgres -f /migrations/20260415000001_clientes_documento.sql
