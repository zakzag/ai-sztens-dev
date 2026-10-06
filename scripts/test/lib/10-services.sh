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
#   * log_info / log_section (from 00-prelude.sh)
#   * dc_exec, dc_logs
#   * PASS_COUNT / FAIL_COUNT counters

# resolve_webhook_check_env
#
# Fills in WEBHOOK_TARGET / VAPI_WEBHOOK_SECRET for checks 5+6 when the caller
# did not export them:
#   * VAPI_WEBHOOK_SECRET is read from $ENV_FILE (infra/.env) — the same value
#     the api container receives through the compose `environment:` block.
#   * WEBHOOK_TARGET is derived as `https://api.$DOMAIN` (DOMAIN also from
#     $ENV_FILE) but ONLY when a `caddy` container is part of the running
#     compose project: the local dev override disables Caddy
#     (`infra/docker-compose.local.yml`, `profiles: [never]`), so deriving a
#     target there would produce a guaranteed false failure.
#
# Exported so the curl sub-shells see them. No-op when the values already
# exist in the environment.
resolve_webhook_check_env() {
  if [ -z "${VAPI_WEBHOOK_SECRET:-}" ] && [ -f "${ENV_FILE:-}" ]; then
    VAPI_WEBHOOK_SECRET="$(grep -E '^VAPI_WEBHOOK_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    export VAPI_WEBHOOK_SECRET
  fi

  if [ -z "${WEBHOOK_TARGET:-}" ]; then
    if dc ps --format json 2>/dev/null | grep -q '"Service":"caddy"'; then
      local domain="${DOMAIN:-}"
      if [ -z "$domain" ] && [ -f "${ENV_FILE:-}" ]; then
        domain="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
      fi
      if [ -n "$domain" ]; then
        WEBHOOK_TARGET="https://api.${domain}"
        export WEBHOOK_TARGET
      fi
    fi
  fi
}

# run_service_checks
#
# Runs the six liveness checks in order:
#   1. api            — GET /api returns 200 from inside the container
#   2. postgres       — pg_isready succeeds
#   3. caddy          — admin API at :2019 responds
#   4. monitor        — at least one "API check" line in the logs
#   5. caddy vapi 405 — POST /api/vapi/webhooks/* without X-Vapi-Signature → 405
#   6. caddy vapi 200 — POST /api/vapi/webhooks/* with valid signature → 200
#
# Checks 5+6 exercise the dual-line VAPI defence documented in
# `docs/Specs/Caddy-Reverse-Proxy.md` §4.4:
#   - 405 is the Caddy @vapi_match pre-filter (header-only, edge-level)
#   - 200 is the NestJS VapiSignatureGuard (HMAC, second line)
# They need a reachable Caddy (WEBHOOK_TARGET) and the HMAC secret
# (VAPI_WEBHOOK_SECRET); `resolve_webhook_check_env` derives both from
# $ENV_FILE / the running compose project, and the checks are announced as
# skipped when the stack (or the operator) does not provide them. The runner
# needs `curl` and `openssl` on PATH.
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

  # -----------------------------------------------------------------------
  # 5. caddy vapi 405 — header-only pre-filter at the edge.
  # -----------------------------------------------------------------------
  # A POST /api/vapi/webhooks/* without X-Vapi-Signature must be dropped
  # by the Caddy @vapi_match named matcher with HTTP 405, BEFORE the
  # NestJS process is ever touched. This is the cheapest line of defence
  # and protects against obviously malformed traffic.
  resolve_webhook_check_env

  if [ -z "${WEBHOOK_TARGET:-}" ]; then
    log_info "Skipping VAPI webhook checks 5+6 (no WEBHOOK_TARGET: export it, e.g. https://api.<domain>)"
  else
    assert_service_out "caddy" \
      "POST /api/vapi/webhooks/* without signature → 405 (Caddy pre-filter)" \
      "405" \
      sh -c "curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X POST '${WEBHOOK_TARGET}/api/vapi/webhooks/end-of-call-report' -H 'Content-Type: application/json' -d '{}'"

    # ---------------------------------------------------------------------
    # 6. caddy vapi 200 — happy path with a valid HMAC signature.
    # ---------------------------------------------------------------------
    # Full POST with a freshly-computed signature reaches the NestJS guard
    # and is accepted. The HMAC is recomputed exactly as the guard does
    # (HMAC-SHA256 over "${ts}.${rawBody}"). If this check fails after
    # the 405 check passes, the suspect is the NestJS side (the `rawBody`
    # application option or signature parsing in vapi-signature.guard.ts),
    # not Caddy.
    if [ -n "${VAPI_WEBHOOK_SECRET:-}" ]; then
      local_body='{"message":{"id":"evt-smoke","type":"end-of-call-report"}}'
      local_ts="$(date +%s)"
      local_sig="$(printf '%s' "${local_ts}.${local_body}" | openssl dgst -sha256 -hmac "${VAPI_WEBHOOK_SECRET}" | sed 's/^.*= //')"
      assert_service_out "caddy" \
        "POST /api/vapi/webhooks/* with valid signature → 200 (NestJS guard accept)" \
        "200" \
        sh -c "curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X POST '${WEBHOOK_TARGET}/api/vapi/webhooks/end-of-call-report' -H 'Content-Type: application/json' -H 'X-Vapi-Timestamp: ${local_ts}' -H 'X-Vapi-Signature: sha256=${local_sig}' -d '${local_body}'"
    else
      log_info "Skipping check 6 (VAPI_WEBHOOK_SECRET not set and not found in ${ENV_FILE:-infra/.env})"
    fi
  fi
}
