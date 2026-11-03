# AIS-109 — full client transport and typed request bodies

**Date:** 2026-11-03 01:35 · **Scope:** `packages/api-client`, `packages/shared` · **Plan:** `docs/plans/2026-11-03--01-10-00-ais-109-api-client-full-transport-plan.md`

## Problem / feature

The client transport knew `GET`/`POST` only, so the `PATCH`/`DELETE` endpoints delivered by
AIS-108 were unreachable from the admin. It also unwrapped the success envelope to `data`
only, which meant `meta.pagination` — the whole point of the AIS-106/107 list contract —
never reached the UI. Mutation bodies were typed `unknown`, so a wrong payload only failed
at runtime with a `400`.

## Evidence

- `HttpClient` declared `get`/`post`; `unwrapEnvelope` returned `{ ok: true, data }`.
- `API_CONVENTION` §13 stated “no `patch`/`delete` transport yet”.
- Both registry arrays were annotated `readonly ApiEndpointContract[]`, which widened
  `requestSchema` to `z.ZodTypeAny` — the body type could not be derived.
- `paginatedSchema` threw inside its `transform`; zod reports such a throw as a `custom`
  issue with an **empty** path, so a client could not locate the violation.

## Root cause / rationale

Three different problems, one shared cause: the transport had never been designed as a
complete surface. The fix keeps one description of the contract (the registry) and one
decoder per response shape, instead of adding ad-hoc branches.

Alternatives rejected:

- **Second validation of a list body in the client** — would duplicate the pagination rule.
  Instead `paginatedSchema` now declares `pagination` as **required**, so the rule stays in
  `@callback/shared` and the violation arrives with the right path for free.
- **`try`/`catch` around the shared schema** — recovers the path only by matching a message
  string.
- **`getList` returning `data` + a separate `meta` call** — two sources of truth.
- **`body?: never` on `delete`** — the convention has no body-carrying delete; omitting the
  parameter is honest.

`onEvent` was moved here from AIS-84 so `http-client.interface.ts` is written once; AIS-84
keeps only the admin wiring. `outcome` reflects the whole attempt, so a `2xx` contract drift
is reported as an error.

## Solution

| File                                                                             | Change                                                                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/shared/src/contract/endpoint.body.ts`                                  | new `RequestBodyOf<TId>` (`z.infer` of the registry `requestSchema`; `never` for bodyless endpoints) |
| `packages/shared/src/contract/{api-keys/api-keys.contract,endpoint.registry}.ts` | `as const satisfies readonly ApiEndpointContract[]` (both widening points)                           |
| `packages/shared/src/contract/paginated.schema.ts`                               | `throw` → required `pagination` field                                                                |
| `packages/api-client/src/http-client.interface.ts`                               | six verbs, `ListRequest`, `HttpEvent`, optional `onEvent`                                            |
| `packages/api-client/src/http-client.ts`                                         | generic `attempt()` (guard → fetch → parse → emit), `parseListPayload`                               |
| `packages/api-client/src/query-string.{interface,logic}.ts`                      | new pure `toQueryString`                                                                             |
| `packages/api-client/src/paginated-envelope.logic.{interface,ts}`                | new `unwrapPaginatedEnvelope` → `ApiResult<TRows>`                                                   |
| `packages/api-client/src/envelope.logic*.ts`                                     | success widened with `meta`                                                                          |
| `packages/api-client/src/endpoint-path.ts`                                       | `UnresolvedPathParameterError` + guard                                                               |
| `packages/api-client/test/*`                                                     | query string, paginated unwrap, request-body types, verb matrix, `onEvent`, guard                    |
| `docs/Specs/API-Convention.md`                                                   | §9 rewritten, §13 gap replaced                                                                       |

## Outcome and how to verify

```bash
pnpm build
pnpm test            # shared 207, api-client 160, plus ui/admin/api
pnpm test:e2e
pnpm lint && pnpm format:check
pnpm quality && pnpm test:quality
pnpm --filter @callback/api-client test -t 'getList'
```

Manually: `pnpm dev`, open the admin; the network tab shows no `?q=undefined` artefacts, and
a list response without `meta.pagination` surfaces as `UNEXPECTED_PAYLOAD` with
`issues[0].path === 'meta.pagination'`.

## Follow-ups

- `ApiKeysService` still uses `get`; wiring `findByIdentifier`/`update`/`remove` and switching
  `list` to `getList` is AIS-110 (plus the admin list/pagination tickets AIS-116/AIS-119).
- `:identifier` substitution is the service's job; the transport only refuses an
  unsubstituted path.
- `knip` stays clean, so the new public exports did not need an ignore entry.
