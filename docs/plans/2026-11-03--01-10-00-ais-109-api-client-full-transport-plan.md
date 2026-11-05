# AIS-109 — `packages/api-client`: full transport (`PUT`/`PATCH`/`DELETE`), query builder, `ApiResult`, typed request body

**Date:** 2026-11-03 01:10, revised 01:25 (Europe/Budapest)
**Ticket:** AIS-109 (subtask of AIS-102 — data-flow: list/pagination convention, PATCH/DELETE endpoints, complete client transport)
**Depends on:** AIS-106 (done), AIS-107 (done), AIS-108 (in review — the server-side `PATCH`/`DELETE` exist and are e2e-tested)
**Sequencing:** independent of AIS-72 (see §3.0) · absorbs the `HttpEvent` half of AIS-84 (D1) · consumed by AIS-110
**Status:** planned

---

## 1. What it does, in one paragraph

`packages/api-client` today speaks only `GET`/`POST` and **throws away `meta`**: `unwrapEnvelope` returns `data`, so `meta.pagination` never reaches the UI. This ticket turns the transport into the complete HTTP surface the platform needs — `get`, `post`, `put`, `patch`, `delete`, and `getList` (the only verb that returns `ApiResult<TRows>`, i.e. `{ data, meta }` with a **mandatory** `pagination` block), adds a pure `toQueryString` builder that drops `undefined`, `null`, empty strings, empty arrays and default values, and types the request body from the endpoint registry's `requestSchema` (`z.infer`) instead of `unknown`, so a wrong service input becomes a **compile error**. It also absorbs the `HttpEvent` / `onEvent` hook from AIS-84, so `http-client.interface.ts` is written once and AIS-84 only has to wire the admin app.

---

## 2. Audited starting point

| Fact                                                                                                        | Where                                                                                                                                                                                     | Consequence                                                    |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `HttpClient` has `get` / `post` only                                                                        | [`http-client.interface.ts:47`](../../packages/api-client/src/http-client.interface.ts:47)                                                                                                | Four new verbs + `getList`                                     |
| `post` body is `unknown`                                                                                    | [`http-client.interface.ts:55`](../../packages/api-client/src/http-client.interface.ts:55)                                                                                                | Registry-derived body type at the service boundary (D5)        |
| `unwrapEnvelope` returns `{ ok: true, data }` — no `meta`                                                   | [`envelope.logic.ts:95`](../../packages/api-client/src/envelope.logic.ts:95)                                                                                                              | Success shape widens with `meta`                               |
| `EnvelopeUnwrapSuccess` has no `meta` field                                                                 | [`envelope.logic.interface.ts:14`](../../packages/api-client/src/envelope.logic.interface.ts:14)                                                                                          | Type must grow                                                 |
| `parsePayload` returns `data` only; no list path                                                            | [`http-client.ts:140`](../../packages/api-client/src/http-client.ts:140)                                                                                                                  | New `parseListPayload`                                         |
| `paginatedSchema` **throws** inside its `transform` when `meta.pagination` is missing                       | [`paginated.schema.ts:43`](../../packages/shared/src/contract/paginated.schema.ts:43)                                                                                                     | Must become a normal zod issue (D3)                            |
| Registry arrays are annotated `readonly ApiEndpointContract[]`, so `requestSchema` widens to `z.ZodTypeAny` | [`api-keys.contract.ts:55`](../../packages/shared/src/contract/api-keys/api-keys.contract.ts:55), [`endpoint.registry.ts:14`](../../packages/shared/src/contract/endpoint.registry.ts:14) | `as const satisfies` in **both** files (D5)                    |
| `toListQueryParams` already omits defaults and returns `URLSearchParams`                                    | [`list-query.helper.ts:113`](../../packages/shared/src/contract/list-query.helper.ts:113)                                                                                                 | `getList` delegates; the "is default" rule stays in one place  |
| Paths are already derived from the registry (`clientPathOf`)                                                | [`endpoint-path.ts:73`](../../packages/api-client/src/endpoint-path.ts:73), [`api-keys.const.ts:13`](../../packages/api-client/src/api-keys/api-keys.const.ts:13)                         | AIS-72 (route rename) is **not** a blocker                     |
| A registry path can carry a `:identifier` placeholder                                                       | [`api-keys.contract.ts:33`](../../packages/shared/src/contract/api-keys/api-keys.contract.ts:33)                                                                                          | A new verb could request a literal `:identifier` → guard (D10) |
| `ApiKeysService.list()` uses `client.get(...)` and returns a bare array                                     | [`api-keys.service.ts:28`](../../packages/api-client/src/api-keys/api-keys.service.ts:28), [`use-api-keys.ts:35`](../../apps/admin/src/features/api-keys/use-api-keys.ts:35)              | Untouched here (D9)                                            |
| `API-Convention.md` states "no `patch`/`delete` transport yet"                                              | [`API-Convention.md:391`](../Specs/API-Convention.md:391)                                                                                                                                 | Living doc must be corrected                                   |
| `knip` is green today (verified: `pnpm quality:dead-code` → exit 0)                                         | [`knip.json:16`](../../knip.json:16)                                                                                                                                                      | New public exports must not trip the dead-code gate (D9)       |
| Tests: jest + ts-jest (type-checks test files), doubles only via `test/mocks/`                              | [`package.json:17`](../../packages/api-client/package.json:17), [`fetch.mock.ts`](../../packages/api-client/test/mocks/fetch.mock.ts:1)                                                   | Same harness; makes `@ts-expect-error` tests real              |

