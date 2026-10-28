# API Convention — unified request/response contract

**Utolsó frissítés:** 2026-10-28
**Story:** AIS-87 (plan: [`docs/plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md`](../plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md))
**Status:** living document — this file describes the *current* state of the API, not a snapshot.

---

## 1. Single source of truth

Every request and response shape is defined **once**, in `packages/shared/src/contract`:

| Artefact | Purpose |
|---|---|
| `contract/envelope.schema.ts` | `successEnvelopeSchema(dataSchema)`, `toSuccessEnvelope()` |
| `contract/error-envelope.ts` | `apiErrorEnvelopeSchema`, `toErrorEnvelope()`, `resolveApiErrorStatus()` |
| `contract/error-code.const.ts` | `API_ERROR_CODE` + `API_ERROR_CODE_STATUS` (code → status) |
| `contract/http-status.const.ts` | `HTTP_STATUS` (shared by server and client) |
| `contract/api-prefix.const.ts` | `API_GLOBAL_PREFIX` (`api`) + `API_PATH_PREFIX` (`/api`) |
| `contract/<resource>/<resource>.schema.ts` | request/response Zod schemas |
| `contract/<resource>/<resource>.contract.ts` | endpoint registry entries (`operationId`, method, path, `tag`, schemas, `errors`) |
| `contract/endpoint.registry.ts` | `API_ENDPOINTS` + `ENVELOPE_EXEMPTIONS` |

The same schema drives three artefacts: `z.infer` types, server validation (`ZodBodyPipe`), client parsing (`http-client`). There is no class-validator DTO and no hand-written interface in `apps/api/src/api-keys` any more.

### 1.1 Endpoint registry

One `ApiEndpointContract` per operation, typed so a missing or misspelled field is a build error:

| Field | Meaning |
|---|---|
| `operationId` | Stable `<resource>.<action>` key (`apiKeys.list`); never changes when a route moves |
| `method`, `path` | Nest route, **including** `API_PATH_PREFIX` (`/api/api-keys/:identifier`) |
| `summary`, `tag` | OpenAPI `summary` and grouping (`api-keys`) |
| `successStatus` | `200` read, `201` create |
| `dataSchema` | Zod schema of the **payload** (the envelope is added once by `successEnvelopeSchema()`) |
| `requestSchema` | Zod schema of the body; absent for bodyless endpoints |
| `errors` | Codes from `API_ERROR_CODE` the route can actually answer with |
| `envelope` | `true` for every registered route; raw routes live in `ENVELOPE_EXEMPTIONS` instead |

**No route literal outside the registry:** `packages/api-client/src/<resource>/<resource>.const.ts` calls `clientPathOf('<operationId>')`, which strips `API_PATH_PREFIX` from the registry path. `apps/api/src/main.ts` calls `setGlobalPrefix(API_GLOBAL_PREFIX)` from the same file, so the prefix is written down once.

---

## 2. Success envelope (always)

```jsonc
{
  "data": { /* object */ } | [ /* array, [] when empty */ ] | null,
  "meta": {
    "requestId": "0192f3c4-...",
    "timestamp": "2026-10-27T10:21:48.752Z",
    "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } // only on paginated lists
  }
}
```

* `data` is **always present**: `[]` for an empty list, `null` for “nothing to return” (`200`, never `204`).
* `meta` is **always present** (`requestId` + `timestamp`), so every response is traceable to a server log line.

---

## 3. Error envelope (always)

```jsonc
{
  "error": {
    "code": "API_KEY_IDENTIFIER_CONFLICT",
    "status": 409,
    "message": "identifier already exists",
    "details": [ { "path": "identifier", "message": "already taken" } ],
    "requestId": "0192f3c4-...",
    "timestamp": "2026-10-27T10:21:48.752Z",
    "path": "/api/api-keys"
  }
}
```

* `code` — stable, locale independent, **the decision key on the client**.
* `status` — derived from the code catalogue; never passed in by a service.
* `message` — English, for developers and logs. **Never rendered as user copy.**
* `details[]` — `{ path, message }` with dot paths (`name`, `lines.2.quantity`); `path: ''` means “whole payload”.
* 5xx — `message` is the fixed `INTERNAL_ERROR_MESSAGE`; stack, SQL text and constraint names stay in the server log, correlated by `requestId`.

### Error codes in use

