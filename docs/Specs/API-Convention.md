# API Convention — unified request/response contract

**Utolsó frissítés:** 2026-11-02
**Story:** AIS-87 (plan: [`docs/plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md`](../plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md)); client transport hardening: AIS-94; tier-1 field mapping: AIS-95; generated OpenAPI + Swagger UI + dev response validator: AIS-98; list query + pagination contract: AIS-106; first paginated endpoint (`GET /api/api-keys`): AIS-107; mutation convention (`PATCH` / `DELETE`, `STALE_WRITE`, `SEMANTIC_VALIDATION_FAILED`): AIS-108
**Status:** living document — this file describes the _current_ state of the API, not a snapshot.

---

## 1. Single source of truth

Every request and response shape is defined **once**, in `packages/shared/src/contract`:

| Artefact                                     | Purpose                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `contract/envelope.schema.ts`                | `successEnvelopeSchema(dataSchema)`, `toSuccessEnvelope()`                        |
| `contract/error-envelope.ts`                 | `apiErrorEnvelopeSchema`, `toErrorEnvelope()`, `resolveApiErrorStatus()`          |
| `contract/error-code.const.ts`               | `API_ERROR_CODE` + `API_ERROR_CODE_STATUS` (code → status)                        |
| `contract/http-status.const.ts`              | `HTTP_STATUS` (shared by server and client)                                       |
| `contract/api-prefix.const.ts`               | `API_GLOBAL_PREFIX` (`api`) + `API_PATH_PREFIX` (`/api`)                          |
| `contract/<resource>/<resource>.schema.ts`   | request/response Zod schemas                                                      |
| `contract/<resource>/<resource>.update.ts`   | `PATCH` body schema of a resource (partial + required `updatedAt`)                 |
| `contract/no-payload.schema.ts`              | `noPayloadSchema` (`z.null()`) — the payload of a “nothing to return” call         |
| `contract/<resource>/<resource>.contract.ts` | endpoint registry entries (`operationId`, method, path, `tag`, schemas, `errors`) |
| `contract/endpoint.registry.ts`              | `API_ENDPOINTS` + `ENVELOPE_EXEMPTIONS`                                           |

The same schema drives three artefacts: `z.infer` types, server validation (`ZodBodyPipe`), client parsing (`http-client`). There is no class-validator DTO and no hand-written interface in `apps/api/src/api-keys` any more — and since AIS-93 there is no `class-validator` / `class-transformer` dependency at all, nor a global `ValidationPipe` (see §7).

### 1.1 Endpoint registry

One `ApiEndpointContract` per operation, typed so a missing or misspelled field is a build error:

| Field            | Meaning                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `operationId`    | Stable `<resource>.<action>` key (`apiKeys.list`); never changes when a route moves     |
| `method`, `path` | Nest route, **including** `API_PATH_PREFIX` (`/api/api-keys/:identifier`)               |
| `summary`, `tag` | OpenAPI `summary` and grouping (`api-keys`)                                             |
| `successStatus`  | `200` read/update/delete, `201` create                                                  |
| `dataSchema`     | Zod schema of the **payload** (the envelope is added once by `successEnvelopeSchema()`) |
| `requestSchema`  | Zod schema of the body; absent for bodyless endpoints                                   |
| `errors`         | Codes from `API_ERROR_CODE` the route can actually answer with                          |
| `envelope`       | `true` for every registered route; raw routes live in `ENVELOPE_EXEMPTIONS` instead     |

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

- `data` is **always present**: `[]` for an empty list, `null` for “nothing to return” (`200`, never `204`).
- `meta` is **always present** (`requestId` + `timestamp`), so every response is traceable to a server log line.

---

## 3. Error envelope (always)

```jsonc
{
  "error": {
    "code": "API_KEY_IDENTIFIER_CONFLICT",
    "status": 409,
    "message": "identifier already exists",
    "details": [{ "path": "identifier", "message": "already taken" }],
    "requestId": "0192f3c4-...",
    "timestamp": "2026-10-27T10:21:48.752Z",
    "path": "/api/api-keys",
  },
}
```