---

## 3. Decisions

### D0 — Sequencing: AIS-72 is not a blocker, AIS-84 loses half its scope

The ticket text says AIS-72 (the `/api/api-keys` → `/api/admin/api-keys` move) comes first. It already cannot break this work: services never write a route, they call `clientPathOf(operationId)` on the registry, so a path rename in `@callback/shared` propagates automatically. AIS-109 therefore ships **before** AIS-72 without a rebase, and AIS-72 stays a registry + e2e + docs change.

`HttpEvent` / `onEvent` lands **here** (D1), not in AIS-84, so `http-client.interface.ts` gets one PR instead of two. AIS-84 keeps only the admin wiring (`QueryCache` / `MutationCache`, `NotificationHost`, `notification-events.logic.ts`).

### D1 — This ticket owns the transport contract

AIS-72 (path constants), AIS-84 (`onEvent`) and AIS-110 (`getList`, `RequestBodyOf`) are all consumers of this surface. It is written here, once, so no later ticket rewrites the same interface file.

### D2 — Five data-only verbs + one list verb

```ts
export interface HttpClient {
  get<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ): Promise<T>;
  post<TBody, TRes>(
    path: string,
    body: TBody,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;
  put<TBody, TRes>(
    path: string,
    body: TBody,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;
  patch<TBody, TRes>(
    path: string,
    body: TBody,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;
  delete<TRes>(
    path: string,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;
  getList<TRows>(
    path: string,
    rowsSchema: z.ZodType<TRows, z.ZodTypeDef, TRows>,
    request: ListRequest,
    options?: RequestOptions,
  ): Promise<ApiResult<TRows>>;
}
```

`delete` takes no body: the convention has no body-carrying delete (`DELETE /api/api-keys/:identifier` → `200 { data: null }`), so the parameter list stays honest instead of `body?: never`.

`getList`'s `rowsSchema` is `z.ZodType<TRows, z.ZodTypeDef, TRows>` — input equals output — because that is exactly what `paginatedSchema` accepts; widening one side would force a cast at the only place that must not need one.

`ListRequest` is `{ query: ListQuery & { sort?: string }; defaults?: ListQueryDefaults }`, so the caller controls the resource's default sort and the transport controls nothing about it.

### D3 — One unwrap point, widened; the missing pagination becomes a real zod issue

Two changes, both in `packages/shared`, both keeping one source of truth:

1. `unwrapEnvelope` success becomes `{ ok: true, data, meta }`; the failure shape is unchanged. Detail endpoints keep using `parsePayload`, which returns `result.data` — services never see `meta`.
2. `paginatedSchema` stops **throwing** inside its `transform` and instead fails with `.refine(...)` **before** the transform:

```ts
.refine((body) => body.meta.pagination !== undefined, {
  path: ['meta', 'pagination'],
  message: 'a paginated response must carry meta.pagination',
})
```

Why: a thrown `Error` inside a transform reaches `safeParse` as a `custom` issue with an **empty path**, so the client could only recover the location by matching a message string — brittle. With `refine` the failure is an ordinary zod issue carrying `path: ['meta', 'pagination']`, which the existing `toIssueDetails` renders to `meta.pagination` without stripping anything (it only strips a leading `data`), so the admin can map the drift onto the pager.

Consequence: the client needs **no `try`/`catch`**. `unwrapPaginatedEnvelope(rowsSchema, body)` is `paginatedSchema(rowsSchema).safeParse(body)` → `{ ok: true, data, meta }` / `{ ok: false, issues, cause }`. `http-client` turns `ok: false` into the existing `UNEXPECTED_PAYLOAD` `ApiError`.

