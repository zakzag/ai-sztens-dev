#!/bin/bash
# AIsztens — per-context schema bootstrap (AIS-35).
#
# Executed by the official postgres image from /docker-entrypoint-initdb.d
# AFTER 01-roles.sh (scripts run in lexicographic order) and — like every init
# script — ONLY on the first initialization of an empty `pgdata` volume. On an
# already initialized volume it does nothing; re-apply it manually:
#
#   docker compose --env-file infra/.env -f infra/docker-compose.yml \
#     exec -T postgres bash /docker-entrypoint-initdb.d/02-schemas.sh
#
# The script is idempotent: `CREATE SCHEMA IF NOT EXISTS` plus `\gexec`-driven
# GRANTs make repeated runs a no-op.
#
# WHY NO `DO $$ ... $$` BLOCK
# ---------------------------
# psql substitutes `:'var'` / `:"var"` lexically and does NOT interpolate
# inside dollar-quoted strings, so a `DO` block would receive the literal text
# `:'aisztens_db_user'`. See the header of 01-roles.sh for the original
# incident. Every statement below is therefore plain SQL (where interpolation
# works) or `\gexec` on a query that formats the DDL with psql variables.
#
# GRANT MATRIX (kept in sync with 01-roles.sh and
# docs/Specs/Infrastructure-Docker.md §6.2):
#
#   schema      aisztens (app)        tkovari (owner)   krak (operator)
#   platform    USAGE + CREATE        USAGE             USAGE
#   email       USAGE                 USAGE             USAGE
#
# Only the application role may create objects, and only in `platform`:
#   - `platform` — the Drizzle migration runner keeps its bookkeeping table
#     there (`platform.__drizzle_migrations`, configured in drizzle.config.ts)
#     and hosts the application tables created by migrations (AIS-39:
#     `platform.api_keys`).
# The two human operator roles keep USAGE so they can inspect data
# (`\dt`, `SELECT`) without being able to alter schemas.
#
# AIS-64 removed the `callback` context entirely (table, enum, schema), so the
# `callback` row that used to be here is gone. See
# docs/history/2026-10-21--15-45-00-ais-64-callback-removal.md.
#
# `tkovari` and `krak` are literal role names here, exactly as in
# 01-roles.sh. Renaming an operator role therefore means editing both files.
#
# Schema owners stay the bootstrap superuser ($POSTGRES_USER): no ownership is
# transferred, privileges are granted instead.

set -euo pipefail

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set aisztens_db_user="$AISZTENS_DB_USER" <<'EOSQL'
-- One schema per bounded context. The module boundary is also a DB boundary,
-- which is what lets the grants below stay coarse and stable.
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS email;

-- USAGE for the app role and both operator roles on every context schema.
-- The join on pg_namespace keeps the statement a no-op if a schema is missing
-- (e.g. when a single CREATE above is removed), so the file stays idempotent.
SELECT format('GRANT USAGE ON SCHEMA %I TO %I', s.nspname, r.rolname)
  FROM (VALUES ('platform'), ('email')) AS s(nspname)
  JOIN pg_namespace n ON n.nspname = s.nspname
  CROSS JOIN (VALUES (:'aisztens_db_user'), ('tkovari'), ('krak')) AS r(rolname)
\gexec

-- Object creation stays with the application role: `platform` holds the
-- Drizzle bookkeeping table (`platform.__drizzle_migrations`) and the
-- application tables created by migrations. Without this the migrator fails
-- with `permission denied for schema platform` on the first `db:migrate`.
SELECT format('GRANT CREATE ON SCHEMA %I TO %I', s.nspname, :'aisztens_db_user')
  FROM (VALUES ('platform')) AS s(nspname)
  JOIN pg_namespace n ON n.nspname = s.nspname
\gexec

\echo '[02-schemas] platform and email schemas and grants are in place.'
EOSQL
