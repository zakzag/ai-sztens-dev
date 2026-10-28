# 2026-10-27 17:01 — Unified API envelope (AIS-87, subtasks AIS-89…AIS-95)

## What was asked

Continue the AIS-87 implementation and answer one question: **after this change, do the
existing API calls follow the new convention?** Yes — every non-exempt route now answers
with the envelope, and the client unwraps it, so existing call sites keep their signatures.

## What was implemented

| Subtask | Delivered |
|---|---|
| AIS-89 | `ApiEndpointContract`, `api-keys` contract entries, `API_ENDPOINTS` + `ENVELOPE_EXEMPTIONS` in `@callback/shared`, with tests |
| AIS-90 | `AppError` / `ValidationAppError` / `NotFoundAppError` / `ConflictAppError`, `ZodBodyPipe` + `ZodQueryPipe`, `toApiErrorDetails()` |
| AIS-91 | `ApiResponseService` (`ok`/`fail`), global `ApiExceptionFilter` (`APP_FILTER`), 5xx sanitising, `@SkipEnvelope()` handling |
| AIS-92 | `resolveRequestId` / `toRequestContext` / `@ReqCtx()`, `RequestIdInterceptor` (header echo), `HttpModule` (global) |
| AIS-93 | `api-keys` controller returns envelopes, service throws `AppError` with `API_KEY_IDENTIFIER_CONFLICT`, class-validator DTO + local wire interface deleted |
| AIS-94 | `http-client` unwraps `{ data, meta }`, `ApiError` gains `code` / `requestId` / `issues[]` (legacy `details` kept), non-JSON tolerant path kept |
| AIS-95 (part) | `toErrorMessage()` is code-first (`ERROR_CODE_MESSAGE`), status copy as fallback; server text is never user copy |
| AIS-97 (part) | e2e + unit specs updated; 5xx/4xx/exemption branches covered |
| AIS-100 (part) | `docs/Specs/API-Convention.md`, this entry, milestone |

`GET /` (the Nest sample route) was wrapped too, so no bare body remains outside the
written exemption list. `createApiKeySchema` became `.strict()` — an unknown field such as
`id` is a `400` again, which restores the old `forbidNonWhitelisted` guarantee.

## Files of note

* `packages/shared/src/contract/{endpoint.interface.ts,endpoint.registry.ts,api-keys/api-keys.contract.ts}`
* `apps/api/src/common/http/*` (new `common/http` layer: errors, pipes, response service, filter, context, decorators, module)
* `apps/api/src/api-keys/{api-keys.controller.ts,api-keys.service.ts,api-keys.mapper.ts}` — envelope + shared types
* `packages/api-client/src/{http-client.ts,api-error.ts,api-error.interface.ts,index.ts}`
* `apps/admin/src/lib/{error-message.ts,error-message.const.ts}` and `apps/admin/src/test/mocks/api-error.mock.ts`

## Verification

```bash
pnpm --filter @callback/shared test          # 93 passed
pnpm --filter @callback/api test             # 208 passed
pnpm --filter @callback/api test:e2e         # 5 suites passed (self-skip on Node < 24.9)
pnpm --filter @callback/api-client test      # 36 passed
pnpm --filter @callback/admin test           # 89 passed
pnpm --filter @callback/api build            # green
pnpm --filter @callback/admin lint           # green
pnpm --filter @callback/api lint             # green
```

`apps/api/package.json` gained `zod` (it imported only `@callback/shared` before), and
`pnpm-lock.yaml` was updated by the install.

## Still open inside AIS-87

AIS-96 (page alert + app banner + `toErrorSurface`), AIS-97 completion (CI gate against bare
bodies, contract-drift fixture), AIS-98/AIS-99 (generated OpenAPI + committed baseline).