The four existing shared assertions ("rejects a response without `meta.pagination`", etc.) only use `.toThrow()`, so they stay green; one test is added to assert the **issue path**, which is the new contract.

### D4 — Query builder: generic primitive, list case delegates

```ts
export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[];
export type QueryFilters = Readonly<Record<string, QueryValue>>;
export function toQueryString(
  filters: QueryFilters,
  defaults?: Readonly<Record<string, string | number | boolean>>,
): string;
```

Rules: `undefined` / `null` / `''` / empty array are skipped; arrays become **repeated keys** (`tag=a&tag=b`); numbers and booleans are stringified; a value equal to its `defaults` entry is skipped; nothing left → `''` (the caller appends nothing, never a bare `?`).

Encoding is `URLSearchParams`'s, i.e. space → `+`, `&` → `%26`, `é` → `%C3%A9`. That is deliberate: `getList` builds its string from the shared `toListQueryParams(...)` → `URLSearchParams`, so the two paths encode identically. **The "is this value still at its default" rule is not duplicated**: `getList` uses `toListQueryParams` (which knows `page=1`, `limit`, `order`, `q`, resource `sort`); `toQueryString` exists for non-list filters and takes an explicit `defaults` map.

### D5 — Request body type comes from the registry

Both registry arrays change to `as const satisfies readonly ApiEndpointContract[]`:

```ts
export const API_KEYS_ENDPOINTS = [...] as const satisfies readonly ApiEndpointContract[];
export const API_ENDPOINTS = [...API_KEYS_ENDPOINTS] as const satisfies readonly ApiEndpointContract[];
```

`API_ENDPOINTS` matters as much as `API_KEYS_ENDPOINTS`: the current `readonly ApiEndpointContract[]` annotation on the registry is a second widening point, so fixing only the resource array would still give `z.ZodTypeAny` downstream. `satisfies` proves both arrays stay assignable to `readonly ApiEndpointContract[]`, which is what `apps/api`'s OpenAPI registry and the contract-audit tests consume — no consumer changes.

In `packages/shared`:

```ts
type EndpointOf<TId extends string> = Extract<
  (typeof API_ENDPOINTS)[number],
  { readonly operationId: TId }
>;

export type RequestBodyOf<TId extends string> =
  EndpointOf<TId> extends {
    readonly requestSchema: infer S extends z.ZodTypeAny;
  }
    ? z.infer<S>
    : never;
```

Service signatures use it (`patch(identifier: string, body: RequestBodyOf<'apiKeys.update'>)`) while the transport stays generic over `TBody` — the transport must not know operation ids. Fallback if `as const` cannot be threaded through the spread: an explicit `ApiRequestBodyMap` interface plus a registry test proving every endpoint with a `requestSchema` has an entry.

### D6 — `onEvent` is optional, side-effect free, and never fails a request

```ts
export interface HttpEvent {
  readonly method: ApiHttpMethod;
  readonly path: string; // no query string
  readonly status: number | null; // null = network error
  readonly durationMs: number;
  readonly outcome: 'success' | 'error';
}
```

