#!/bin/bash
# AIsztens — idempotent database bootstrap.
# Executed by the official postgres image on first initialization only.
#
# Environment variables are provided by docker-compose.yml (POSTGRES_* plus
# AISZTENS_DB_*, TKOVARI_DB_PASSWORD and KRAK_DB_PASSWORD). They are passed to
# psql as variables so no password is hard-coded in this file.
#
# WHY THERE IS NO `DO $$ ... $$` BLOCK HERE
# -----------------------------------------
# psql performs `:'var'` / `:"var"` substitution lexically and does NOT
# interpolate inside dollar-quoted strings. A DO block therefore receives the
# literal text `:'aisztens_db_user'` and the server rejects it with
# `syntax error at or near ":"`. That is exactly how this file used to be
# written, which is why the aisztens/tkovari/krak roles were never created.
#
# Every statement below is therefore either plain SQL (interpolation works) or
# uses psql's `\gexec` to conditionally run DDL that still needs the variables
# interpolated. `\gexec` executes each row the preceding query returns as SQL,
# so `SELECT format(...) WHERE NOT EXISTS (...)` creates the role only when it
# is missing. The following `ALTER ROLE` then keeps the password in sync on
# every run, which makes the whole file idempotent.
#
# WHERE THE SCHEMA DDL LIVES
# --------------------------
# The per-context schemas (`platform`, `email`) are created by
# 02-schemas.sh, which the entrypoint runs after this file. The schema-level
# GRANT block at the end of this file is therefore a no-op on a fresh init and
# only takes effect when this file is re-applied to an already initialized
# volume (see docs/Specs/Infrastructure-Docker.md §6.2). It is guarded by
# `pg_namespace`, so the file stays idempotent and order-independent.
#
# Keep the GRANT matrix in sync with 02-schemas.sh.

set -euo pipefail

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set aisztens_db_user="$AISZTENS_DB_USER" \
  --set aisztens_db_password="$AISZTENS_DB_PASSWORD" \
  --set tkovari_db_password="$TKOVARI_DB_PASSWORD" \
  --set krak_db_password="$KRAK_DB_PASSWORD" \
  --set postgres_db="$POSTGRES_DB" <<'EOSQL'
-- Application runtime role: owns and accesses the application database.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L',
              :'aisztens_db_user', :'aisztens_db_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'aisztens_db_user')
\gexec
ALTER ROLE :"aisztens_db_user" WITH LOGIN PASSWORD :'aisztens_db_password';

-- Human operator role: tkovari (owner).
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'tkovari', :'tkovari_db_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tkovari')
\gexec
ALTER ROLE tkovari WITH LOGIN PASSWORD :'tkovari_db_password';

-- Human operator role: krak (colleague).
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'krak', :'krak_db_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'krak')
\gexec
ALTER ROLE krak WITH LOGIN PASSWORD :'krak_db_password';

-- The application role owns the database; operators get access to it.
ALTER DATABASE :"postgres_db" OWNER TO :"aisztens_db_user";
GRANT CONNECT ON DATABASE :"postgres_db" TO tkovari, krak;

-- Schema-level privileges (AIS-35, narrowed by AIS-64). Same matrix as
-- 02-schemas.sh:
--
--   schema      aisztens (app)        tkovari (owner)   krak (operator)
--   platform    USAGE + CREATE        USAGE             USAGE
--   email       USAGE                 USAGE             USAGE
--
-- The `callback` schema is gone (AIS-64): the whole call-back feature, its
-- tables and its admin/web pages were removed. New domain tables live in
-- `platform` (see `platform.api_keys`, AIS-39) and `email`.
--
-- The join on pg_namespace makes this a no-op when the schemas do not exist
-- yet, i.e. on a fresh init where 02-schemas.sh has not run.
SELECT format('GRANT USAGE ON SCHEMA %I TO %I', s.nspname, r.rolname)
  FROM (VALUES ('platform'), ('email')) AS s(nspname)
  JOIN pg_namespace n ON n.nspname = s.nspname
  CROSS JOIN (VALUES (:'aisztens_db_user'), ('tkovari'), ('krak')) AS r(rolname)
\gexec

-- Object creation stays with the application role: `platform` holds both the
-- Drizzle bookkeeping table and the application tables created by migrations.
SELECT format('GRANT CREATE ON SCHEMA %I TO %I', s.nspname, :'aisztens_db_user')
  FROM (VALUES ('platform')) AS s(nspname)
  JOIN pg_namespace n ON n.nspname = s.nspname
\gexec
EOSQL
