#!/bin/sh
# Runs ONCE, on the first start of an empty data directory (local-db layout).
# Creates the app role (no superuser, no CREATEDB) and the two databases it
# owns — Planner and Travel Content (ADR 0009, ADR 0013).
set -eu
: "${CNH_APP_PASSWORD:?set CNH_APP_PASSWORD in .env}"
psql -v ON_ERROR_STOP=1 -v pw="$CNH_APP_PASSWORD" --username "$POSTGRES_USER" --dbname postgres <<'SQL'
CREATE ROLE cnh_app LOGIN PASSWORD :'pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE cnh_planner OWNER cnh_app;
CREATE DATABASE cnh_content OWNER cnh_app;
SQL