No header, token or body field exists on the type (privacy by construction). Emission is wrapped so a throwing listener cannot fail the request — deliberate, commented, tested. Absent `onEvent` → behaviour bit-for-bit identical to today (that is AIS-84's DoD).

### D7 — `ApiError` and the non-JSON error branch stay unchanged

Status-based mapping (a Caddy `502` with an HTML body) keeps working; `put`/`patch`/`delete` reuse `toFailure`. No new error class is needed for HTTP failures.

### D8 — `Content-Type` follows the body

`post`/`put`/`patch` send `application/json`; `get`/`delete`/`getList` do not. `buildHeaders` already derives this from `init.body !== undefined`.

### D9 — No admin/service churn in this ticket

`ApiKeysService.list()` keeps returning `readonly ApiKey[]` via `get`. Migrating it to `getList` changes `useApiKeysQuery`, the table and their MSW handlers — that is the admin list/pagination work (AIS-119 / AIS-116), not AIS-110 (operation coverage + resource template). Recorded as a known gap in the closing comment.

Dead-code gate: `knip` is green today, and exports reachable from the package entry (`src/index.ts`) are its public API, so the new verbs should not be flagged. Verification is part of the delivery matrix; if `knip` does complain, the ignore entry names this ticket and the consuming ticket — never a blanket `ignoreExports`.

### D10 — An unresolved path placeholder is rejected before `fetch`

`clientPathOf('apiKeys.remove')` returns `/api-keys/:identifier`. Substitution belongs to AIS-110, but a wrong caller would today send a literal `:identifier` and get a confusing `400`/`404`. The transport therefore refuses a path that still contains a `:` segment parameter and throws a new `UnresolvedPathParameterError` (in `endpoint-path.ts`, next to the two existing path errors), with the offending path on the instance.

Cheap (a guard + two tests), and it converts "silently wrong URL" into a named, testable failure at the boundary. A `GET /items` style path and a colon inside a query value are unaffected.

---

## 4. Files

| File                                                                  | Change                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/api-client/src/http-client.interface.ts`                    | full verb set, `getList`, `ListRequest`, `HttpEvent`, `onEvent` in `HttpClientConfig`                                    |
| `packages/api-client/src/http-client.ts`                              | generic `request`, `parsePayload` / `parseListPayload`, event emission on every branch, placeholder guard                |
| `packages/api-client/src/query-string.interface.ts`                   | **new** — `QueryValue`, `QueryFilters`                                                                                   |
| `packages/api-client/src/query-string.logic.ts`                       | **new** — `toQueryString` (pure)                                                                                         |
| `packages/api-client/src/paginated-envelope.logic.ts`                 | **new** — `unwrapPaginatedEnvelope` (safeParse, no `try`/`catch`)                                                        |
| `packages/api-client/src/envelope.logic.ts`                           | success result gains `meta`                                                                                              |
| `packages/api-client/src/envelope.logic.interface.ts`                 | `EnvelopeUnwrapSuccess.meta: ResponseMeta`                                                                               |
| `packages/api-client/src/endpoint-path.ts`                            | **new** `UnresolvedPathParameterError` + guard helper                                                                    |
| `packages/api-client/src/index.ts`                                    | explicit exports of the new symbols                                                                                      |
| `packages/shared/src/contract/paginated.schema.ts`                    | `throw` → `.refine` with `path: ['meta', 'pagination']`                                                                  |
| `packages/shared/src/contract/api-keys/api-keys.contract.ts`          | `as const satisfies`                                                                                                     |
| `packages/shared/src/contract/endpoint.registry.ts`                   | `as const satisfies`                                                                                                     |
| `packages/shared/src/contract/endpoint.body.ts`                       | **new** — `RequestBodyOf<TId>`                                                                                           |
| `packages/shared/src/index.ts`                                        | export `RequestBodyOf`                                                                                                   |
| `packages/shared/test/paginated.test.ts`                              | assert the `meta.pagination` issue path                                                                                  |
| `packages/api-client/test/http-client.test.ts`                        | verb matrix, body/header cases, list parse, `onEvent`                                                                    |
| `packages/api-client/test/query-string.logic.test.ts`                 | **new**                                                                                                                  |
| `packages/api-client/test/paginated-envelope.logic.test.ts`           | **new**                                                                                                                  |
| `packages/api-client/test/request-body.types.test.ts`                 | **new** — positive + `@ts-expect-error` negative                                                                         |
| `packages/api-client/test/endpoint-path.test.ts`                      | placeholder-guard cases                                                                                                  |
| `packages/api-client/test/mocks/fetch.mock.ts`                        | `paginationMeta` / `paginatedResponse` helper                                                                            |
| `docs/Specs/API-Convention.md`                                        | §9 client transport: new verbs, `getList`, `RequestBodyOf`; remove the "no patch/delete transport yet" limitation (§391) |
| `docs/history/<ts>-ais-109-api-client-full-transport.md`              | change summary (project rule)                                                                                            |
| `docs/milestones/<ts>-ais-109-api-client-full-transport.milestone.md` | milestone (multi-file, decision-grade)                                                                                   |

---

## 5. Definition of done

- [ ] Every verb (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`) covered on success **and** error branch (`4xx`, `5xx`, network).
- [ ] `POST`/`PUT`/`PATCH` send the serialised body + `Content-Type: application/json`; `GET`/`DELETE` send neither.
- [ ] Query encoding tested: array value → repeated keys, `undefined`, `null`, empty string, empty array, `a b` → `a+b`, `a&b` → `a%26b`, `é` → `%C3%A9`, value equal to its default omitted, empty result → `''`.
- [ ] `getList` returns `meta.pagination`; `data: null` becomes `[]`; a body without `meta.pagination` fails with code `UNEXPECTED_PAYLOAD` and **`issues[0].path === 'meta.pagination'`**.
- [ ] `RequestBodyOf<'apiKeys.update'>` rejects a wrong input at compile time (`@ts-expect-error`, verified because ts-jest type-checks the spec) and accepts a valid one.
- [ ] `onEvent`: 2xx → `success`, `4xx`/`5xx`/network → `error` with `status: null`; payload deep-equals the expected object and has **no** header/token/body keys; `path` carries no query string; a listener that throws does not reject the request; without `onEvent` nothing is called.
- [ ] A path containing an unresolved `:param` throws `UnresolvedPathParameterError` before `fetch` is called (assert `fetchMock.calls` is empty).
- [ ] `pnpm --filter @callback/shared test`, `pnpm --filter @callback/api-client test` and `pnpm --filter @callback/api test` green; no React import in `packages/api-client`.
- [ ] `pnpm lint`, `pnpm quality` (layers + dead-code + tokens + field-errors) green.
- [ ] `API-Convention.md` no longer claims the transport lacks `patch`/`delete`.

