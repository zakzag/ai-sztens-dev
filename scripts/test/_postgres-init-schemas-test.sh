#!/usr/bin/env bash
# Offline-ish integration test for infra/postgres/init/01-roles.sh and
# 02-schemas.sh (AIS-35).
#
# The compose init scripts run ONLY on the first initialization of an empty
# pgdata volume, so the only honest way to test them is a throwaway container.
# This script starts one `postgres:16-alpine` with the init directory bind
# mounted (exactly like infra/docker-compose*.yml), waits for the entrypoint to
# finish, then
#
#   1. asserts the fresh-init result (three schemas + the grant matrix),
#   2. re-runs both init scripts twice to prove they are idempotent,
#   3. re-asserts the same expectations after the re-runs.
#
# Usage: bash scripts/test/_postgres-init-schemas-test.sh   (exit 0 = all pass)
# Override the image with POSTGRES_IMAGE=postgres:16.
# No host port is published; the container is removed on exit (trap).

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INIT_DIR="$REPO_DIR/infra/postgres/init"
IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"

DB_NAME="aisztens_db"
SUPERUSER="postgres"
SUPERUSER_PASSWORD="postgres_test_only"
APP_USER="aisztens"
APP_PASSWORD="aisztens_test_only"

pass=0
fail=0
ok()  { pass=$((pass + 1)); echo "PASS  $1"; }
bad() { fail=$((fail + 1)); echo "FAIL  $1"; shift; printf '      %s\n' "$@"; }

if ! command -v docker >/dev/null 2>&1; then
  echo "FAIL  docker is required to run the postgres init script test"
  exit 1
fi

for script in 01-roles.sh 02-schemas.sh; do
  if [ ! -f "$INIT_DIR/$script" ]; then
    echo "FAIL  missing init script: $INIT_DIR/$script"
    exit 1
  fi
done

cid=""
cleanup() {
  if [ -n "$cid" ]; then
    docker rm -f "$cid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Throwaway database
# ---------------------------------------------------------------------------

cid="$(docker run -d --rm \
  -e POSTGRES_DB="$DB_NAME" \
  -e POSTGRES_USER="$SUPERUSER" \
  -e POSTGRES_PASSWORD="$SUPERUSER_PASSWORD" \
  -e AISZTENS_DB_USER="$APP_USER" \
  -e AISZTENS_DB_PASSWORD="$APP_PASSWORD" \
  -e TKOVARI_DB_PASSWORD="tkovari_test_only" \
  -e KRAK_DB_PASSWORD="krak_test_only" \
  -v "$INIT_DIR:/docker-entrypoint-initdb.d:ro" \
  "$IMAGE")"

if [ -z "$cid" ]; then
  echo "FAIL  could not start the $IMAGE container"
  exit 1
fi

# The entrypoint runs 01-roles.sh and 02-schemas.sh itself on an empty data
# directory. It does that against a TEMPORARY server which it then shuts down
# and replaces with the real one, so `pg_isready` alone is a false positive:
# it answers during the init phase and the very next query can hit
# `FATAL: the database system is shutting down`.
#
# Readiness therefore requires both:
#   1. the entrypoint's completion marker in the logs ("PostgreSQL init
#      process complete") — the temp server is gone at that point, and
#   2. a successful real query — proves the final server is serving.
ready=0
for _ in $(seq 1 90); do
  if docker logs "$cid" 2>&1 | grep -q 'PostgreSQL init process complete'; then
    if docker exec "$cid" psql -U "$SUPERUSER" -d "$DB_NAME" -At -c 'SELECT 1' \
         >/dev/null 2>&1; then
      ready=1
      break
    fi
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null)" != "true" ]; then
    break
  fi
  sleep 1
done

if [ "$ready" != 1 ]; then
  bad "postgres finished first init and started serving" \
    "no successful query after the init completion marker (init scripts may have aborted)"
  echo "--- container logs ---"
  docker logs "$cid" 2>&1 | tail -n 40
  exit 1
fi
ok "postgres finished first init and started serving"

# psql_q <sql> -> single-line output, trimmed
psql_q() {
  docker exec "$cid" psql -U "$SUPERUSER" -d "$DB_NAME" -At -c "$1" 2>&1 | tr -d '\r'
}

