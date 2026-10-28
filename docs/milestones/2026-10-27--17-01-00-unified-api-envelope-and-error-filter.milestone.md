# Unified API envelope and global error filter (AIS-87)

## Problem / feature

Three parallel descriptions of the same `api-keys` payload existed
(`create-api-key.dto.ts` with class-validator, a hand-written interface, and a Zod schema in
`@callback/shared` that `apps/api` never imported). Responses were bare payloads, errors were
Nest's default `{statusCode, message, error}`, there was no global filter, and the client
guessed from `body.message` text. Goal: one written convention — request JSON, response
`{ data, meta }`, error `{ error }` with a stable machine `code`, contract defined once in
`@callback/shared`, and server errors surfaced on four fixed UI tiers.

## Measured data / evidence

* `rg "class CreateApiKeyDto"` previously matched 1 production file + 1 spec; both deleted.
* `@callback/shared` was a declared dependency of `apps/api` but imported in **zero** source
  files; after the change it is the only source of the request/response shapes.
* Existing test counts after the change: shared 93, api 208, api-client 36, admin 89 — all green.

## Root cause / design rationale

The duplication existed because each layer solved its own problem locally: the DTO for Nest's
`ValidationPipe`, the interface for the controller typing, the Zod schema for the client. A
second, third and fourth description of one shape is where drift lives. The fix is a single
Zod contract plus **explicit** wrapping at one point per endpoint.

Alternatives rejected:

* **`@nestjs/swagger` decorators** — a second description built on the DTOs being deleted.
* **Success interceptor** — implicit wrapping hides which response has which shape and cannot
  be called from a service; only `RequestIdInterceptor` (header echo only) exists.
* **Status passed next to the code** — two decisions can disagree; the status is now derived
  from the shared catalogue (`resolveApiErrorStatus`).

## Solution / implementation

| Area | Change |
|---|---|
| `packages/shared/src/contract/endpoint.interface.ts` | `ApiEndpointContract` type |
| `packages/shared/src/contract/api-keys/api-keys.contract.ts` | `apiKeys.list` / `.findByIdentifier` / `.create` entries |
| `packages/shared/src/contract/endpoint.registry.ts` | `API_ENDPOINTS`, `ENVELOPE_EXEMPTIONS` (each with a reason), `findEndpoint()` |
| `packages/shared/src/contract/api-keys/api-keys.schema.ts` | `createApiKeySchema` is `.strict()` (unknown request field → 400) |
| `apps/api/src/common/http/app-error.*` | `AppError` base + validation/not-found/conflict subclasses |
| `apps/api/src/common/http/zod.pipe.ts`, `zod-error.mapper.ts` | `ZodBodyPipe`, `ZodQueryPipe`, `details[]` with dot paths |
| `apps/api/src/common/http/api-response.service.ts` | `ok(data, ctx, pagination?)`, `fail(appError, ctx)` |
| `apps/api/src/common/http/api-exception.filter.ts`, `to-app-error.ts`, `api-error-code.mapper.ts` | every throwable → error envelope, 5xx sanitised, `X-Request-Id` echoed |
| `apps/api/src/common/http/request-context.*`, `request-id.interceptor.ts`, `skip-envelope.*`, `http.module.ts` | correlation, `@ReqCtx()`, `@SkipEnvelope()`, global `APP_FILTER`/`APP_INTERCEPTOR` |
| `apps/api/src/api-keys/*` | controller wraps, service throws `AppError` (+ `API_KEY_IDENTIFIER_CONFLICT`), DTO and local interface removed |
| `apps/api/src/{health,vapi-webhooks}` | `@SkipEnvelope()` (raw bodies stay byte-identical) |
| `packages/api-client/src/http-client.ts`, `api-error.*` | envelope unwrap, `UNEXPECTED_PAYLOAD` drift code, `code`/`requestId`/`issues`, legacy fallback |
| `apps/admin/src/lib/error-message.*` | code-first Hungarian copy, status fallback, no server text as user copy |
| `docs/Specs/API-Convention.md` | living convention document |

## Outcome and how to verify

Every non-exempt route answers `{ data, meta }` and every failure `{ error }`; the client
returns only `data`, so service signatures did not change.

```bash
pnpm --filter @callback/shared test && pnpm --filter @callback/api test \
  && pnpm --filter @callback/api-client test && pnpm --filter @callback/admin test
pnpm --filter @callback/api build && pnpm --filter @callback/api lint
# manual:
curl -s localhost:3000/api/api-keys | jq   # { data: [], meta: { requestId, timestamp } }
curl -s localhost:3000/healthz     | jq   # unchanged bare { status: "oks", … }
```

## Follow-ups

* AIS-96: page-level `Alert` + retry, app banner (401/offline/503), `toErrorSurface`.
* AIS-97: CI gate that fails on a bare body outside the exemption list.
* AIS-98 / AIS-99: generated `/api/openapi.json`, Swagger UI, committed baseline + diff gate.
* `422` is currently normalised to `VALIDATION_FAILED` / `400` — a semantic-validation code is
  not in the catalogue yet.
* e2e suites self-skip on Node < 24.9 (`@nestjs/config` is CommonJS); verify manually with
  `pnpm start` + curl on such a runtime.
