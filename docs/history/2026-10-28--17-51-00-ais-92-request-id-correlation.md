# 2026-10-28 17:51 — AIS-92 finished: requestId correlation, plus the exception-filter bugs it exposed

## What was asked

Review AIS-92 (subtask of AIS-87) against the codebase: what is done, what is still missing,
then plan and implement the remainder — the plan is
`docs/plans/2026-10-28--17-36-00-ais-92-request-id-correlation-remaining-plan.md`.

## State found

Already implemented: `RequestContext` + `readRequestId` / `resolveRequestId` /
`toRequestContext`, `@ReqCtx()`, `@SkipEnvelope()` + `SKIP_ENVELOPE_KEY`,
`RequestIdInterceptor` (header echo), global `HttpModule` wiring, decorators on `/healthz` and
the VAPI controller, `ENVELOPE_EXEMPTIONS` in `@callback/shared`.

Open: no Fastify `genReqId` (default `req-1`, `req-2`… was used), no validation of the inbound
`X-Request-Id`, `@ReqCtx()` sitting inside the pure correlation module, no `@SkipEnvelope`
spec, no decorator ⇄ registry consistency test, and no e2e assertions for the header /
pass-through / unknown route.

## Bug 1 — every 4xx became a Fastify 500

The first e2e run of an error path answered `500` with Fastify's default body. The exception
filter threw `TypeError` inside `isExempt()`: Nest's route-handler error path hands the filter
a host built from `[req, res, next]`, so `getHandler()` / `getClass()` are `undefined`, and
`Reflector` rejects an `undefined` metadata target. The error never became an envelope — it
escaped to Fastify. It stayed hidden because all `AppModule` e2e suites self-skip on
Node < 24.9, so the 404-envelope assertions had never run on the dev machine.

## Bug 2 — guard rejections lost the exemption

While re-running the VAPI suite with the real `HttpModule`, an unsigned webhook came back as
**our envelope** on a `@SkipEnvelope()` route. Guard failures reach the filter without a
handler/class pair too, so a metadata-only check cannot honour the exemption. Fixed by
falling back to the documented `ENVELOPE_EXEMPTIONS` list, matched against Fastify's route
pattern (`request.routeOptions.url`).

## What was implemented

| Area | Change |
|---|---|
| Filter | exemption = `@SkipEnvelope()` metadata **or** registry route-pattern match; missing/non-function metadata targets are skipped instead of crashing `Reflector` |
| Correlation | `request-id.const.ts` (max 128 chars, `A-Za-z0-9._:-`), `isValidRequestId`, invalid inbound ids treated as absent |
| Decorator | `@ReqCtx()` moved to `request-context.decorator.ts` with a testable `resolveRequestContext()`; `request-context.ts` is pure again |
| Adapter | `create-fastify-adapter.ts` with `genReqId: () => randomUUID()`, used by `main.ts` and all e2e bootstraps |
| Exemptions | shared test helper `envelope-route.ts`; `envelope-exemptions.spec.ts` (controller inventory) and `envelope-exemptions.e2e-spec.ts` (discovery) enforce two-way agreement **and** registry coverage of every enveloped route (root `/api` probe excepted, with a written reason) |
| Correlation e2e | `request-id.e2e-spec.ts` (no `AppModule`): `meta.requestId` ⇄ header, inbound `test-123` preserved, invalid id replaced, error envelope, unknown route, `healthz` raw |
| Per-suite e2e | `api-keys.e2e-spec.ts` (header ⇄ `meta.requestId`, inbound pass-through, error header), `health.e2e-spec.ts` (UUID header, body unchanged), `vapi-webhooks.e2e-spec.ts` (raw body keys, UUID header, now imports the real `HttpModule`) |
| Mocks | `http-host.mock.ts`: host can omit metadata targets / set URL and route pattern; reflector spy throws like `reflect-metadata` |
| Docs | `docs/Specs/API-Convention.md` §6, §8, §12 updated; AIS-98 TODO for `/api/openapi.json` + `/api/docs` recorded |

## Follow-up — `test:e2e` red on a machine without Postgres

A run on Node >= 24.9 (where the `AppModule` suites actually execute) failed
`api-keys.e2e-spec.ts` with six `500`s and a failing `afterAll`:
`connect ECONNREFUSED ::1:5432 / 127.0.0.1:5432`. The envelope behaved correctly — the
persistence suite simply had no database, and its failures said nothing about the contract.

Fix: `apps/api/test/lib/database-gate.ts` probes the injected handle with `select 1` (3 s
timeout). `beforeAll` warns with `[database-gate] … pnpm db:up` and leaves `app` null when the
probe fails, so every test self-skips (same loud-skip rule as `app-module-gate.ts`); the
`afterAll` cleanup no longer turns a finished run into "suite failed to run".
`apps/api/test/database-gate.e2e-spec.ts` pins the unreachable branch of the gate itself.

## Verification

```bash
pnpm --filter @callback/api test        # 31 suites, 297 tests passed
pnpm --filter @callback/api test:e2e    # 8 suites, 33 tests passed (AppModule suites self-skip on Node 20)
pnpm --filter @callback/api lint        # clean
pnpm --filter @callback/api build       # green
pnpm --filter @callback/shared test     # 5 suites, 99 tests passed
```

## Notes

* The `api-keys`, `health` and `envelope-exemptions` e2e assertions self-skip on the local
  Node 20 runtime; the same mechanics are covered by `request-id.e2e-spec.ts`, which does not
  need `AppModule`.
* Milestone: `docs/milestones/2026-10-28--17-51-00-ais-92-request-id-and-filter-host-crash.milestone.md`.
