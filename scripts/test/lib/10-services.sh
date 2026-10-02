#!/usr/bin/env bash
# AIsztens — per-service liveness checks.
#
# Each check maps directly to one service in infra/docker-compose.yml and
# mirrors the healthcheck defined for that service. The goal is to fail in
# the same conditions compose considers unhealthy, but with much better
# diagnostics (the suite prints stderr/stdout and per-check pass/fail lines).
#
# Sourced by stack-smoke.sh after 00-prelude.sh. Depends on:
#   * assert_service, assert_service_out, assert_log_contains
#   * dc_exec, dc_logs
#   * PASS_COUNT / FAIL_COUNT counters

# run_service_checks
#
# Runs the four liveness checks in order:
#   1. api      — GET /api returns 200 from inside the container
#   2. postgres — pg_isready succeeds
#   3. caddy    — admin API at :2019 responds
#   4. monitor  — at least one "API check" line in the logs
#
# No return value: counters are mutated in the parent scope.
run_service_checks() {
  # -----------------------------------------------------------------------
  # 1. api — NestJS + Fastify root endpoint.
  # -----------------------------------------------------------------------
  # Use Node's built-in fetch (Node 18+) so we don't depend on curl being
  # installed inside the API image. Matches the existing compose healthcheck
  # command in infra/docker-compose.yml.
  assert_service_out "api" \
    "GET /api returns 200 (\"Hello World!\")" \
    "Hello World" \
    dc_exec api node -e "fetch('http://127.0.0.1:3000/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

  # -----------------------------------------------------------------------
  # 2. postgres — pg_isready inside the container.
  # -----------------------------------------------------------------------
  # We let compose interpolate the env vars from infra/.env. Note that
  # postgres only exposes the port on the `internal` network — we are
  # exec'ing INTO postgres itself, so localhost is the right host.
  assert_service "postgres" \
    "pg_isready -U postgres -d callback" \
    dc_exec postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-callback}"

  # -----------------------------------------------------------------------
  # 3. caddy — admin API on :2019.
  # -----------------------------------------------------------------------
  # The caddy image ships wget (busybox). The /config/ endpoint returns the
  # active Caddy config; any non-empty JSON response means the admin socket
  # is up and the reverse-proxy config has loaded.
  assert_service_out "caddy" \
    "admin API on :2019/config/ responds" \
    "apps" \
    dc_exec caddy wget -qO- http://127.0.0.1:2019/config/

  # -----------------------------------------------------------------------
  # 4. monitor — watchdog has ticked at least once.
  # -----------------------------------------------------------------------
  # The interval defaults to 30s, so on a freshly started stack we wait up
  # to ~40s before giving up. The log line emitted by watch.sh contains
  # either "API check failed" or "API is reachable" — match either.
  assert_log_contains "monitor" \
    "logged at least one tick (last 60 lines)" \
    "monitor" \
    "API check|API is reachable" \
    60
}
