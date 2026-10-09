# Milestone — VAPI webhook security + prod CORS cleanup

**Date:** 2026-10-02
**Branch:** `feat/vapi-webhook-security` (single combined PR)

## 1. Problem / feature

Inbound VAPI webhooks were completely unauthenticated: the
`VAPI_WEBHOOK_SECRET` env var was set on the droplet but no code read
it, the Caddy layer forwarded every `/api/vapi/*` shape to the NestJS
API regardless of method or origin, and the `CORS_ORIGINS` list still
contained `https://api.aisztens.hu` even though no SPA runs on that
origin. The only thing standing between VAPI and the public internet
was TLS termination — no request-level authentication, no replay
protection, no source enforcement.

## 2. Measured data / evidence

- Smoke `dc_exec api` against `GET /api/vapi/webhooks/anything` (pre-fix
  Caddyfile): HTTP 502 (no route in NestJS) — confirming the Caddy was
  forwarding unknown paths verbatim.
- `grep -r VAPI_WEBHOOK_SECRET apps/api/src`: zero references
  pre-change — the secret was defined and rotated, but never consumed.
- `infra/.env` line 21 (pre-change):
  `CORS_ORIGINS=https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu`
  — `api.aisztens.hu` had no SPA and therefore no bloat,
  CORS-allow-listing it was noise at best, a foot-gun at worst
  (browsers could be tricked into sending `Origin: https://api.aisztens.hu`
  if a future SPA landed there).

## 3. Root cause / design rationale

Two independent problems had to be fixed in one PR because the three
defensive layers are useless in isolation:

- **CORS** is browser-only; it has zero effect on curl / VAPI / any
  non-browser client. Adding `https://vapi.com` to `CORS_ORIGINS`
  would not authenticate VAPI — it would only let browsers on
  `vapi.com` call our API, which is a regression.
- **Caddy** can match on headers and methods, but not on HMACs of
  bodies (Caddy does not buffer bodies by default and should not).
  So Caddy can only be the header-only pre-filter.
