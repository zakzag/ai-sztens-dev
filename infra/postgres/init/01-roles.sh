#!/bin/bash
# Callback Assistant — idempotent database bootstrap.
# Executed by the official postgres image on first initialization only.
#
# Environment variables are provided by docker-compose.yml (POSTGRES_* plus
# AISZTENS_DB_*, TKOVARI_DB_PASSWORD and KRAK_DB_PASSWORD). They are passed to
# psql as variables so no password is hard-coded in this file.

set -euo pipefail

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set aisztens_db_user="$AISZTENS_DB_USER" \
  --set aisztens_db_password="$AISZTENS_DB_PASSWORD" \
  --set tkovari_db_password="$TKOVARI_DB_PASSWORD" \
  --set krak_db_password="$KRAK_DB_PASSWORD" \
  --set postgres_db="$POSTGRES_DB" <<'EOSQL'
-- Application runtime role: owns and accesses the callback database.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'aisztens_db_user') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L',
                       :'aisztens_db_user', :'aisztens_db_password');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L',
                       :'aisztens_db_user', :'aisztens_db_password');
    END IF;
END
$$;

-- Human operator role: tkovari (owner).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tkovari') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L',
                       'tkovari', :'tkovari_db_password');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L',
                       'tkovari', :'tkovari_db_password');
    END IF;
END
$$;

-- Human operator role: krak (colleague).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'krak') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L',
                       'krak', :'krak_db_password');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L',
                       'krak', :'krak_db_password');
    END IF;
END
$$;

-- The application role owns the database; operators get access to it.
ALTER DATABASE :"postgres_db" OWNER TO :"aisztens_db_user";
GRANT CONNECT ON DATABASE :"postgres_db" TO tkovari, krak;
EOSQL