| Code | Status | Emitted by |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `ZodBodyPipe` / `ZodQueryPipe`, Nest `HttpException(400)` |
| `UNAUTHENTICATED` | 401 | auth story (AIS-73/74) |
| `FORBIDDEN` | 403 | guards |
| `NOT_FOUND` | 404 | `NotFoundAppError` |
| `CONFLICT` | 409 | `ConflictAppError` (generic) |
| `API_KEY_IDENTIFIER_CONFLICT` | 409 | `api-keys` service (domain-specific) |
| `PAYLOAD_TOO_LARGE` | 413 | body-limit handling |
| `RATE_LIMITED` | 429 | rate limiting |
| `INTERNAL_ERROR` | 500 | any unknown throwable |
| `SERVICE_UNAVAILABLE` | 503 | dependency down |
| `UNEXPECTED_PAYLOAD` | — (client-side only) | `packages/api-client` on contract drift |

---

## 4. Empty / zero-result rules

| Situation | Wire | Never |
|---|---|---|
| List with no matches | `"data": []`, 200 | `null`, `404`, omitted key |
| Single resource missing | `404` + error envelope | `200` with `data: null` |
| Optional scalar absent | present as `null` | missing key, `undefined`, `''` |
| Counter | `0` as number | `"0"`, `null` |
| Nested object absent | `{}` present | omitted key |
| Success with nothing to return | `"data": null`, 200 | `204` |
| Duplicate | `409` + `code: *_CONFLICT` | silent overwrite |
| Validation | `400` + `details[]` | one concatenated string |

---

## 5. Status codes

`200` read/update/delete · `201` create · `400` malformed/shape · `401` unauthenticated · `403` forbidden · `404` missing · `409` conflict · `413` payload too large · `422` semantic validation (currently normalised to `VALIDATION_FAILED` → `400`) · `429` rate limited · `500` internal · `503` dependency down.

---

## 6. Exemptions (raw body, on purpose)

| Route | Why | Guarded by |
|---|---|---|
| `GET /healthz` | Docker healthcheck + monitor watchdog parse a bare `{status, …}` | `@SkipEnvelope()` on the controller |
| `POST /api/vapi/webhooks/tool-calls` | provider-owned contract | `@SkipEnvelope()` + e2e |
| `POST /api/vapi/webhooks/end-of-call-report` | provider-owned contract | `@SkipEnvelope()` + e2e |
| `/api/openapi.json`, `/api/docs` | generated documents (AIS-98) | `@SkipEnvelope()` |

The list is mirrored in `ENVELOPE_EXEMPTIONS` (`@callback/shared`), each entry with a mandatory `reason`. Errors thrown on an exempt route are re-emitted in **Nest's raw shape**, so an exempt consumer never sees a body it does not understand.

---

## 7. Server layering

```text
HTTP edge     controller  →  @Body(new ZodBodyPipe(schema))
Application   domain service  →  plain data, throws AppError subclasses
Envelope      ApiResponseService.ok(data, ctx) / .fail(appError, ctx)
Errors        ApiExceptionFilter (@Catch(), registered as APP_FILTER in HttpModule)
```

* A domain service is **HTTP-agnostic**: it throws `AppError` (code + message + details), never `HttpException`.
* A controller **never returns domain data directly** — it calls `responses.ok(result, ctx)`; `ctx` comes from `@ReqCtx()`.
* `ApiResponseService` is thin: it only calls the pure factories from `@callback/shared`.
* `ApiExceptionFilter` normalises **anything** (`AppError`, `ZodError`, Nest `HttpException`, unknown `Error`) into the error envelope, sanitises 5xx, echoes `X-Request-Id` and logs one structured line per failure.
* There is **no success interceptor** that wraps bodies implicitly; `RequestIdInterceptor` only sets the `X-Request-Id` header.

---

## 8. Request correlation

`X-Request-Id` is accepted inbound (Caddy/client), otherwise Fastify's `request.id` is used, otherwise a UUID is generated. The resolved id appears as `meta.requestId` / `error.requestId` **and** as the `X-Request-Id` response header, so a browser network entry and a server log line share the same value.

---

## 9. Client transport

* `packages/api-client` parses `successEnvelopeSchema(callerSchema)` and returns **only `data`** — service signatures are unchanged.
* A bare payload, a missing `meta`, or a `data: null` where the caller expects a resource becomes `ApiError` with `code: 'UNEXPECTED_PAYLOAD'`.
* `ApiError` carries `status`, `code`, `requestId`, `issues[]` **and** the legacy `details: string[]` (rendered lines), so existing callers keep working.
* A non-JSON body (Caddy `502`, nginx `504`) still degrades to status-based error — the tolerant path is deliberate.
* Request schemas are `.strict()` (an unknown field is a `400`), response schemas strip unknown keys (an additive backend field never breaks a bundle).

