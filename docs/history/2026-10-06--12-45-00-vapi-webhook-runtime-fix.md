# 2026-10-06 12:45 — VAPI webhook runtime fix (guard DI, `rawBody`, tests, smoke wiring)

**Scope:** review + repair of the uncommitted VAPI webhook slice (`apps/api/src/vapi-webhooks/`,
`apps/api/src/main.ts`, `apps/api/test/`, `scripts/test/lib/10-services.sh`).
**Milestone:** [`docs/milestones/2026-10-06--12-45-00-vapi-webhook-runtime-fix.milestone.md`](../milestones/2026-10-06--12-45-00-vapi-webhook-runtime-fix.milestone.md)
**Supersedes the claims of:** [`docs/history/2026-10-02--19-09-30-vapi-webhook-security.md`](2026-10-02--19-09-30-vapi-webhook-security.md)

Nothing was committed; the working tree carries the whole change set.

## 1. What the audit found (measured, not inferred)

The VAPI slice had **never been executed**, and its three defects each independently made the
feature unusable:

| # | Defect | Evidence |
|---|---|---|
| 1 | `VapiSignatureGuard` injected `ConfigService` through `import type`, so `emitDecoratorMetadata` emitted `design:paramtypes = [Function]` | `UnknownDependenciesException: Nest can't resolve dependencies of the VapiSignatureGuard (?)` on `NestFactory.create(...)` — the whole API refused to boot, and `app.module.ts` already imported the module |
| 2 | `rawBody: true` was passed to `new FastifyAdapter(...)`, where the option does not exist | `tsc --noEmit` → 2 × `TS2353 … 'rawBody' does not exist in type FastifyAdapterBaseOptions` ⇒ `nest build` (and therefore the image build) failed; Nest reads the flag from the **application** options (`@nestjs/core/nest-application.js`) |
| 3 | The adapter always parses with `parseAs: 'buffer'`, so `request.rawBody` is a **Buffer**, while the guard required `typeof rawBody === 'string'` | every genuine webhook would have answered 401 “raw body missing” |
| 4 | `scripts/test/lib/10-services.sh` announced its skips with `log "…"`, but `log()` does not exist in the smoke suite (only `log_info`/`log_pass`/`log_fail`/`log_section`) | verified on the droplet: `log: command not found`, exit 127 ⇒ under `set -euo pipefail` the suite aborted after check 4 and `20-cross-service.sh` never ran |
| 5 | `WEBHOOK_TARGET` / `VAPI_WEBHOOK_SECRET` were read but never set ⇒ checks 5+6 were unreachable dead code | repo-wide grep; the docstring claimed they arrive “via env-prelude” |
| 6 | `app-env.spec.ts` used the CommonJS `jest` global + `require()` under an ESM ts-jest preset | 9/9 tests failed with `ReferenceError: jest is not defined` (the earlier note “Jest is broken in this workspace” was wrong — only that one suite was) |
| 7 | Docs described a “Zod `passthrough()` schema” (DTO is a plain interface) and claimed `pnpm test:e2e` ran the e2e suites (they could not even load) | [`docs/history/2026-10-02--19-09-30-vapi-webhook-security.md`](2026-10-02--19-09-30-vapi-webhook-security.md), the 2026-10-02 milestone |

Also measured: the deployed droplet still proxies `/api/vapi/*` verbatim
(`POST/GET https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report` → **404 from NestJS**,
api uptime ≈ 6.8 days), i.e. neither the Caddyfile change nor the module has ever been live.

Verified as **correct** and left alone: the Caddy `@vapi_match` pre-filter. `caddy adapt`
(caddy:2-alpine) sorts the four `handle` blocks into one mutually-exclusive group as
`@vapi_match` → `/api/vapi/*` 405 → `/healthz` → `/api/*`, so an unsigned POST really is dropped
with 405 at the edge.

## 2. Changed files

