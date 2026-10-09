# Milestone — VAPI webhook runtime fix (guard DI, `rawBody`, smoke wiring)

**Date:** 2026-10-06
**Scope:** uncommitted VAPI webhook slice — `apps/api/src/vapi-webhooks/`, `apps/api/src/main.ts`,
`apps/api/test/`, `scripts/test/lib/10-services.sh`
**History entry:** [`docs/history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md`](../history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md)

## 1. Problem

The VAPI inbound-webhook slice (guard, controller, Caddy pre-filter, tests, specs) existed only in
the working tree and had **never been executed end-to-end**. Three independent defects each made
the feature unusable, and two artefacts actively hid them: every test injected a synthetic *string*
body, and the smoke checks were dead code.

## 2. Measured data / evidence

| Check | Result before | Result after |
|---|---|---|
| `NestFactory.create(AppModule, …)` | `UnknownDependenciesException: Nest can't resolve dependencies of the VapiSignatureGuard (?)` — the API could not boot | boots |
| `tsc --noEmit` | 2 × `TS2353 'rawBody' does not exist in type …FastifyAdapterBaseOptions` (`main.ts`, e2e spec) | clean |
| Adapter contract | `parseAs: 'buffer'` ⇒ `request.rawBody` is a **Buffer**, guard required `string` ⇒ every webhook 401 | guard accepts Buffer and string |
| `pnpm --filter @callback/api test` | 9 failed / 20 passed (`app-env.spec.ts`: `jest is not defined`) | **56 passed / 56** |
| `pnpm test:e2e` | 3 suites failed to load | 4 suites load; 11 VAPI cases + boot test pass |
| Smoke suite | `log: command not found` → exit 127, suite aborted after check 4 (verified on the droplet) | checks 1–6 execute, function returns |
| Live droplet `POST /api/vapi/webhooks/end-of-call-report` | 404 from NestJS (Caddy forwards verbatim; api uptime ≈ 6.8 d) | unchanged — never deployed |

`caddy adapt` (caddy:2-alpine) confirmed the Caddyfile is correct: `@vapi_match` → `/api/vapi/*` 405
→ `/healthz` → `/api/*`, all in one mutually-exclusive `handle` group.

## 3. Root cause / design rationale

1. **Type-only import broke DI.** `import type { ConfigService }` erases the runtime reference, so
   `emitDecoratorMetadata` wrote `design:paramtypes = [Function]` and Nest could not resolve the
   guard. Fixed by design, not by patching the metadata: the guard now injects a narrow
   `VAPI_WEBHOOK_CONFIG` symbol token (interface + pure env reader). Benefits beyond the fix: the
   VAPI context no longer depends on the CommonJS-only `@nestjs/config` (which Jest's ESM runner
   cannot `require()` on Node < 24.9), the secret is resolved once instead of per request, and the
   guard depends on an abstraction rather than a concrete config service.
2. **`rawBody` is a Nest application option, not an adapter option.** Nest passes
   `appOptions.rawBody` to the adapter's `registerParserMiddleware()`
   (`@nestjs/core/nest-application.js`), so the correct call is
   `NestFactory.create(AppModule, new FastifyAdapter(), { rawBody: true })`.
3. **Buffer vs string.** Nest's adapter registers the JSON parser with `parseAs: 'buffer'`; the
   guard now normalises `request.rawBody` (`Buffer → utf8`, accept `string`, reject anything else)
   instead of silently failing closed on a technically-valid request.
4. **Verification artefacts must be able to fail.** The guard unit tests were green throughout —
   they built the guard by hand with a string body. The new tests execute the real module graph
   (`vapi-webhooks.module.spec.ts`), the real HTTP pipeline with the production bootstrap
   (`vapi-webhooks.e2e-spec.ts`, incl. “raw body capture disabled → 401”), and the smoke suite now
   derives its own target/secret from `infra/.env` instead of relying on undocumented exports.

## 4. Solution / implementation

| File | Change |
|---|---|
| `apps/api/src/vapi-webhooks/vapi-webhook-config.ts` | **New** token + interface + pure env reader + `FactoryProvider` |
| `apps/api/src/vapi-webhooks/vapi-signature.guard.ts` | `@Inject(VAPI_WEBHOOK_CONFIG)`; accepts Buffer **and** string raw bodies |
| `apps/api/src/vapi-webhooks/vapi-webhooks.module.ts` | registers the config provider |
| `apps/api/src/main.ts` | `{ rawBody: true }` as the application option |
| `apps/api/src/config/app-env.ts` + spec | exports pure `normaliseAppEnv()` (trim + lower-case); ESM-safe spec |
| 4 × new/rewritten unit specs, `test/vapi-webhooks.e2e-spec.ts`, `test/app-boot.e2e-spec.ts`, `test/lib/app-module-gate.ts` | coverage for guard (17 cases), service, controller, module wiring, config reader, HTTP pipeline, full boot |
| `scripts/test/lib/10-services.sh` | `log_info` instead of the non-existent `log`; `resolve_webhook_check_env()` fills `WEBHOOK_TARGET`/`VAPI_WEBHOOK_SECRET` from `$ENV_FILE` only when Caddy runs |
| `.gitattributes` | `*.sh text eol=lf` — CRLF silently kills bash scripts (`$'\r'` syntax error) |

## 5. Outcome and how to verify

```bash
cd apps/api && pnpm test          # 9 suites / 56 tests green
cd apps/api && pnpm test:e2e      # vapi-webhooks 11 green, app-boot green (others self-skip on Node < 24.9)
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json   # clean
pnpm exec eslint "src/**/*.ts" "test/**/*.ts"            # clean
# after deploying the API + rendered Caddyfile:
pnpm test:stack                   # checks 5+6: 405 without signature, 200 with a valid HMAC
```

## 6. Follow-ups

- `AppModule`-based e2e suites need Node ≥ 24.9 (Jest's `require(esm)` support) or an upstream fix
  to `@nestjs/config` (still CommonJS against the ESM-only `@nestjs/common@12`; its declared peer
  range is `^10 || ^11`). They self-skip with a loud warning meanwhile.
- The droplet runs the pre-VAPI image: deploy, then re-run the smoke suite (checks 5+6 will fail
  until the Caddyfile + module are live — that is the intended signal).
- `VapiWebhooksService` is still an in-memory stub: no `message.id` idempotency, no Postgres, no
  business logic (assistant dispatch / follow-ups).
