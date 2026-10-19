#!/usr/bin/env bash
# AIsztens — cross-service "do they see each other?" checks.
#
# These checks intentionally execute INSIDE the relevant containers and use
# service names (not 127.0.0.1) as hostnames. That proves the docker compose
# `internal` network actually resolves and routes between containers — which
# is the user's "see each other" requirement.
#
# Sourced by stack-smoke.sh after 10-services.sh. Depends on the helpers and
# counters defined in 00-prelude.sh.

# run_cross_service_checks
#
# Runs six checks:
#   1. DNS — `api` resolves from inside `caddy`
#   2. DNS — `postgres` resolves from inside `api`
#   3. caddy -> api — proxied HTTP request via the internal DNS name
#   4. api -> postgres — TCP connect to postgres:5432
#   5. postgres — required roles exist (proves init/01-roles.sh ran)
#   6. monitor -> api — same as the per-service check, restated for clarity
#
# No return value: counters are mutated in the parent scope.
run_cross_service_checks() {
  # -----------------------------------------------------------------------
  # 1. DNS: caddy can resolve `api`.
  # -----------------------------------------------------------------------
  # `getent hosts <name>` is a portable way to trigger libc's name service
  # switch (NSS). Inside a docker compose network the embedded DNS server
  # answers these; failure means the container is on a different network or
  # the service alias is broken.
  assert_service_out "caddy->dns" \
    "caddy resolves 'api' via internal DNS" \
    "api" \
    dc_exec caddy getent hosts api

  # -----------------------------------------------------------------------
  # 2. DNS: api can resolve `postgres`.
  # -----------------------------------------------------------------------
  assert_service_out "api->dns" \
    "api resolves 'postgres' via internal DNS" \
    "postgres" \
    dc_exec api getent hosts postgres

  # -----------------------------------------------------------------------
  # 3. caddy -> api — actual HTTP request through the internal network.
  # -----------------------------------------------------------------------
  # Hits the Fastify listener directly (not through the public reverse-proxy
  # site block, which would require a valid Host header). The default root
  # controller in apps/api/src/app.controller.ts returns the literal string
  # "Hello World!" — matching the unique substring is a strong
  # proof of end-to-end reach. The substring must be kept in sync with
  # [apps/api/src/app.service.ts:6] if the greeting ever changes.
  assert_service_out "caddy->api" \
    "caddy can GET http://api:3000/api" \
    "Hello World" \
    dc_exec caddy wget -qO- http://api:3000/api

  # -----------------------------------------------------------------------
  # 4. api -> postgres — raw TCP connect to port 5432.
  # -----------------------------------------------------------------------
  # We avoid psql because it is not installed in the api image. A bare TCP
  # connect proves the network path and that postgres is listening. exit 0
  # on connect, exit 1 on error. The /dev/tcp pseudo-device works in bash
  # but NOT in plain sh, which is why this file has `set -e` set by the
  # prelude and uses bash explicitly (see shebang on stack-smoke.sh).
  assert_service "api->postgres" \
    "api can TCP-connect to postgres:5432" \
    dc_exec api bash -c "exec 3<>/dev/tcp/postgres/5432 || exit 1; echo connected"

  # -----------------------------------------------------------------------
  # 5. postgres — required roles exist.
  # -----------------------------------------------------------------------
  # Verifies that infra/postgres/init/01-roles.sh ran successfully on first
  # startup. We expect exactly three rows: aisztens (app role), tkovari and
  # krak (operator roles). The query is wrapped in a single line so psql -tAc
  # returns one row per role.
  #
  # We pass -U because `docker compose exec` defaults to the image's
  # primary user (root for postgres:16-alpine), and psql authenticates
  # over the unix socket as that OS user. The `root` role does not exist
  # in postgres, so the call would return `FATAL: role "root" does not
  # exist`. Forcing -U to POSTGRES_USER (which the postgres image
  # initializes as a superuser) avoids that trap. This mirrors the
  # postgres healthcheck in [infra/docker-compose.yml:127].
  #
  # FLAG ORDER MATTERS. `-c` consumes the NEXT argv as its argument, so the
  # historical form `psql -tAc -U user "SQL"` made `-c` swallow `-U` and the
  # SQL text was sent as the username:
  #   FATAL: role "SELECT count(*) FROM pg_roles WHERE rolname IN ('aisztens','tko" does not exist
  # Keep `-U`/`-d` BEFORE the `-At -c` pair.
  #
  # The user/database names come from $ENV_FILE (infra/.env) via
  # resolve_env_value, so this check cannot drift from the compose config
  # (the old hard-coded `callback` did not exist on the droplet, whose
  # POSTGRES_DB is `aisztens_db`).
  assert_service_out "postgres-roles" \
    "roles aisztens, tkovari, krak exist" \
    "3" \
    dc_exec postgres psql \
      -U "$(resolve_env_value POSTGRES_USER postgres)" \
      -d "$(resolve_env_value POSTGRES_DB aisztens_db)" \
      -At -c "SELECT count(*) FROM pg_roles WHERE rolname IN ('aisztens','tkovari','krak')"

  # -----------------------------------------------------------------------
  # 5b. postgres — per-context schemas exist (AIS-35).
  # -----------------------------------------------------------------------
  # Proves that infra/postgres/init/02-schemas.sh ran on first startup. It
  # cannot distinguish "ran now" from "ran when the volume was created", so
  # the idempotent re-run path is covered by
  # scripts/test/_postgres-init-schemas-test.sh instead. Same -U/-d ordering
  # rule as the role check above.
  assert_service_out "postgres-schemas" \
    "schemas platform, callback, email exist" \
    "3" \
    dc_exec postgres psql \
      -U "$(resolve_env_value POSTGRES_USER postgres)" \
      -d "$(resolve_env_value POSTGRES_DB aisztens_db)" \
      -At -c "SELECT count(*) FROM pg_namespace WHERE nspname IN ('platform','callback','email')"

  # -----------------------------------------------------------------------
  # 5c. postgres — schema privileges (AIS-35).
  # -----------------------------------------------------------------------
  # Expected matrix: USAGE on all three schemas for aisztens, tkovari and krak
  # (3 schemas × 3 roles = 9 rows), and CREATE for the app role only, in
  # `callback` (it creates callback.callback_requests there) and in `platform`
  # (the Drizzle bookkeeping table platform.__drizzle_migrations). Losing
  # either grant breaks `db:migrate`, not just the smoke suite.
  assert_service_out "postgres-schema-usage" \
    "USAGE on all three schemas for aisztens, tkovari and krak" \
    "9" \
    dc_exec postgres psql \
      -U "$(resolve_env_value POSTGRES_USER postgres)" \
      -d "$(resolve_env_value POSTGRES_DB aisztens_db)" \
      -At -c "SELECT count(*) FROM (VALUES ('platform'),('callback'),('email')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'USAGE')"

  assert_service_out "postgres-schema-create" \
    "only aisztens may create objects, in callback and platform" \
    "2" \
    dc_exec postgres psql \
      -U "$(resolve_env_value POSTGRES_USER postgres)" \
      -d "$(resolve_env_value POSTGRES_DB aisztens_db)" \
      -At -c "SELECT count(*) FROM (VALUES ('callback'),('platform')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'CREATE')"

  # -----------------------------------------------------------------------
  # 6. monitor -> api — restated for symmetry with the per-service check.
  # -----------------------------------------------------------------------
  # We do not re-run the full log check here; a quick presence check on a
  # shorter tail is enough to confirm the monitor is actively polling the
  # API. This is the strongest "they see each other" signal in the suite
  # because the monitor is a separate process whose only reason to exist is
  # to call the API.
  assert_log_contains "monitor->api" \
    "monitor logged a recent API check (last 20 lines)" \
    "monitor" \
    "API check|API is reachable" \
    20
}