- `code` — stable, locale independent, **the decision key on the client**.
- `status` — derived from the code catalogue; never passed in by a service.
- `message` — English, for developers and logs. **Never rendered as user copy.**
- `details[]` — `{ path, message }` with dot paths (`name`, `lines.2.quantity`); `path: ''` means “whole payload”.
- 5xx — `message` is the fixed `INTERNAL_ERROR_MESSAGE`; stack, SQL text and constraint names stay in the server log, correlated by `requestId`.

### Error codes in use

| Code                          | Status               | Emitted by                                                |
| ----------------------------- | -------------------- | --------------------------------------------------------- |
| `VALIDATION_FAILED`           | 400                  | `ZodBodyPipe` / `ZodQueryPipe`, Nest `HttpException(400)` |
| `UNAUTHENTICATED`             | 401                  | auth story (AIS-73/74)                                    |
| `FORBIDDEN`                   | 403                  | guards                                                    |
| `NOT_FOUND`                   | 404                  | `NotFoundAppError`                                        |
| `CONFLICT`                    | 409                  | `ConflictAppError` (generic)                              |
| `API_KEY_IDENTIFIER_CONFLICT` | 409                  | `api-keys` service (domain-specific)                      |
| `STALE_WRITE`                 | 409                  | `StaleWriteAppError` — the `PATCH` version no longer matches (AIS-108) |
| `PAYLOAD_TOO_LARGE`           | 413                  | body-limit handling                                       |
| `SEMANTIC_VALIDATION_FAILED`  | 422                  | `SemanticValidationAppError` — shape valid, content impossible (AIS-108) |
| `RATE_LIMITED`                | 429                  | rate limiting                                             |
| `INTERNAL_ERROR`              | 500                  | any unknown throwable                                     |
| `SERVICE_UNAVAILABLE`         | 503                  | dependency down                                           |
| `UNEXPECTED_PAYLOAD`          | — (client-side only) | `packages/api-client` on contract drift                   |

---

## 4. Empty / zero-result rules

| Situation                      | Wire                       | Never                          |
| ------------------------------ | -------------------------- | ------------------------------ |
| List with no matches           | `"data": []`, 200          | `null`, `404`, omitted key     |
| Single resource missing        | `404` + error envelope     | `200` with `data: null`        |
| Optional scalar absent         | present as `null`          | missing key, `undefined`, `''` |
| Counter                        | `0` as number              | `"0"`, `null`                  |
| Nested object absent           | `{}` present               | omitted key                    |
| Success with nothing to return | `"data": null`, 200        | `204`                          |
| Duplicate                      | `409` + `code: *_CONFLICT` | silent overwrite               |
| Stale version (`PATCH`)        | `409` + `code: STALE_WRITE` | silent last-write-wins        |
| Shape valid, value impossible  | `422` + `code: SEMANTIC_VALIDATION_FAILED` | `400`, `500`        |
| Validation                     | `400` + `details[]`        | one concatenated string        |

---

## 4.1 List query (the shared paging contract)

Every paginated list endpoint takes the **same** query shape, validated by the same schema on the
server (`ZodQueryPipe`) and built by the same helper on the client.

| Field   | Type            | Default           | Range / rule                                                                           |
| ------- | --------------- | ----------------- | -------------------------------------------------------------------------------------- |
| `page`  | number          | `1`               | integer, ≥ 1. Coerced from the query string.                                           |
| `limit` | number          | `20`              | integer, 1…100. Coerced from the query string.                                         |
| `sort`  | string          | resource-specific | **enum over the resource's allow-list** — an unknown column is a `400`, never a `500`. |
| `order` | `asc` \| `desc` | `desc`            | enum.                                                                                  |
| `q`     | string          | absent            | free-text search, trimmed, max 200 chars. An empty term means **no filter**.           |

