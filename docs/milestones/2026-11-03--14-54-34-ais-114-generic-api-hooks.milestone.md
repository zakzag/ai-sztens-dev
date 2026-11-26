# AIS-114 — Admin generic hook layer

**Date:** 2026-11-03 (Europe/Budapest) · **Ticket:** AIS-114 (subtask of AIS-103) · **Plan:** `docs/plans/2026-11-03--01-51-00-ais-114-generic-api-hooks-plan.md`

## 1. Problem / feature

The admin SPA duplicated “loading / error / refetch / invalidate” in every query hook (`useApiKeysQuery`,
`useCreateApiKeyMutation`). There was no shared layer that turns TanStack Query state into the narrow, already-mapped view
the UI consumes (raw `ApiError`, Hungarian `errorMessage`, `errorSurface` tier, and — for lists — `meta.pagination`). The
generic layer is the reference implementation every future admin hook builds on.

## 2. Measured data / evidence

- `pnpm --filter @callback/api-client test` → **8 suites / 169 tests** green.
- `pnpm --filter @callback/admin test` → **27 files / 223 tests** green (including the migrated `use-api-keys.*`).
- `pnpm lint` → exit 0, zero warnings; `pnpm quality` → exit 0 (layers, knip, palette, field-errors).
- `pnpm format:check` → my files prettier-clean. The 12 pre-existing unformatted files were left untouched except the 11
  that belong to this change (re-formatted); `.roo/rules/window-shell.md` remains as a known predecessor issue.
- `pnpm test:e2e` → **5 suites skipped** (`database-gate skipped: no Postgres reachable`). This is environmental — those
  suites need `pnpm db:up`. Not caused by this change; the unit matrix uses doubles only.

## 3. Root cause or design rationale

- **State ≠ rules.** The hooks translate state into a view model; filtering / sorting / field-path mapping stay in pure
  `*.logic.ts` (SOLID single-responsibility, no I/O inside the hook).
- **`meta` typing is non-null on success, `null` until then** — no `any`, no assertion. While loading or after a failure
  the pager block simply does not exist yet; `data` falls back to the caller-supplied stable `emptyData`.
- **Cancellation is real.** The read hooks' `queryFn` receives `{ signal }`; an aborted read arrives as an abort-like error
  already classified `silent` by `toErrorSurface()`, so the `silent` tier is reachable on the generic path.
- **No notification dependency.** `useApiMutation` accepts optional `meta: { successMessage? }` and returns it untouched;
  AIS-84 wires the global capture later.

## 4. Solution / implementation

Changed files (grouped):

| Group             | Files                                                                                                                             | One-line description                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| New generic layer | `apps/admin/src/features/api/{api-hooks.interface,api-hooks.logic,use-api-list,use-api-detail,use-api-mutation}.{ts,tsx}` + tests | Three hooks + pure error-view logic; query keys passed as params.                                                     |
| Client contract   | `packages/api-client/src/api-keys/{api-keys.interface,api-keys.service,api-keys.const,api-keys.path}.ts` + `index.ts`             | `list → getList`, new `findByIdentifier`, registry-derived detail path, default sort omitted from URL.                |
| Migration         | `apps/admin/src/features/api-keys/{use-api-keys,api-keys.const,api-keys.interface}.{ts}`                                          | Thin adapters over the generic hooks; public result shapes unchanged.                                                 |
| Page wiring       | `apps/admin/src/pages/api-keys/ApiKeysPage.tsx`                                                                                   | Threads `useListParams` into the hook; pager UI out of scope (AIS-116).                                               |
| Test doubles      | `apps/admin/src/test/mocks/handlers/{handler-envelope,api-keys.handlers}.ts`                                                      | Every list handler carries `meta.pagination`; new detail/page-two fixtures.                                           |
| Docs              | `docs/history/2026-11-03--14-54-34-ais-114-generic-api-hooks.md`, `docs/milestones/…`                                             | Change summary + decision record. Living specs (`UI-Architecture.md`, `API-Convention.md`) deferred — see follow-ups. |

## 5. Outcome and how to verify

The admin `/api-keys` page now reads its query params from the URL (`?page=1&limit=5&sort=name`) and exposes
`meta.pagination`; a deep link works immediately, and a page past the end renders an empty table (not an error). To
confirm:

```bash
pnpm --filter @callback/api-client test        # 8 suites / 169 tests
pnpm --filter @callback/admin test             # 27 files / 223 tests
pnpm lint && pnpm quality                      # both exit 0
pnpm format:check                              # my files clean (pre-existing drift untouched)
```

Manual smoke: `pnpm --filter @callback/admin dev`, open `/api-keys?page=1&limit=5&sort=name` — the request must carry
exactly those params. For the persistence path, run `pnpm db:up` then `pnpm test:e2e`.

## 6. Follow-ups (optional)

- **AIS-110** — registry has 5 operations but the client exposes 3; add `update`/`remove` and a “every registry entry
  has a client method” test that fails on drift.
- **AIS-116** — `Pagination` / `DataTable` / `EmptyState` primitives consuming the `meta.pagination` this ticket now
  exposes on `/api-keys`.
- The plan drafted an optional `api-hooks.const.ts`; query keys were threaded as params instead, so it was not created.
- **Deferred spec update** — `docs/Specs/UI-Architecture.md` (a `features/api/` hooks row + the `pages/api-keys` page-state
  row noting query params now feed `useApiList`) and `docs/Specs/API-Convention.md` (the client transport section) still
  need their AIS-114 rows. Left out of this commit deliberately rather than claimed as done.