| File | Change |
|---|---|
| [`apps/api/src/vapi-webhooks/vapi-webhook-config.ts`](../../apps/api/src/vapi-webhooks/vapi-webhook-config.ts) | **New.** `VAPI_WEBHOOK_CONFIG` symbol token, `VapiWebhookConfig` interface, pure `readVapiWebhookConfig(env)` reader and the `FactoryProvider` that binds them. Keeps the VAPI context free of `@nestjs/config` (which is CommonJS-only and unloadable in Jest's ESM runner on Node < 24.9) and removes the per-request `config.get()` |
| [`apps/api/src/vapi-webhooks/vapi-signature.guard.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.ts) | Injects the config token via `@Inject` (no metadata dependency); accepts Buffer **and** string raw bodies (`rawBodyToString()`); tolerance comes from the injected config |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.module.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.module.ts) | Registers `vapiWebhookConfigProvider`; docblock explains why the token is registered here |
| [`apps/api/src/main.ts`](../../apps/api/src/main.ts) | `NestFactory.create(AppModule, new FastifyAdapter(), { rawBody: true })` + a comment explaining the Nest-application-option contract |
| [`apps/api/src/config/app-env.ts`](../../apps/api/src/config/app-env.ts) | Exports the pure `normaliseAppEnv()`; normalisation now trims and lower-cases (so `Production` cannot silently fall back to dev) |
| [`apps/api/src/config/app-env.spec.ts`](../../apps/api/src/config/app-env.spec.ts) | Rewritten ESM-safe (no `jest.resetModules`, no `require`); 9 failing tests → green, with extra alias/whitespace cases |
| [`apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts) | 17 cases, incl. the Buffer raw body (the regression that the old suite missed), list-valued headers, invalid tolerance, non-string/non-Buffer raw body |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.service.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.service.spec.ts) | **New.** Store behaviour incl. the documented absence of `message.id` de-duplication |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.controller.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.controller.spec.ts) | **New.** Delegation to the service with a hand-rolled fake |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.module.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.module.spec.ts) | **New.** DI regression test: compiles the real module and resolves guard/controller/service/config token |
| [`apps/api/src/vapi-webhooks/vapi-webhook-config.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-webhook-config.spec.ts) | **New.** Pure reader + provider binding |
| [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts) | Rewritten: mirrors `main.ts` (`rawBody` application option, prefix, ValidationPipe) with 11 cases, incl. “raw body capture disabled → 401” and a tampered-payload case signed over the original bytes |
| [`apps/api/test/app-boot.e2e-spec.ts`](../../apps/api/test/app-boot.e2e-spec.ts) | **New.** Boots the real `AppModule` and asserts the webhook route is mounted (self-skips with a warning on Node < 24.9) |
| [`apps/api/test/lib/app-module-gate.ts`](../../apps/api/test/lib/app-module-gate.ts) | **New.** Shared gate documenting why `@nestjs/config` cannot be loaded by Jest's ESM runner on Node < 24.9 |
| [`apps/api/test/app.e2e-spec.ts`](../../apps/api/test/app.e2e-spec.ts), [`apps/api/test/health.e2e-spec.ts`](../../apps/api/test/health.e2e-spec.ts) | Use the gate (dynamic `AppModule` import + loud skip) so the suite loads on every runtime |
| [`scripts/test/lib/10-services.sh`](../../scripts/test/lib/10-services.sh) | `log` → `log_info`; new `resolve_webhook_check_env()` derives `WEBHOOK_TARGET=https://api.$DOMAIN` (only when a `caddy` container is running) and `VAPI_WEBHOOK_SECRET` from `$ENV_FILE`; curl hardened with `--max-time 10 -sS` |
| [`.gitattributes`](../../.gitattributes) | **New.** `*.sh text eol=lf` (CRLF makes bash fail with ``syntax error near unexpected token `$'\r''``; the smoke/deploy scripts run under bash on WSL and on the droplet) |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md), [`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md) | §4.4 refreshed: config token instead of `ConfigService`, the Buffer raw body, the automated smoke checks, and the “not deployed yet” status |

Working-tree line endings: the `scripts/**/*.sh` files were converted from CRLF to LF on disk
(no content change — `git diff --ignore-cr-at-eol` shows only `10-services.sh`).

## 3. Verification

```bash
# unit tests — 9 suites / 56 tests
cd apps/api && pnpm test            # → Test Suites: 9 passed, Tests: 56 passed

# e2e tests — 4 suites (3 run, 1 self-skips on Node 20)
cd apps/api && pnpm test:e2e        # → vapi-webhooks 11 passed, app-boot ok, app/health self-skip

# type check / build gate
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json   # → clean (was 2 × TS2353)

# lint
cd apps/api && pnpm exec eslint "src/**/*.ts" "test/**/*.ts"   # → clean

# Caddy route order
caddy adapt --config <rendered>Caddyfile --adapter caddyfile
#   → @vapi_match → /api/vapi/* 405 → /healthz → /api/* (one group)

# smoke suite mechanics (Docker-free harness with stubbed compose wrappers)
bash scripts/test/lib/10-services.sh harness  # → 5 checks executed, function returned
#   (before the fix: `log: command not found`, exit 127, no further checks)
```

## 4. Still open

- `pnpm test:e2e` needs **Node ≥ 24.9** (or a fixed `@nestjs/config` publish) for the
  `AppModule`-based suites; locally they self-skip with a warning. The guard/module/e2e
  coverage above runs everywhere.
- The droplet still runs the pre-VAPI image: deploy the API + Caddyfile change, then re-run the
  smoke suite — checks 5+6 are now real checks and will fail until then.
- `VapiWebhooksService` remains an in-memory stub (no `message.id` idempotency, no Postgres).