**The schema lives in `@callback/shared`** (`listQuerySchema`, plus `createListQuerySchema(sortBy)`
for the resource-specific `sort` allow-list), so the browser and the server cannot enforce two
different sets of numbers.

```ts
// server: the resource schema validates (and defaults) the query string
@Get()
async list(
  @Query(new ZodQueryPipe(apiKeyListQuerySchema)) query: ApiKeyListQuery,
  @ReqCtx() ctx: RequestContext,
): Promise<ApiEnvelope<readonly ApiKey[]>> {
  const { items, pagination } = await this.apiKeys.list(query);
  return this.responses.ok(items, ctx, pagination);
}

// client: the same shape, with the defaults left out of the URL
const params = toListQueryParams(query); // → '?page=3&limit=50' — never '?page=1'
```

**Per-resource sort allow-list (as of today).**

| Resource   | `sort` values                                               | Default     | `q` matches                      |
| ---------- | ----------------------------------------------------------- | ----------- | -------------------------------- |
| `api-keys` | `name`, `identifier`, `createdAt`, `updatedAt`, `expiresAt` | `createdAt` | `name` **or** `identifier` (ILIKE) |

**The response.** The wire format does **not** change: `data` stays an array and `meta.pagination`
carries the paging block (see §2). What the client gets is a **type**: `ApiResult<TRows>` pairs
the rows with a **mandatory** `meta.pagination`, so `total` and `totalPages` are reachable without
digging through the envelope and without a type assertion. A paginated response **without**
`meta.pagination` is a contract violation — the parse fails rather than silently treating it as a
single page.

**Server-side paging is real.** `GET /api/api-keys` is the reference implementation (AIS-107):

- the repository exposes `findPage(query)` → `{ rows, total }` (a `count(*)` over the **same**
  filter plus a `limit`/`offset` slice), so `findAll` no longer exists;
- every `orderBy` ends with `asc(id)` as a tie-breaker, so a page boundary never skips or repeats
  a row when two rows share the sort value;
- `meta.pagination` is computed by the pure `toPaginationMeta(query, total)` helper — the same
  function the client pager uses, so the two cannot disagree;
- an empty result is `200` + `data: []` + `total: 0` / `totalPages: 0`, never a `404`;
- an unknown `sort`, `limit=0`, `limit=101` or a fractional `page` is a `400`
  `VALIDATION_FAILED` with the offending field in `details[].path`.

The generated OpenAPI document lists the five query parameters of a list endpoint. They are
**descriptors derived from the same constants** the validation schema uses
(`list-query.parameters.ts`, `api-keys.list-query.ts`) rather than generated from the zod schema:
the `q` field ends in a `transform`, which cannot be rendered as an OpenAPI parameter.

---

## 4.2 Mutation convention (`PATCH` / `DELETE`)

Every mutable resource follows **one** convention. `api-keys` is the reference implementation (AIS-108).

### 4.2.1 `PATCH /api/<resource>/:identifier` — partial, version-guarded

| Rule                          | Detail                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Addressed by identifier**   | The route parameter is the resource's own lookup key; `:identifier` is **not** patchable — renaming the address is delete + create.      |
| **Partial body**              | Every mutable field is optional. `undefined` = “leave it”, `null` = “clear it” (only for nullable fields).                              |
| **`updatedAt` is required**   | It is the optimistic-concurrency token — the client's last known version. A body without it is a `400`, so `{}` cannot silently no-op.  |
| **`.strict()`**               | `id`, `identifier`, `createdAt`, `updatedAt` and any unknown field are a `400 VALIDATION_FAILED`.                                        |
| **One atomic guard**          | `UPDATE … SET <only provided columns> WHERE identifier = $1 AND deleted_at IS NULL AND updated_at = $expected RETURNING *`. There is deliberately **no** read-compare-write in the service: that window *is* the lost update. |
| **Server-owned `updatedAt`**  | The column is maintained by the database (`$onUpdate`). The client value is only compared, never written.                                |
| **`422` before `409`**        | A semantically impossible payload (e.g. `expiresAt` in the past) is a `422` **before** the version guard, so the retry advice stays correct. Boundary: `expiresAt === now` is allowed; strictly earlier is rejected. |
| **Miss classification**       | A guard that matched nothing costs one extra read (`findAnyByIdentifier`, deleted rows included): absent → `404`, deleted → `404` (a deleted row is invisible, so `409` would confirm its existence), live with another version → `409 STALE_WRITE` with `details[{ path: 'updatedAt' }]`. |

