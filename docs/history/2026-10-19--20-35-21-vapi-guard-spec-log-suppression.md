# Silence spurious ERROR lines from VapiSignatureGuard unit and e2e tests

## Context
Running the API test suites surfaced Nest log lines that looked like real
production failures even though every test passed:

```
[Nest] … ERROR [VapiSignatureGuard] VAPI webhook rejected: rawBody missing on request (check main.ts rawBody option).
[Nest] … ERROR [VapiSignatureGuard] VAPI_WEBHOOK_SECRET is not configured; rejecting webhook (fail closed).
```

`pnpm test` (unit) emitted the lines for each iteration of the negative
guard specs; `pnpm test:e2e` emitted them again — once each — from the
e2e negative paths.

## Diagnosis
All four ERROR lines come from negative-path branches inside
[`apps/api/src/vapi-webhooks/vapi-signature.guard.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.ts:88) (`canActivate()`),
which logs *before* throwing — correct production behaviour (operators
reading live logs deserve to know why a webhook was rejected). The tests
assert on the throw; the log is the noise we want to mute.

| Log line | Source |
|---|---|
| `rawBody missing` (unit) | `apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts` — `'throws UnauthorizedException when the raw body is missing'` |
| `VAPI_WEBHOOK_SECRET not configured` (unit) | same file — `'throws InternalServerErrorException when the secret is not configured (fail closed)'` (twice: `makeGuard({})` and `makeGuard({ secret: '' })`) |
| `rawBody missing` (e2e) | `apps/api/test/vapi-webhooks.e2e-spec.ts` — `'rejects the request when raw body capture is disabled (regression guard)'` |
| `VAPI_WEBHOOK_SECRET not configured` (e2e) | same file — `'fails closed with 500 when no secret is configured'` |

The controller spec does not use the guard, so its `PASS` line shows up
because of Jest's per-worker parallelism and stderr-flush ordering, not
because of anything in that file.

## Fix
Suppress the guard's intentional failure-path log emissions inside both
suites, while still asserting on the thrown exception / returned status
code.

Files touched:

- [`apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts:65)
  - Imported `Logger` from `@nestjs/common` and `jest` from `@jest/globals`
    (project convention — Jest globals are unavailable under
    `ts-jest/presets/default-esm`).
  - Added a `beforeEach` / `afterEach` pair that spies on
    `Logger.prototype.error` and `Logger.prototype.warn`, replaces them
    with no-ops, and restores them after each test. Assertions on the
    thrown `UnauthorizedException` / `InternalServerErrorException` are
    unchanged.
- [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts:129)
  - Same imports and the same `beforeEach` / `afterEach` pattern (the
    restoration is folded into the existing `afterEach` that closes the
    Nest app, so leaks cannot survive even if a test throws).

No production code changed; the guard still logs every rejection in real
traffic.

## Verification

```sh
cd apps/api && pnpm test
# Test Suites: 9 passed, 9 total
# Tests:       60 passed, 60 total
cd apps/api && pnpm test:e2e
# Test Suites: 4 passed, 4 total
# Tests:       14 passed, 14 total
```

Neither suite prints a `[Nest] ERROR [VapiSignatureGuard]` line any more.
The remaining `[Nest] LOG [VapiWebhooksService]` lines in the unit suite
are legitimate positive-path service info logs.
