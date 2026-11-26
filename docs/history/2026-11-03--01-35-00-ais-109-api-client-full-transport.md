# AIS-109 — full client transport (`PUT`/`PATCH`/`DELETE`), query builder, `ApiResult`, typed request body

**Date:** 2026-11-03 01:35 (Europe/Budapest)
**Ticket:** AIS-109 (subtask of AIS-102)
**Plan:** [`docs/plans/2026-11-03--01-10-00-ais-109-api-client-full-transport-plan.md`](../plans/2026-11-03--01-10-00-ais-109-api-client-full-transport-plan.md)

## What changed

`packages/api-client` could only speak `GET`/`POST` and dropped the response `meta`, so
`meta.pagination` could never reach the UI. AIS-109 completes the transport.

### `@callback/shared`

| File                                         | Change                                                                                                                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/contract/endpoint.body.ts`              | **new** — `RequestBodyOf<TId>` derives the body type from the registry `requestSchema` (`z.infer`); a bodyless endpoint resolves to `never`.                                                                                 |
| `src/contract/api-keys/api-keys.contract.ts` | annotation → `as const satisfies readonly ApiEndpointContract[]`, keeping the concrete schema types.                                                                                                                         |
| `src/contract/endpoint.registry.ts`          | same for `API_ENDPOINTS` — the second widening point had to go too.                                                                                                                                                          |
| `src/contract/paginated.schema.ts`           | the missing-`meta.pagination` `throw` inside `transform` became a **required** field (`responseMetaSchema.extend({ pagination: paginationMetaSchema })`), so the failure is an ordinary zod issue at path `meta.pagination`. |
| `src/index.ts`                               | exports `RequestBodyOf`.                                                                                                                                                                                                     |
| `test/paginated.test.ts`                     | asserts the new issue path.                                                                                                                                                                                                  |

### `@callback/api-client`

| File                                                      | Change                                                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/http-client.interface.ts`                            | `get`/`post`/`put`/`patch`/`delete`/`getList`, `ListRequest`, `HttpEvent`, optional `onEvent` on the config.                                                              |
| `src/http-client.ts`                                      | one generic `attempt()` (guard → fetch → parse → emit), `parseListPayload`, event emission on every branch (2xx **and** drift/failure), placeholder guard before `fetch`. |
| `src/query-string.interface.ts` / `query-string.logic.ts` | **new** — pure `toQueryString(filters, defaults?)`.                                                                                                                       |
| `src/paginated-envelope.logic.interface.ts` / `.ts`       | **new** — `unwrapPaginatedEnvelope` returning `ApiResult<TRows>`; no `try`/`catch`.                                                                                       |
| `src/envelope.logic.ts` / `envelope.logic.interface.ts`   | success result widened to `{ ok: true, data, meta }`.                                                                                                                     |
| `src/endpoint-path.ts`                                    | **new** `UnresolvedPathParameterError`, `hasUnresolvedPathParameter`, `assertNoUnresolvedPathParameter`.                                                                  |
| `src/index.ts`                                            | explicit exports of all new symbols.                                                                                                                                      |

### Tests (all doubles, no network)

`query-string.logic.test.ts`, `paginated-envelope.logic.test.ts`,
`request-body.types.test.ts` (positive case + three `@ts-expect-error` lines, real
because ts-jest type-checks specs) are new; `http-client.test.ts` gained the
`PUT`/`PATCH`/`DELETE`/`getList`/`onEvent`/placeholder-guard matrices (error branches
included); `endpoint-path.test.ts` gained the guard cases; `fetch.mock.ts` gained
`paginatedResponse` / `paginatedMeta` / `TEST_PAGINATION`.

## Decisions worth remembering

1. `getList` is the **only** method returning `ApiResult`; the five data-only verbs return
   the payload, so existing service signatures stay unchanged.
2. `onEvent` lives in this ticket (not AIS-84): `outcome: 'success'` requires a parsed body,
   the event carries no header/token/body, and a throwing listener cannot fail a request.
3. `delete` takes no body — the convention has none.
4. The missing-pagination rule stayed in `@callback/shared` (one source of truth) by making
   the field required instead of catching an exception in the client.
5. A path with an unresolved `:parameter` fails **before** `fetch`; substitution is AIS-110's
   job (`clientPathOf` returns the placeholder form).
6. `ApiKeysService` is untouched: migration to `getList`/`patch`/`delete` belongs to AIS-110 and
   the admin list/pagination work.

## Verification

`pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm format:check`,
`pnpm quality`, `pnpm test:quality` — see the ticket comment for the recorded result.
Specs updated in the same change: [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md)
(§9 client transport, §13 known gaps).
