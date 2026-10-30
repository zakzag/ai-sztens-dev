# 2026-10-28 16:25 — AIS-91 closed: mapper and filter test coverage

## What was asked

Check AIS-91's real state (what is done, what is missing), then finish it: close the test gaps,
run the API gates, and close the ticket in Jira.

## What was found

The production code of AIS-91 shipped on 2026-10-27 with the AIS-87 envelope work, but the ticket
was still `To Do` and the DoD items that require **proof** were not covered:

| DoD / test-plan item                                                                | Before                                                                     |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `ApiResponseService.ok/fail`                                                        | done, tested                                                               |
| Global `ApiExceptionFilter` as `APP_FILTER`, 5xx sanitising, `@SkipEnvelope()`      | done, tested                                                               |
| _Unit: `exception.logic`_ (the pure mapping) in its own spec                        | **missing**                                                                |
| 5xx sanitising on a **service-raised `AppError`**                                   | **untested** (only raw `Error` and `HttpException(503)`)                   |
| thrown `null` / `undefined` → `INTERNAL_ERROR`                                      | **untested**                                                               |
| log levels: 4xx `warn`, 5xx `error` with stack, detail only in the log              | **untested**                                                               |
| `422` → `VALIDATION_FAILED` (documented in the convention and the AIS-87 milestone) | **not implemented** — a Nest `UnprocessableEntityException` answered `500` |

## What was implemented

- `apps/api/src/common/http/to-app-error.spec.ts` (new) — the pure mapping pinned: 4xx passthrough,
  5xx sanitising for `AppError` **and** `HttpException` (`details` emptied, `cause` kept), `ZodError`
  → `VALIDATION_FAILED` + field paths, `HttpException` 404/409/422 → catalogue codes,
  `ValidationPipe` `message: string[]` → whole-payload details, uncatalogued status → `INTERNAL_ERROR`
  / 500, unknown throwables (`null`, `undefined`, string, object), and a wire-body proof through
  `toErrorEnvelope` that no SQL text survives a 5xx.
- `apps/api/src/common/http/api-error-code.mapper.spec.ts` (new) — the whole status table plus the
  fallbacks (uncatalogued status, success statuses, numeric edge cases).
- `apps/api/src/common/http/api-error-code.mapper.ts` — added the missing
  `UNPROCESSABLE_ENTITY → VALIDATION_FAILED` mapping. Without it a Nest `422` became a `500`, i.e. a
  client error reported as a server failure, contradicting `docs/Specs/API-Convention.md`.
- `apps/api/src/common/http/api-exception.filter.spec.ts` — rewritten on top of the new doubles and
  extended with the log assertions: 4xx → one `warn` line without a stack, 5xx → `error` with the
  stack **and** the leaked SQL text present in the log while absent from the response body,
  non-HTTP context logged and unanswered, service-raised 5xx `AppError` sanitised, and the filter
  provably reading the `SKIP_ENVELOPE_KEY` metadata key.
- `apps/api/src/common/http/test/mocks/http-host.mock.ts`, `logger.mock.ts` (new) — reply, request,
  `Reflector` and `Logger.prototype` doubles, moved out of the spec files per the coding standard
  (no mocks inside test files).

## Scope-name deviations (no functional difference)

| Ticket                               | Implemented                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `exception.logic.ts`                 | `to-app-error.ts`                                                                                           |
| `http.const.ts`                      | `api-messages.const.ts`                                                                                     |
| `fail(AppErrorShape, ErrorContext)`  | `fail(AppError, RequestContext)` — typed to the app error, so a non-catalogue code cannot reach the service |
| `APP_FILTER` provider in `AppModule` | in the global `HttpModule`, imported first by `AppModule` (same effect, one place for the interceptor too)  |

## Verification

```bash
pnpm --filter @callback/api test     # 27 suites, 267 tests (was 24 / 212 this morning)
pnpm --filter @callback/api lint     # clean
pnpm --filter @callback/api build    # green
```

Test growth: `to-app-error.spec.ts` (21), `api-error-code.mapper.spec.ts` (15+), filter spec 8 → 12.

## Still open (unchanged by this change)

- AIS-96 (page `Alert` + app banner + `toErrorSurface`), AIS-97 (CI gate against bare bodies),
  AIS-98/AIS-99 (generated OpenAPI + committed baseline).
- No dedicated `SEMANTIC_VALIDATION_FAILED` code — `422` keeps sharing `VALIDATION_FAILED`.
- `ValidationAppError` keeps no raw `cause`; the zod field details are the useful part of a 4xx.
- Sibling tickets AIS-88…AIS-95 are also still `To Do` in Jira although their code shipped.

## Planning artifact

[`docs/plans/2026-10-28--16-25-00-ais-91-filter-and-mapper-test-coverage-plan.md`](../plans/2026-10-28--16-25-00-ais-91-filter-and-mapper-test-coverage-plan.md)