```jsonc
// PATCH /api/api-keys/vapi-prod
{
  "name": "Vapi production",   // change it
  "description": null,         // clear it
  "updatedAt": "2026-11-02T10:00:00.000Z" // the version the client last saw
}
```

### 4.2.2 `DELETE /api/<resource>/:identifier` — soft delete

| Rule                     | Detail                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Soft delete**          | The row is kept and stamped with `deleted_at`; an audit trail and a future undelete stay possible.                                 |
| **Invisible everywhere** | Every read and write carries `deleted_at IS NULL` (list, count, lookup, update, delete). A deleted row answers `404`, never `410`.  |
| **`200` + `data: null`** | Never `204`: a `204` has no body, so it could not carry `meta.requestId`. The payload is described by the shared `noPayloadSchema` (`z.null()`), registered as the `NoPayload` component. |
| **Idempotency is `404`** | A second `DELETE` of the same identifier answers `404 NOT_FOUND` — the row is already invisible, so reporting success would claim an effect the call did not have. |

### 4.2.3 OpenAPI

`PATCH` and `DELETE` are already part of `ApiHttpMethod` and `VERB_BY_METHOD`, so a registry entry is
enough. The two schemas the mutation needs are named components: `UpdateApiKey` (request) and
`NoPayload` (`data` of the delete). `envelopeOf()` can only describe a payload with a component name,
which is why `noPayloadSchema` exists at all.

---

## 5. Status codes

`200` read/update/delete · `201` create · `400` malformed/shape · `401` unauthenticated · `403` forbidden · `404` missing · `409` conflict (incl. `STALE_WRITE`) · `413` payload too large · `422` semantic validation (`SEMANTIC_VALIDATION_FAILED`) · `429` rate limited · `500` internal · `503` dependency down.

---

## 6. Exemptions (raw body, on purpose)

| Route                                        | Why                                                                                | Guarded by                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `GET /healthz`                               | Docker healthcheck + monitor watchdog parse a bare `{status, …}`                   | `@SkipEnvelope()` on the controller      |
| `POST /api/vapi/webhooks/tool-calls`         | provider-owned contract                                                            | `@SkipEnvelope()` + e2e                  |
| `POST /api/vapi/webhooks/end-of-call-report` | provider-owned contract                                                            | `@SkipEnvelope()` + e2e                  |
| `GET /api/openapi.json`                      | machine-readable contract artefact (a generator consumes it, it is not a resource) | `@SkipEnvelope()` on `OpenApiController` |

The list is mirrored in `ENVELOPE_EXEMPTIONS` (`@callback/shared`), each entry with a mandatory `reason`. Errors thrown on an exempt route are re-emitted in **Nest's raw shape**, so an exempt consumer never sees a body it does not understand.

`ApiExceptionFilter` resolves the exemption from **either** source: the `@SkipEnvelope()` metadata of the failed handler/controller, or the registry entry matching the request's route pattern (`request.routeOptions.url`). The second source is not redundant — Nest hands the filter a host without a handler/class pair for route-handler **and** guard failures, so a metadata-only check would wrap a VAPI auth rejection in our envelope.

The decorator and the registry are held in **exact two-way agreement** by tests: `apps/api/src/common/http/envelope-exemptions.spec.ts` (controller inventory, runs on every Node version) and `apps/api/test/envelope-exemptions.e2e-spec.ts` (discovers the controllers of the booted `AppModule`). A decorated-but-unlisted route and a listed-but-undecorated route both fail.

