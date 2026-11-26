# AIS-119 — URL-owned list state (`useListParams`)

## 1. Problem / feature

List filters, sort and page in the admin SPA had no defined home. The rules forbid storing
server data in a store, and the previous page (`api-keys`) kept no list state at all, so the
next list page would have reinvented it. AIS-119 adds the canonical mechanism: list state
lives **in the URL**, so a link is copyable, back/forward works, and a reload keeps the view.

## 2. Measured data / evidence

- Admin suite before: 20 files / 173 tests → after: **22 files / 193 tests** (+20).
- `?limit=999` → `limit: 20`; `?page=abc` → `page: 1`; no throw, no empty page (tests).
- `?page=1` and default `sort` never appear in the URL (tests).
- New npm dependencies: **0** (`package.json` files unchanged).

## 3. Root cause or design rationale

Alternatives considered: (a) a per-page Zustand store for filters — rejected, the rules put
list state in the URL and the ticket forbids a new dependency; (b) hard-coding the defaults in
the hook — rejected, the schema is the single source of truth; (c) parsing the candidate with
`schema.parse` — rejected, it would throw on an invalid `?limit=999` instead of defaulting.
The schema (`listQuerySchema` / `createListQuerySchema([...])`) already defaults every field,
so an empty record parse yields the canonical defaults.

## 4. Solution / implementation

| File                                                        | Change                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/admin/src/features/api/use-list-params.interface.ts`  | `ListParams`, `ListParamsSchema`, `UseListParamsResult`          |
| `apps/admin/src/features/api/use-list-params.const.ts`      | `page` field name, default page, error message                   |
| `apps/admin/src/features/api/use-list-params.logic.ts`      | pure parse/default/reset/URL-building + `ListParamsError`        |
| `apps/admin/src/features/api/use-list-params.ts`            | `useListParams(schema)` hook (memo on `searchParams.toString()`) |
| `apps/admin/src/features/api/use-list-params.logic.test.ts` | 13 pure-logic tests                                              |
| `apps/admin/src/features/api/use-list-params.test.tsx`      | 7 hook tests through a memory router                             |
| `apps/admin/src/test/mocks/app-router.mock.tsx`             | `renderHookWithRouter` + `getSearch()`                           |
| `docs/Specs/UI-Architecture.md`                             | §5 note: list state lives in the URL, `zustand` stays out        |

## 5. Outcome and how to verify

```bash
pnpm --filter @callback/admin build
pnpm --filter @callback/admin test   # 22 files / 193 tests, green
pnpm --filter @callback/admin lint
```

Manual: `useListParams(createListQuerySchema(['name','createdAt'], 'createdAt'))` with
`initialEntries: ['/api-keys?page=3']` reads `page: 3`; `setParam('q', 'x')` writes `?q=x`
and drops `page`; `resetParams()` empties the URL.

## 6. Follow-ups

- `useApiList` (AIS-114) will consume `params` as part of a TanStack Query key.
- The parametrised service transport (`packages/api-client`) is AIS-109 — the hook itself
  performs no fetch.
- Filter/sort/pager UI primitives are AIS-104 / AIS-116.