- **NestJS** has access to the raw body (via Fastify's `rawBody: true`)
  and can do the HMAC verification properly. It is the only place the
  body-bound signature can be validated.

Failure mode policy:

- Missing / unconfigured `VAPI_WEBHOOK_SECRET` → **500** (fail closed:
  misconfiguration, not a client problem).
- Any client-side mismatch (wrong sig, stale ts, malformed header,
  bad hex, missing body) → **401** uniformly (no fingerprinting of
  why it failed).

Alternatives considered:

- IP allowlist at Caddy: rejected — VAPI does not publish stable IPs.
- vapi.com in `CORS_ORIGINS`: rejected — security regression, no
  functional benefit.
- Auth on `POST /api/callback-requests`: out of scope — the public
  form is intentionally anonymous in MVP (a `curl` workaround is
  trivial anyway, so CORS would not solve it).

## 4. Solution / implementation

A single combined PR (`feat/vapi-webhook-security`) was chosen over
three sequential PRs because the three layers (Caddy, NestJS guard,
CORS cleanup) are meaningless individually and create three
intermediate half-states on the production deploy. One PR, one
review, one atomic deploy.

| File | Change |
|---|---|
| `apps/api/src/vapi-webhooks/vapi-signature.guard.ts` | New HMAC-SHA256 guard over `${ts}.${rawBody}`, 300s tolerance, fail-closed on missing secret |
| `apps/api/src/vapi-webhooks/vapi-webhooks.controller.ts` | `POST /api/vapi/webhooks/tool-calls` + `end-of-call-report`, behind the guard |
| `apps/api/src/vapi-webhooks/vapi-webhooks.service.ts` | In-memory event store (mirrors CallbackRequestsService) |
| `apps/api/src/vapi-webhooks/vapi-webhooks.module.ts` | New module wired in `app.module.ts` |
| `apps/api/src/vapi-webhooks/dto/vapi-event.dto.ts` | Minimal envelope (plain TypeScript interface — **no Zod**, corrected 2026-10-06) |
| `apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts` | Unit tests: 11 cases incl. v1 prefix, tolerance, raw body missing |
| `apps/api/test/vapi-webhooks.e2e-spec.ts` | E2E: 200 + 401 (invalid) + 401 (missing) + 401 (stale) |
| `apps/api/src/main.ts` | `{ rawBody: true }` as a **Nest application** option (`FastifyAdapter` never accepted it — corrected 2026-10-06) |
| `apps/api/src/app.module.ts` | `VapiWebhooksModule` registration |
| `infra/caddy/Caddyfile` | `@vapi_match` named matcher (path + header + method) + 405 fallback |
| `infra/.env.example` + `infra/.env` | `CORS_ORIGINS` shortened to web + admin only; `VAPI_WEBHOOK_SECRET` rotation comment |
| `docs/Specs/Caddy-Reverse-Proxy.md` | §4.1 table updated, new §4.4 with mermaid + rotation command |
| `docs/Specs/Production-Runbook.md` | §4.4 curl examples: 405 edge, 200/401 HMAC round-trip |
| `scripts/test/lib/10-services.sh` | Two new checks: Caddy 405 pre-filter + NestJS 200 happy path |

## 5. Outcome and how to verify

After deploying (`./deploy.sh up`):

```bash
SECRET="$(grep VAPI_WEBHOOK_SECRET /opt/aisztens/infra/.env | cut -d= -f2)"
TS="$(date +%s)"
BODY='{"message":{"id":"evt-1","type":"end-of-call-report","call":{"id":"call-1"}}}'
SIG="$(printf '%s' "${TS}.${BODY}" | openssl dgst -sha256 -hmac "${SECRET}" | sed 's/^.*= //')"

# Expect 200
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" -H "X-Vapi-Timestamp: ${TS}" \
  -H "X-Vapi-Signature: sha256=${SIG}" -d "${BODY}"

# Expect 401 (invalid signature)
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" -H "X-Vapi-Timestamp: ${TS}" \
  -H "X-Vapi-Signature: sha256=deadbeef" -d "${BODY}"

# Expect 405 from Caddy (no header at all)
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" -d "${BODY}"

# Expect 200 + Access-Control-Allow-Origin: https://web.aisztens.hu
curl -i -H "Origin: https://web.aisztens.hu" \
  "https://api.aisztens.hu/api/callback-requests"

# Expect 200 + NO Access-Control-Allow-Origin header (api.aisztens.hu is no longer CORS-allowed)
curl -i -H "Origin: https://api.aisztens.hu" \
  "https://api.aisztens.hu/api/callback-requests"
```

Automated: `pnpm --filter @callback/api test` runs the unit tests
(in-process, no Docker); `pnpm --filter @callback/api test:e2e` runs
the e2e tests against the same Fastify bootstrap as production.
**Correction (2026-10-06):** at the time of writing neither command was
actually green — see section 7.

## 6. Follow-ups

- The VAPI payload Zod schema is currently `passthrough()` — verify
  the exact contract against the live VAPI docs at integration time
  and tighten the schema (especially around `tool-calls` argument
  shape and `end-of-call-report` summary fields).
- The business logic (assistant dispatch, status update, follow-up
  actions) lives in `VapiWebhooksService.record()` as a stub for now.
  A `VapiEventProcessorService` should consume events once Postgres
  persistence is wired in.
- If VAPI ever introduces a second signature scheme, the guard's
  `parseSignatureHeader` is the only place to extend; the rest of
  the code is scheme-agnostic.
- The 300 s default timestamp tolerance is conservative. If VAPI
  retry behaviour turns out to be slower, raise
  `VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC` in `infra/.env` (no rebuild
  required).

## 7. Correction — 2026-10-06 (superseded in part)

The change set described above was **never executed end-to-end**, and four
defects made the feature unusable. Full diagnosis, evidence and the fix:
[`docs/milestones/2026-10-06--12-45-00-vapi-webhook-runtime-fix.milestone.md`](2026-10-06--12-45-00-vapi-webhook-runtime-fix.milestone.md)
and its [history entry](../history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md).

| Claim in this milestone | Reality |
|---|---|
| `FastifyAdapter({ rawBody: true })` works | `rawBody` is a Nest *application* option; the adapter form does not compile and never captured the body |
| The guard verifies real webhooks | The guard required a `string` raw body; the adapter delivers a **Buffer** → every webhook would have got 401 |
| The module boots | `import type { ConfigService }` ⇒ `UnknownDependenciesException` at startup — the API could not start at all |
| `pnpm test:e2e` runs the e2e tests | The suites could not even load (Jest ESM + CommonJS-only `@nestjs/config`) |
| “Zod `passthrough()` schema” | No Zod anywhere; a plain TypeScript interface |
| Deployed and verified on the droplet | The droplet still runs the pre-VAPI image (`/api/vapi/*` → 404 from NestJS) |

What **did** hold up: the Caddy `@vapi_match` pre-filter (verified with
`caddy adapt`: one mutually-exclusive group, `/api/vapi/*` 405 before
`/api/*`), the HMAC scheme/tolerance/fail-closed policy, and the guard's
constant-time comparison.