> **`/api/docs` is deliberately _not_ on the list.** The Swagger UI is served by the `@fastify/swagger-ui` plugin straight on the Fastify instance, so it never passes through a Nest handler and never reaches `ApiExceptionFilter` — an exemption entry would exist for a route the filter cannot see, and the two-way agreement test would fail.

---

## 7. Server layering

```text
HTTP edge     controller  →  @Body(new ZodBodyPipe(schema))
Application   domain service  →  plain data, throws AppError subclasses
Envelope      ApiResponseService.ok(data, ctx) / .fail(appError, ctx)
Errors        ApiExceptionFilter (@Catch(), registered as APP_FILTER in HttpModule)
```

- **No global `ValidationPipe`.** Validation is a route-level `ZodBodyPipe` / `ZodQueryPipe` carrying the shared schema; `class-validator` and `class-transformer` are not installed. A route without a pipe is a contract gap, not something a catch-all pipe compensates for.
- A domain service is **HTTP-agnostic**: it throws `AppError` (code + message + details), never `HttpException`.
- A controller **never returns domain data directly** — it calls `responses.ok(result, ctx)`; `ctx` comes from `@ReqCtx()`.
- `ApiResponseService` is thin: it only calls the pure factories from `@callback/shared`.
- `ApiExceptionFilter` normalises **anything** (`AppError`, `ZodError`, Nest `HttpException`, unknown `Error`) into the error envelope, sanitises 5xx, echoes `X-Request-Id` and logs one structured line per failure.
- There is **no success interceptor** that wraps bodies implicitly; `RequestIdInterceptor` only sets the `X-Request-Id` header.

---

## 8. Request correlation

Resolution order (`request-context.ts`, pure functions):

1. a **valid** inbound `X-Request-Id` (Caddy / client / another service) is kept;
2. otherwise Fastify's `request.id`, which `create-fastify-adapter.ts` generates with `genReqId: () => randomUUID()` — a UUID, **not** Fastify's default `req-1`, `req-2` counter, which is not unique across restarts or replicas;
3. a random UUID as the last resort, so a context is never built without an id.

Inbound values are validated before use (`request-id.const.ts`): max 128 characters, allow-list `A-Za-z0-9._:-`. The id lands in a response header and in every log line, so whitespace, newlines and other control characters are rejected and replaced by a generated id rather than echoed — an invalid value is treated exactly like an absent header.

The resolved id appears as `meta.requestId` / `error.requestId` **and** as the `X-Request-Id` response header, so a browser network entry and a server log line share the same value.

`@ReqCtx()` (`request-context.decorator.ts`) is the only way a controller receives the context; it never touches the raw request object.

> **Filter-host caveat:** Nest does not always populate `getHandler()` / `getClass()` on the host handed to an exception filter (route-handler and guard failures both arrive without them), and `Reflector` throws on an `undefined` target. `ApiExceptionFilter` therefore skips missing targets and falls back to the `ENVELOPE_EXEMPTIONS` route-pattern lookup — without that, every 4xx collapsed into an opaque Fastify `500` and exempt routes lost their raw body. Covered by `api-exception.filter.spec.ts`, the unknown-route case in `apps/api/test/request-id.e2e-spec.ts` and the signed/unsigned VAPI webhook cases in `apps/api/test/vapi-webhooks.e2e-spec.ts` (which now runs the real `HttpModule`).

---

## 9. Client transport