---

## 6. Test plan (mocks first)

1. `test/mocks/fetch.mock.ts` — add `paginationMeta` (extends `TEST_META` with a `pagination` block) and `paginatedResponse(data, meta?, status?)`; reuse the existing `createSequenceFetchMock` / `createRejectingFetchMock`.
2. `query-string.logic.test.ts` — table-driven cases from §5, including the default-omission and empty-result branches.
3. `paginated-envelope.logic.test.ts` — success, missing pagination (path assertion), `null` rows → `[]`, malformed row.
4. `http-client.test.ts` — per verb: recorded URL + method + body + headers; error branches reuse `errorResponse`, `textResponse`, `emptyResponse`; `onEvent` with an injected `Date.now` spy for a deterministic `durationMs`.
5. `request-body.types.test.ts` — one valid assignment plus one `@ts-expect-error` line; a wrong expectation fails the jest run through ts-jest diagnostics.
6. `endpoint-path.test.ts` — placeholder guard: `/api-keys/:identifier` throws, `/api-keys` and `/api-keys?x=:y` do not, and no `fetch` happened.

---

## 7. Implementation order

```mermaid
graph LR
  A[shared: as const satisfies + RequestBodyOf] --> B[shared: paginated refine]
  B --> C[api-client: HttpEvent and config]
  C --> D[api-client: query string primitive]
  D --> E[api-client: envelope meta widening]
  E --> F[api-client: paginated unwrap]
  F --> G[api-client: verbs, getList, placeholder guard]
  G --> H[tests and mocks]
  H --> I[docs: API-Convention, history, milestone]
```

---

## 8. Delivery (gate before commit)

Nothing is committed until the **whole** matrix is green.

| Step               | Command                                                     | Must be                                                                                  |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Type / build       | `pnpm build`                                                | green                                                                                    |
| Unit matrix        | `pnpm test` (shared → api-client → ui → admin → api)        | green                                                                                    |
| E2E (API)          | `pnpm test:e2e`                                             | green — the registry `as const` change must not break the contract the e2e suite asserts |
| Quality-gate tests | `pnpm test:quality`                                         | green                                                                                    |
| Static quality     | `pnpm quality` (layers + dead-code + tokens + field-errors) | green                                                                                    |
| Lint               | `pnpm lint`                                                 | green                                                                                    |
| Formatting         | `pnpm format:check`                                         | green                                                                                    |

If any gate fails, fix the cause (no `--no-verify`, no skipped test) and re-run the **full** matrix.

Then, in this order:

1. **Git commit** — one commit, `feat(api-client): full transport, query builder and typed request body (AIS-109)`; the body lists D1–D10 in one line each. The plan, history and milestone files are part of the same commit.
2. **Jira comment on AIS-109, in Hungarian** — short and factual: changed files by group, the decisions other tickets depend on (`getList` is the only `ApiResult` method; `onEvent` is optional so AIS-84 only wires the app; `RequestBodyOf` is the service-level body type; the placeholder guard expects AIS-110 to substitute `:param`; `ApiKeysService.list()` intentionally untouched), the gate result, and the commit hash.
3. **Jira status update on AIS-109** — `To Do` → `In Progress` when implementation starts, `In Progress` → `In Review` after the commit (a subtask is not set to `Done` before review, matching AIS-108).

---

## 9. Out of scope / follow-ups

- **Admin list adoption** — `list()` → `getList` + `ApiResult` in the service, hook, table and MSW handlers: AIS-119 / AIS-116 territory, no subtask of AIS-102 owns it yet.
- **`findByIdentifier` / mutation wiring** — AIS-110 (operation coverage + resource endpoint template), including `:identifier` substitution.
- **Route rename** — AIS-72, propagated automatically through `clientPathOf`.
- **`ETag`/`If-Match`, bulk mutations, idempotency keys** — deliberately outside the `updatedAt` convention.