---

## 10. Where an error becomes visible (four tiers)

| Tier | Component | Applies to |
|---|---|---|
| 1. Field | RHF `setError(path)` from `details[]` | `400`/`422`, `409` with a field detail |
| 2. Page | `Alert` in the page content region + retry | `403`, `404`, `409`, `5xx` on the page's main data |
| 3. App | dismissible top banner (session + notification store) | `401`, offline (`status === null`), `503` |
| 4. Log drawer | system entries with `code`, `status`, `requestId` | all `5xx`, schema-drift payloads |

`toErrorMessage(error)` maps **code first** (`ERROR_CODE_MESSAGE` in `apps/admin/src/lib/error-message.const.ts`), then falls back to the status copy. The server's `message`/`details` are never used as user copy.

Tiers 1–2 are implemented; tier 3–4 depend on the notification plan
([`docs/plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`](../plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md)) and are tracked as AIS-96.

---

## 11. Recipe — adding an endpoint

1. **Schema** in `packages/shared/src/contract/<resource>/<resource>.schema.ts` (request: `.strict()`, response: tolerant).
2. **Registry entry** in `<resource>.contract.ts` (`operationId: '<resource>.<action>'`, method, path, `tag`, `successStatus`, `dataSchema`, optional `requestSchema`, `errors` from the catalogue) — and a sample payload for it in `packages/shared/test/endpoint-registry.test.ts`.
3. **Domain service** in `apps/api/src/<feature>/`: returns plain data, throws `AppError` subclasses (add a new subclass or a domain code if the failure mode is new).
4. **Controller**: `@Body(new ZodBodyPipe(schema))` + `@ReqCtx()`, returns `this.responses.ok(await service…, ctx)`; `@HttpCode(HTTP_STATUS.CREATED)` for a create.
5. **Client service** in `packages/api-client/src/<resource>/`: the path comes from `clientPathOf('<operationId>')`, never from a literal; then `client.get(path, schema)` / `client.post(path, body, schema)`.
6. **Query hook** in `apps/admin/src/features/<use-case>/`, page alert from the hook's error state, field errors from `issues[]`.
7. **Tests**: pipe, service (`AppError` code + status), controller (`data` + `meta`), transport (envelope unwrap, error envelope → `ApiError.code`), hook.
8. If the route must stay raw: `@SkipEnvelope()` **and** an entry in `ENVELOPE_EXEMPTIONS` with a reason. No silent exemptions.

---

## 12. Enforcement today

| Gate | Where |
|---|---|
| Envelope factories & code catalogue | `packages/shared/test/{envelope,error-envelope}.test.ts` |
| Registry completeness (uniqueness, `<resource>.<action>` ids, tag = namespace, catalogue-only `errors`, payload parses, compile-time `@ts-expect-error` gate) | `packages/shared/test/endpoint-registry.test.ts` |
| Error filter, pipes, response service, correlation | `apps/api/src/common/http/*.spec.ts` |
| `api-keys` service/controller behaviour | `apps/api/src/api-keys/*.spec.ts` |
| Envelope end-to-end (incl. 409 code + `details[0].path`) | `apps/api/test/api-keys.e2e-spec.ts` |
| `healthz` / VAPI raw bodies unchanged | `apps/api/test/{health,vapi-webhooks}.e2e-spec.ts` |
| Client unwrap, drift, legacy fallback | `packages/api-client/test/{http-client,api-keys.service}.test.ts` |
| Client path derivation from the registry (`toClientPath`, `clientPathOf`) | `packages/api-client/test/endpoint-path.test.ts` |
| Code-first user copy | `apps/admin/src/lib/error-message.test.ts` |
| No bare body outside the allow-list, OpenAPI baseline, breaking-change gate | **not built yet** — AIS-97 / AIS-98 / AIS-99 |

---

## 13. Known gaps / follow-ups

* `422` has no dedicated code yet; a semantic-validation failure reports `VALIDATION_FAILED` / `400`.
* API-key value masking (**show-once**) is a separate security task (AIS-75); these endpoints still return the token.
* The `api-keys` routes are unauthenticated until AIS-73/74; the `401` code and banner behaviour are prepared but the login flow is not.
* `/api/openapi.json` and Swagger UI (`/api/docs`) are not implemented; the registry is the committed seed for them.
* e2e suites self-skip on Node < 24.9 (CommonJS `@nestjs/config` + Jest ESM); run `pnpm start` + curl for a manual verification in that case.
