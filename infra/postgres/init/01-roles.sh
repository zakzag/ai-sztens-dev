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
EOSQL