# ---------------------------------------------------------------------------
# Assertions, reusable for the post-rerun pass
# ---------------------------------------------------------------------------

assert_schemas_present() {
  local label="$1" got
  # AIS-64 removed the `callback` context, so two schemas remain.
  got="$(psql_q "SELECT count(*) FROM pg_namespace WHERE nspname IN ('platform','email')")"
  [ "$got" = "2" ] && ok "$label: platform and email schemas exist" \
    || bad "$label: two schemas exist" "count=$got (expected 2)"
}

assert_usage() {
  local label="$1"
  local role got
  for role in aisztens tkovari krak; do
    got="$(psql_q "SELECT count(*) FROM (VALUES ('platform'),('email')) AS s(nspname) WHERE has_schema_privilege('$role', s.nspname, 'USAGE')")"
    [ "$got" = "2" ] && ok "$label: $role has USAGE on both schemas" \
      || bad "$label: $role has USAGE on both schemas" "count=$got (expected 2)"
  done
}

# Expected: CREATE only for the app role, and only in `platform` (the Drizzle
# bookkeeping table `platform.__drizzle_migrations` plus the tables created by
# migrations, e.g. `platform.api_keys`). AIS-64 removed the `callback` schema.
assert_create_privileges() {
  local label="$1" got schema role
  for schema in platform; do
    got="$(psql_q "SELECT has_schema_privilege('aisztens','$schema','CREATE')")"
    [ "$got" = "t" ] && ok "$label: aisztens may CREATE objects in $schema" \
      || bad "$label: aisztens may CREATE objects in $schema" "got=$got (expected t)"

    for role in tkovari krak; do
      got="$(psql_q "SELECT has_schema_privilege('$role','$schema','CREATE')")"
      [ "$got" = "f" ] && ok "$label: $role must NOT have CREATE on $schema" \
        || bad "$label: $role must NOT have CREATE on $schema" "got=$got (expected f)"
    done
  done
}

assert_roles_present() {
  local label="$1" got
  got="$(psql_q "SELECT count(*) FROM pg_roles WHERE rolname IN ('aisztens','tkovari','krak')")"
  [ "$got" = "3" ] && ok "$label: roles aisztens, tkovari, krak still exist" \
    || bad "$label: three roles exist" "count=$got (expected 3)"
}

# The smoke suite (lib/20-cross-service.sh) asserts the matrix with two
# aggregate queries. They are exercised here verbatim, so a typo in those
# quoted SQL one-liners fails in this fast, stack-less test instead of only in
# a live `pnpm test:stack` run.
assert_smoke_queries() {
  local label="$1" got
  got="$(psql_q "SELECT count(*) FROM (VALUES ('platform'),('email')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'USAGE')")"
  [ "$got" = "6" ] && ok "$label: smoke USAGE query returns 6" \
    || bad "$label: smoke USAGE query returns 6" "count=$got (expected 6)"

  got="$(psql_q "SELECT count(*) FROM (VALUES ('platform')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'CREATE')")"
  [ "$got" = "1" ] && ok "$label: smoke CREATE query returns 1" \
    || bad "$label: smoke CREATE query returns 1" "count=$got (expected 1)"
}

echo "--- fresh init (entrypoint) ---"
assert_schemas_present "fresh"
assert_usage "fresh"
assert_create_privileges "fresh"
assert_roles_present "fresh"
assert_smoke_queries "fresh"

# ---------------------------------------------------------------------------
# Idempotency: the same scripts, twice, on top of the initialized database
# ---------------------------------------------------------------------------

echo "--- re-run init scripts twice ---"
for round in 1 2; do
  for script in 01-roles.sh 02-schemas.sh; do
    if out="$(docker exec "$cid" bash "/docker-entrypoint-initdb.d/$script" 2>&1)"; then
      ok "re-run round $round: $script exits 0"
    else
      bad "re-run round $round: $script exits 0" "$out"
    fi
  done
done

echo "--- after re-runs ---"
assert_schemas_present "rerun"
assert_usage "rerun"
assert_create_privileges "rerun"
assert_roles_present "rerun"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo
echo "PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ]
