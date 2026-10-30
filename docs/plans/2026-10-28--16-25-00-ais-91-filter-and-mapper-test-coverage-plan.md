# Plan — AIS-91 completion: mapper and filter test coverage

**Ticket:** [AIS-91](https://zakzag.atlassian.net/browse/AIS-91) — `apps/api: ApiResponseService (ok/fail) + globális ApiExceptionFilter APP_FILTER-ként, 5xx sanitizálással és requestId korrelációval`
**Parent:** AIS-87 (unified API contract + envelope)
**Date:** 2026-10-28 16:25

---

## 1. State found

AIS-91 is `To Do` in Jira with no comments, but the production code shipped on
2026-10-27 (see [`docs/history/2026-10-27--17-01-00-unified-api-envelope-ais-87.md`](../history/2026-10-27--17-01-00-unified-api-envelope-ais-87.md)).

| Ticket item                                                                                 | State                                        |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `ApiResponseService.ok(data, ctx, pagination?)` / `.fail(error, ctx)`                       | done                                         |
| Global `@Catch()` filter registered as `APP_FILTER`                                         | done (`HttpModule`, imported by `AppModule`) |
| Any throwable → `{ error: { code, status, message, details, requestId, timestamp, path } }` | done                                         |
| 5xx sanitising (fixed message, no stack / SQL / constraint in the body)                     | done                                         |
| `HttpException` 404/409 → catalogue code instead of 500                                     | done                                         |
| `@SkipEnvelope()` hook via `Reflector`                                                      | done                                         |
| Filter + service unit specs                                                                 | done                                         |

Scope names drifted from the ticket, without a functional difference:

| Ticket                                          | Implemented                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `exception.logic.ts`                            | `to-app-error.ts`                                                      |
| `http.const.ts`                                 | `api-messages.const.ts`                                                |
| `fail(error: AppErrorShape, ctx: ErrorContext)` | `fail(error: AppError, ctx: RequestContext)`                           |
| `APP_FILTER` in `AppModule`                     | `APP_FILTER` in the global `HttpModule`, imported first by `AppModule` |

## 2. Definition-of-Done gaps

1. No `to-app-error.spec.ts` — the ticket's _"Unit: `exception.logic`"_ requirement had no own
   spec; its assertions only arrived indirectly through the filter.
2. The 5xx path **services actually use** was unproven: an `AppError` with a 5xx code carrying a
   SQL-ish message and `details`. Only a raw `Error` and a `HttpException(503)` were covered.
3. Thrown `null` / `undefined` / primitives / plain objects → `INTERNAL_ERROR` were untested,
   although the ticket lists them.
4. No log assertions, although the DoD requires _4xx → `warn`, 5xx → `error` with stack, detail
   present in the log while absent from the body_.
5. Discovered while writing the table test: `422` was missing from `STATUS_TO_CODE`, so a Nest
   `UnprocessableEntityException` answered **500**, contradicting
   [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md) and the AIS-87 milestone, which
   both document `422 → VALIDATION_FAILED / 400`.

## 3. Steps (executed)

1. Move the reply / request / `Reflector` doubles out of the spec into
   `apps/api/src/common/http/test/mocks/http-host.mock.ts`, and add
   `logger.mock.ts` (a `Logger.prototype` recorder). Coding standard: no mocks inside spec files.
2. Add `to-app-error.spec.ts`: 4xx passthrough, 5xx sanitising for `AppError` and `HttpException`,
   `ZodError` details, 404/409/422 mapping, `ValidationPipe` `message: string[]` → whole-payload
   details, uncatalogued status → `INTERNAL_ERROR`/500, unknown throwables, and a wire-body proof
   (`toErrorEnvelope`) that no SQL text survives a 5xx.
3. Add `api-error-code.mapper.spec.ts`: the full status table, uncatalogued statuses (`418`, `0`,
   `-1`, `NaN`), success statuses, and the "only catalogue codes" property.
4. Add `[HTTP_STATUS.UNPROCESSABLE_ENTITY]: VALIDATION_FAILED` to `STATUS_TO_CODE`, so a Nest
   client error is not reported as a server failure.
5. Rewrite `api-exception.filter.spec.ts` on top of the new doubles and add: 4xx warn line without
   stack, 5xx error line with stack and the SQL detail present **in the log only**, non-HTTP
   context logging, service-raised 5xx `AppError` sanitising, and the assertion that the filter
   reads the `SKIP_ENVELOPE_KEY` metadata key.

## 4. Verification

```bash
pnpm --filter @callback/api test     # 27 suites, 267 tests
pnpm --filter @callback/api lint     # clean
pnpm --filter @callback/api build    # green
```

## 5. Out of scope

- AIS-96 / AIS-97 / AIS-98 / AIS-99 (admin error surfaces, CI bare-body gate, generated OpenAPI).
- Refactoring the local log recorder in `db/database-lifecycle.service.spec.ts` onto the new shared
  one (it is green and unrelated).
- A dedicated `SEMANTIC_VALIDATION_FAILED` catalogue code — `422` keeps sharing
  `VALIDATION_FAILED` for now.
- Jira statuses of the sibling subtasks AIS-88…AIS-95, which are also still `To Do` although their
  code shipped.
