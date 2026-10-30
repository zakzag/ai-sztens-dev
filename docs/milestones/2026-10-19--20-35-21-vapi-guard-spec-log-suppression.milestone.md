# Milestone: Silence spurious `ERROR [VapiSignatureGuard]` lines from unit and e2e tests

## 1. Problem

`pnpm test` and `pnpm test:e2e` in `apps/api` both printed
`[Nest] ERROR [VapiSignatureGuard] …` lines that looked like real
production failures, even though every test passed:

```
[Nest] … ERROR [VapiSignatureGuard] VAPI webhook rejected: rawBody missing on request (check main.ts rawBody option).
[Nest] … ERROR [VapiSignatureGuard] VAPI_WEBHOOK_SECRET is not configured; rejecting webhook (fail closed).
```

The first run emits the errors twice each (two assertions inside the
"fail closed" spec).

## 2. Evidence

```sh
cd apps/api && pnpm test 2>&1 | grep VapiSignatureGuard
# ERROR … rawBody missing on request   (×2)
# ERROR … VAPI_WEBHOOK_SECRET …        (×2)

cd apps/api && pnpm test:e2e 2>&1 | grep VapiSignatureGuard
# ERROR … rawBody missing on request   (×1)
# ERROR … VAPI_WEBHOOK_SECRET …        (×1)
```

Tracing the lines back:

| Log line                                        | Source test                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rawBody missing` (unit, ×2 from two cases)     | `apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts` — `'throws UnauthorizedException when the raw body is missing'` and `'throws UnauthorizedException when the raw body is neither string nor Buffer'` |
| `VAPI_WEBHOOK_SECRET not configured` (unit, ×2) | same file — `'throws InternalServerErrorException when the secret is not configured (fail closed)'` (runs `makeGuard({})` and `makeGuard({ secret: '' })`)                                                    |
| `rawBody missing` (e2e, ×1)                     | `apps/api/test/vapi-webhooks.e2e-spec.ts` — `'rejects the request when raw body capture is disabled (regression guard)'`                                                                                      |
| `VAPI_WEBHOOK_SECRET not configured` (e2e, ×1)  | same file — `'fails closed with 500 when no secret is configured'`                                                                                                                                            |

The guard ([`apps/api/src/vapi-webhooks/vapi-signature.guard.ts:88`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.ts:88))
intentionally calls `this.logger.error(...)` before throwing, which is
correct production behaviour. In a test the throw is the assertion
target — the log adds no information.

`vapi-webhooks.controller.spec.ts` never touches the guard; its `PASS`
line only appears in the user's snippet because Jest runs specs in
parallel workers and stderr is interleaved.

## 3. Root cause

Negative-path tests invoke a guard branch whose log statement is the
_only_ way the production code communicates the rejection. In a test,
the thrown exception is the assertion target — the log is pure noise
that floods CI output and obscures real failures.

Alternatives considered:

1. Lower the guard's `error` calls to `warn`, or gate them behind an env
   flag — both weaken production telemetry and were rejected. The test
   layer is the right place to mute intentional failure-path logs.
2. Use Nest's `Logger.overrideLogger(false)` globally per test — too
   broad; it would also silence real warnings such as the
   `experimentalDecorators` notice. A targeted spy on the two methods we
   actually call is more precise and easier to reason about.

## 4. Solution

Files touched:

- [`apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts:65)
  - Imported `Logger` from `@nestjs/common` and `jest` from
    `@jest/globals` (the project runs Jest in ESM mode via
    `ts-jest/presets/default-esm`; `jest` is not a global — see
    `apps/api/src/config/app-env.spec.ts` for the same pattern).
  - Added a `beforeEach` / `afterEach` pair that spies on
    `Logger.prototype.error` and `Logger.prototype.warn` and replaces
    them with no-ops; restores the originals after each test.

- [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts:129)
  - Same imports, same `beforeEach`; the spy-restore is folded into the
    existing `afterEach` that closes the Nest app, so a leaked spy cannot
    survive even if a test throws.

No production code changed; the guard still logs every rejection in
real traffic.

## 5. Outcome and verification

```sh
cd apps/api && pnpm test
# Test Suites: 9 passed, 9 total
# Tests:       60 passed, 60 total

cd apps/api && pnpm test:e2e
# Test Suites: 4 passed, 4 total
# Tests:       14 passed, 14 total
```

Neither suite prints a `[Nest] ERROR [VapiSignatureGuard]` line any
more. The remaining `[Nest] LOG [VapiWebhooksService]` lines in the unit
suite are the legitimate positive-path service info logs.

## 6. Follow-ups

- If a new failure-path log level is added to the guard (e.g. `debug` or
  `log`), decide whether to add it to the suppression. Current scope is
  `error` and `warn`, matching today's failure-path logs.
- If another e2e spec grows negative paths that log via the global
  Nest `Logger`, lift the suppression helper into
  `apps/api/test/lib/` so it can be reused without copy-paste.
- The `[app-module-gate] skipped …` warnings printed by
  `loadAppModuleOrSkip` come from a direct `console.warn` (not the Nest
  `Logger`), so they remain visible. That is intentional — they signal
  which full-`AppModule` e2e tests are still being skipped because the
  development machine is on Node < 24.9.
