# AIS-92 — requestId correlation, and the two exception-filter bugs it uncovered

## Problem

AIS-92 (`requestId` correlation) was reported as delivered, but three ticket decisions were
never implemented and two DoD items had no test. Verifying them uncovered **two latent
production bugs** in the global exception filter: every 4xx answered as an opaque `500`, and
guard rejections on exempt routes lost their raw body.

## Measured data / evidence

* A route throwing an `AppError` answered
  `{"statusCode":500,"error":"Internal Server Error","message":""}` — Fastify's default body.
* A temporary probe in `ApiExceptionFilter.catch` showed the caught throwable was
  `TypeError` from `Reflect.getMetadata`, stack `Reflector.getAllAndOverride →
  ApiExceptionFilter.isExempt`. `Reflector` throws on an `undefined` metadata target, and
  Nest's route-handler error path builds the filter host from the raw `[req, res, next]`
  tuple — so `getHandler()` / `getClass()` are missing.
* With the real `HttpModule` wired into the VAPI suite, an unsigned webhook on the
  `@SkipEnvelope()` controller came back as **our envelope**:
  `{"error":{"code":"UNAUTHENTICATED",...}}` instead of Nest's raw 401. Guard failures reach
  the filter without a handler/class pair too, so a metadata-only exemption check is blind.
* The `AppModule`-based e2e suites self-skip on Node < 24.9, which is why neither bug was
  caught: the 404-envelope assertions had never actually executed on the dev machine.

## Root cause

The filter assumed the exception host always carries the matched handler and controller, and
that the `@SkipEnvelope()` decorator is the only source of the exemption. Neither holds:
Nest hands the filter more than one host shape (handler errors, guard errors, unmatched
routes), and `Reflector` raises `TypeError` on a missing target. The throw happened *inside*
the filter, so the error escaped to Fastify — and even after the crash was fixed, the
exemption had to come from somewhere else for guard rejections.

Secondary findings: Fastify's default `genReqId` (`req-1`, `req-2`, …) is not unique across
restarts or replicas although it is what `meta.requestId` reported; and the inbound
`X-Request-Id` was echoed without validation, i.e. a log/header injection surface.

## Solution / implementation

| File | Change |
|---|---|
| `apps/api/src/common/http/api-exception.filter.ts` | exemption = `@SkipEnvelope()` metadata **or** `ENVELOPE_EXEMPTIONS` route-pattern match (`request.routeOptions.url`, URL without query as fallback); missing/non-function metadata targets are skipped instead of crashing `Reflector` |
| `apps/api/src/common/http/request-context.interface.ts` | `HttpRequestLike.routeOptions.url` (route pattern) added |
| `apps/api/src/common/http/request-id.const.ts` | new: `REQUEST_ID_MAX_LENGTH` (128), `A-Za-z0-9._:-` allow-list |
| `apps/api/src/common/http/request-context.ts` | pure module: `isValidRequestId`, invalid inbound ids treated as absent |
| `apps/api/src/common/http/request-context.decorator.ts` | new: `@ReqCtx()` + testable `resolveRequestContext()` |
| `apps/api/src/common/http/create-fastify-adapter.ts` | new: `genReqId: () => randomUUID()`; used by `main.ts` and all e2e bootstraps |
| `apps/api/src/common/http/test/support/envelope-route.ts` | new test helper: derives the real route table, finds unregistered enveloped routes |
| `apps/api/src/common/http/envelope-exemptions.spec.ts` | new: decorator ⇄ registry agreement + registry coverage, every Node version |
| `apps/api/test/envelope-exemptions.e2e-spec.ts` | new: same rules over the discovered `AppModule` controllers |
| `apps/api/test/request-id.e2e-spec.ts` | new: id ⇄ header, inbound pass-through, invalid id replaced, error envelope, unknown route, `healthz` raw (no `AppModule`) |
| `apps/api/test/{api-keys,health,vapi-webhooks}.e2e-spec.ts` | header/pass-through/raw-body assertions; the VAPI suite now imports the real `HttpModule` |
| `apps/api/test/lib/database-gate.ts` + `apps/api/test/database-gate.e2e-spec.ts` | new: `select 1` probe with timeout; the persistence suite self-skips loudly without Postgres instead of reporting six 500s, and the gate's own unreachable branch is pinned |
| mocks + specs (`http-host.mock.ts`, `request-context`, `api-exception.filter`, `skip-envelope.decorator`, `create-fastify-adapter`) | new branches: missing targets, registry fallback, URL fallback, length/character rules, exemption precedence |
| `apps/api/src/{main.ts,app.controller.ts,api-keys/api-keys.controller.ts}` | adapter factory / new decorator import |
| `docs/Specs/API-Convention.md` | §6 two-source exemption + AIS-98 TODO, §8 resolution order and filter-host caveat, §12 gates |

## Outcome and how to verify

* Enveloped responses carry `meta.requestId`; the same value is on `X-Request-Id`.
* A valid inbound `X-Request-Id` is preserved; an invalid one is replaced, never echoed.
* `GET /healthz` stays byte-identical; VAPI webhooks keep Nest's raw bodies, including 401s.
* Unknown URLs answer the error envelope (404), not a bare 500.
* A decorated-but-unlisted route, a listed-but-undecorated route, or an enveloped route
  missing from `API_ENDPOINTS` fails the suite.

```bash
pnpm --filter @callback/api test        # 297 passed
pnpm --filter @callback/api test:e2e    # 8 suites, 33 passed (AppModule suites self-skip on Node < 24.9)
pnpm --filter @callback/api lint
pnpm --filter @callback/api build
```

On a machine without Postgres, `api-keys.e2e-spec.ts` now prints
`[database-gate] skipped: no Postgres reachable — run pnpm db:up …` and skips instead of
failing; with `pnpm db:up` it runs the full persistence path.

## Follow-ups

* `/api/openapi.json` and `/api/docs` are still absent (AIS-98); when added they must carry
  `@SkipEnvelope()` and an `ENVELOPE_EXEMPTIONS` entry, otherwise the agreement suite fails.
* The registry coverage check is path-level; verb-level matching belongs to the generated-spec
  gate (AIS-98).
* CI should pin Node >= 24.9 so the `AppModule` e2e suites (and the discovery half of the
  exemption check) really execute instead of self-skipping.