- **One unwrap point:** `packages/api-client/src/envelope.logic.ts` — `unwrapEnvelope(schema, body)` returns a discriminated `{ ok: true, data }` / `{ ok: false, issues, cause }`. It is pure (no `Response`, no `fetch`, no `env`), so every drift case is unit-testable without a transport double. `http-client.ts` only reads the body and turns a failed unwrap into an error.
- Two parses inside the unwrap: `successEnvelopeSchema(callerSchema)` proves the body is `{ data, meta }`, then the bare `callerSchema` re-validates `data` (so `data: null` is only accepted where the caller expects it). Only **`data`** is returned — service signatures are unchanged.
- A bare payload, a missing `meta`, or a `data: null` where the caller expects a resource becomes `ApiError` with `code: 'UNEXPECTED_PAYLOAD'`, **non-empty `issues[]`** and `details[]` rendered from that same list (`formatIssueLine`), so the two can never disagree.
- `issues[].path` is **payload-relative** (`identifier`, never `data.identifier`) — the envelope wrapper is stripped by `toPayloadRelativePath()`, because that is the form the admin maps onto a field. A payload-level problem (wrong type, `null` body) yields the empty path, i.e. “the whole body”.
- `ApiError` carries `status`, `code`, `requestId`, `issues[]` **and** the legacy `details: string[]` (rendered lines), so existing callers keep working.
- `api-error.const.ts` re-exports `HTTP_STATUS`, `API_ERROR_CODE` and the `ApiErrorCode` type from `@callback/shared`, so a consumer compares `code` against the catalogue instead of re-typing strings.
- A non-JSON body (Caddy `502`, nginx `504`) still degrades to status-based error — the tolerant path is deliberate.
- Request schemas are `.strict()` (an unknown field is a `400`), response schemas strip unknown keys (an additive backend field never breaks a bundle).

---

## 10. Where an error becomes visible (four tiers)

| Tier          | Component                                             | Applies to                                         |
| ------------- | ----------------------------------------------------- | -------------------------------------------------- |
| 1. Field      | RHF `setError(path)` from `details[]`                 | `400`/`422`, `409` with a field detail             |
| 2. Page       | `Alert` in the page content region + retry            | `403`, `404`, `409`, `5xx` on the page's main data |
| 3. App        | dismissible top banner (session + notification store) | `401`, offline (`status === null`), `503`          |
| 4. Log drawer | system entries with `code`, `status`, `requestId`     | all `5xx`, schema-drift payloads                   |

`toErrorMessage(error)` maps **code first** (`ERROR_CODE_MESSAGE` in `apps/admin/src/lib/error-message.const.ts`), then falls back to the status copy. The server's `message`/`details` are never used as user copy. Its signature (`unknown → string`) is frozen — the notification capture builds on it.

### 10.1 Tier 1 — field mapping (`toFieldErrors`)

Implemented by `toFieldErrors(error): { fields, form }` in
`apps/admin/src/features/<use-case>/<use-case>.logic.ts` (API keys:
[`api-keys.logic.ts`](../../apps/admin/src/features/api-keys/api-keys.logic.ts:1)). Pure, no React, no I/O.

| Rule                   | Detail                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code gate**          | Only `VALIDATION_FAILED` and `API_KEY_IDENTIFIER_CONFLICT` may produce field errors. Any other code — `CONFLICT`, `INTERNAL_ERROR`, a proxy `409` — stays a page `Alert`, even if it carries paths.                             |
| **Path source**        | `issues[].path` (payload-relative), matched against the form's declared field list. Never parsed out of `details[]` strings.                                                                                                    |
| **Unmapped path**      | A path no input owns (dot path, array index, empty payload path) becomes the single `form` message, rendered as the page `Alert`. Mapped paths still get their own input.                                                       |
| **Default path**       | An allowed code with `issues: []` falls back to the code's default path (`API_KEY_IDENTIFIER_CONFLICT` → `identifier`), so an older server still highlights the right input. `VALIDATION_FAILED` has no default → page `Alert`. |
| **Duplicate path**     | First issue wins (server order = validator order).                                                                                                                                                                              |
| **Copy**               | Client-owned: `API_KEY_IDENTIFIER_FIELD_MESSAGE` / `FIELD_INVALID_MESSAGE`. `issue.message` is English developer text and is never rendered.                                                                                    |
| **Mutual exclusivity** | If every issue mapped, `form` is `null` (no page `Alert`); if some did not, the alert carries one sentence for those.                                                                                                           |

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
9. **If the resource is mutable** (§4.2): add `<resource>.update.ts` with a `.strict()` partial schema whose `updatedAt` is required; add `update`/`remove` registry entries (`successStatus: 200`, delete payload `noPayloadSchema`); give the repository an **atomic** version-guarded `update…` and a `softDelete…`, both filtered on `deleted_at IS NULL`; map a missed guard to `404` (absent/deleted) or `409 STALE_WRITE` (live, other version) with `details[{ path: 'updatedAt' }]`; put impossible values behind a pure `*.logic.ts` rule and answer `422 SEMANTIC_VALIDATION_FAILED` before the guard.

---

## 12. Enforcement today

| Gate                                                                                                                                                          | Where                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Envelope factories & code catalogue                                                                                                                           | `packages/shared/test/{envelope,error-envelope}.test.ts`                                                    |
| Registry completeness (uniqueness, `<resource>.<action>` ids, tag = namespace, catalogue-only `errors`, payload parses, compile-time `@ts-expect-error` gate) | `packages/shared/test/endpoint-registry.test.ts`                                                            |
| Error filter, pipes, response service, correlation, exemption metadata                                                                                        | `apps/api/src/common/http/*.spec.ts`                                                                        |
| `@SkipEnvelope()` ⇄ `ENVELOPE_EXEMPTIONS` agreement (no container needed)                                                                                     | `apps/api/src/common/http/envelope-exemptions.spec.ts`                                                      |
| Same agreement over the discovered `AppModule` controllers                                                                                                    | `apps/api/test/envelope-exemptions.e2e-spec.ts`                                                             |
| `api-keys` service/controller behaviour                                                                                                                       | `apps/api/src/api-keys/*.spec.ts`                                                                           |
| Envelope end-to-end (incl. 409 code + `details[0].path`)                                                                                                      | `apps/api/test/api-keys.e2e-spec.ts`                                                                        |
| Mutation convention (§4.2): `PATCH` version guard, `409 STALE_WRITE`, `422` boundary, soft delete ⇒ `404`, `data: null`                                       | `apps/api/test/api-keys.e2e-spec.ts` (`mutation convention` block)                                          |
| Pure expiry rule (`isPastDate`, boundary = allowed), patch mapper (`undefined` vs `null`), atomic `update`/`softDelete` SQL                                  | `apps/api/src/api-keys/{api-keys.logic,api-keys.mapper,api-keys.repository}.spec.ts`                        |
| New error codes resolve to `409` / `422`, every catalogue value has a status                                                                                  | `packages/shared/test/error-code.test.ts`                                                                   |
| `meta.requestId` ⇄ `X-Request-Id`, inbound pass-through, invalid id replaced, unknown route, `healthz` raw                                                    | `apps/api/test/request-id.e2e-spec.ts`                                                                      |
| `healthz` / VAPI raw bodies unchanged                                                                                                                         | `apps/api/test/{health,vapi-webhooks}.e2e-spec.ts`                                                          |
| Client unwrap, drift, legacy fallback                                                                                                                         | `packages/api-client/test/{http-client,api-keys.service}.test.ts`                                           |
| Pure envelope unwrap + payload-relative paths                                                                                                                 | `packages/api-client/test/envelope.logic.test.ts`                                                           |
| Error-body parsing, `details`/`issues` consistency, guards                                                                                                    | `packages/api-client/test/api-error.test.ts`                                                                |
| Client path derivation from the registry (`toClientPath`, `clientPathOf`)                                                                                     | `packages/api-client/test/endpoint-path.test.ts`                                                            |
| Code-first user copy                                                                                                                                          | `apps/admin/src/lib/error-message.test.ts`                                                                  |
| Field mapping rules (code gate, path mapping, defaults, duplicates, no server text)                                                                           | `apps/admin/src/features/api-keys/api-keys.logic.test.ts`                                                   |
| Field mapping in the UI (multi-field 400, unmapped path, legacy 409, no server text)                                                                          | `apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx`                                                      |
| Document generation from the registry (paths, `operationId`, `$ref` envelope, examples, determinism)                                                          | `apps/api/src/common/openapi/openapi.registry.spec.ts`                                                      |
| Envelope/error components registered once, `envelopeOf`, error statuses                                                                                       | `apps/api/src/common/openapi/zod-openapi.spec.ts`                                                           |
| Prod never exposes the UI / validator (`isOpenApiDocsEnabled`, `isResponseAssertEnabled`)                                                                     | `apps/api/src/common/openapi/openapi.config.spec.ts`                                                        |
| Dev response validator (bare body, dropped field, additive field, exempt route)                                                                               | `apps/api/src/common/openapi/{response-assert.logic,response-assert.interceptor,route-match.logic}.spec.ts` |
| `/api/openapi.json` 200 + `openapi: 3.1.0`, `/api/docs` 200, `healthz` still raw                                                                              | `apps/api/test/openapi.e2e-spec.ts`                                                                         |
| Envelope branches (success, empty collection, 404, sanitised 500 + log proof)                                                                                 | `apps/api/test/envelope.e2e-spec.ts`                                                                        |
| Route audit: every non-exempt route registered (verb + path), every exemption backed by a decorator, no orphan entry (with negative fixtures)                 | `apps/api/test/lib/controller-audit.ts` → `apps/api/test/envelope-contract.e2e-spec.ts`                     |
| Mapper ⇄ shared-schema drift (fixture through `apiKeySchema` + the dev validator's assertion)                                                                 | `apps/api/test/envelope-contract.e2e-spec.ts`                                                               |
| CI runs the e2e gates on Node 24 with Postgres                                                                                                                | `.github/workflows/ci.yml` → `api-e2e` job                                                                  |
| OpenAPI baseline + breaking-change gate                                                                                                                       | **not built yet** — AIS-99                                                                                  |

---

## 13. Known gaps / follow-ups

- `packages/api-client` has no `patch`/`delete` transport yet, so the admin UI cannot use the new endpoints until AIS-109 lands. `ETag`/`If-Match`, bulk mutations and idempotency keys are deliberately not part of the `updatedAt` convention.
- Soft-deleted rows have no undelete endpoint and no purge job; they stay in `platform.api_keys` with a `deleted_at` stamp.
- The admin's tier-1 field mapping (§10.1) still only accepts `VALIDATION_FAILED` and `API_KEY_IDENTIFIER_CONFLICT`, so a `422` / `409 STALE_WRITE` currently surfaces as a page `Alert`. Extending the gate (`expiresAt` / `updatedAt`) belongs to the admin edit UI (AIS-109 and later).
- API-key value masking (**show-once**) is a separate security task (AIS-75); these endpoints still return the token.
- The `api-keys` routes are unauthenticated until AIS-73/74; the `401` code and banner behaviour are prepared but the login flow is not.
- `/api/openapi.json` is generated from the registry (AIS-98) and served in every env; the Swagger UI at `/api/docs` is mounted only when `isOpenApiDocsEnabled()` (never in prod). The committed baseline + CI drift gate is AIS-99.
- The dev response validator (`ResponseAssertInterceptor`) only runs outside prod, and only for routes present in `API_ENDPOINTS`; an exempt route or a plugin-served asset is passed through untouched.
- e2e suites self-skip on Node < 24.9 (CommonJS `@nestjs/config` + Jest ESM); run `pnpm start` + curl for a manual verification in that case.
- `apps/api/test/api-keys.e2e-spec.ts` needs a live Postgres and probes it with `select 1` (`test/lib/database-gate.ts`). Without a reachable database it warns with `[database-gate]` and self-skips instead of reporting six failed assertions — start it with `pnpm db:up` (and `DATABASE_URL`) to run the persistence half of the envelope contract.
