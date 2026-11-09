# Entity page standardization — review and backlog

**Dátum:** 2026-11-08 23:58
**Status:** plan (no code changed by this document)
**Scope:** `apps/admin` entity pages — the `api-keys` reference slice and every future
entity page that copies it
**Normative sources:** [`New-Admin-Page.md`](../Specs/New-Admin-Page.md),
[`UI-Architecture.md`](../Specs/UI-Architecture.md) §4.0, §4.4, §5,
[`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md) §0–§13

---

## 1. Question this plan answers

> "Is everything already made reusable — standard windows, routes, URLs, notifications,
> error handling, api requests? Is there anything that does not follow a rule? What should
> be standardized for the entity pages?"

Short answer: **the architecture is standardized, the per-entity code is not.**
Every cross-cutting concern already has exactly one owner, and no rule violation was found
in `apps/admin/src`. What a new entity page still has to *copy* are ~600 lines of
near-identical glue — the four-state overlay body, five hook adapters, four sort/route
helpers and three registry entries. Those are the standardization targets.

---

## 2. Verdict per area

| Area | Owner today | Reusable? | Verdict |
| --- | --- | --- | --- |
| Standard windows (overlays) | `packages/ui` `EntityDialog`, `ConfirmDialog`, `Dialog` | **yes** | Frame, footer, submit-by-`form`-id, `submit: null` read-only, `footerExtras` are fully parameterised. The *body* is not: see F1 |
| Routes | [`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:64) | **yes (data-driven)** | One `RouteEntry` + breadcrumb fields; nav, `<Routes>` and breadcrumb all derive from it; `flattenRouteEntries` keeps one tree. The 3-entry overlay block is copy-paste: see F3 |
| URLs | [`use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:45) | **yes (fully generic)** | Schema-parameterised, one URL write per interaction, defaults omitted, invalid value falls back. Sort/route mapping helpers are *not* generic: see F4, F5 |
| Notifications | `NotificationHost` in `AdminLayout`, capture in `main.tsx`, `useNotifier()` port | **yes** | Compliant in both overlays: no page mounts the host, no page creates a store, no `meta.successMessage`. **No gap** |
| Error handling | `lib/error-surface.logic.ts` + `toApiErrorView` + `field-errors.logic.ts` | **yes** | Tiers (`banner`/`page`/`field`/`silent`) decided once; `quality:field-errors` enforces it and reports **0 violations**. The surface→slot projection is repeated: see F2 |
| API requests | contract → api-client service → `service.registry.ts` → generic hooks → thin feature adapter | **yes** | Paths come from the endpoint registry, never a literal. The *adapter layer* is ~200 lines of boilerplate per entity: see F6 |

No violation of the styling, layering, token, dead-code or docs gates was found. Searches for
direct `fetch`, raw `useForm`, `any`, default exports, `history.back()` and colour
literals/palette classes in `apps/admin/src` return nothing.

---

## 3. Findings

Severity: **H** = will multiply with every new entity page, **M** = maintenance/drift risk,
**L** = housekeeping.

| # | Sev | Finding | Where |
| --- | --- | --- | --- |
| F1 | **H** | The four-state overlay body (loading `sr-only` + `DescriptionList isLoading` → not-found `EmptyState` → `PageErrorState` + retry → content) is duplicated verbatim across the two detail overlays | [`ApiKeyViewDialog.tsx:93-131`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx:93), [`ApiKeyEditDialog.tsx:67-105`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditDialog.tsx:67) |
| F2 | **H** | `errorSurface === 'page' ? errorMessage : null` — the tier→slot projection is re-derived in three places instead of being returned by the hook layer | [`ApiKeysPage.tsx:61`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:61), [`ApiKeyViewDialog.tsx:70`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx:70), [`ApiKeyEditDialog.tsx:49`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditDialog.tsx:49) |
| F3 | **H** | Three registry children (create / view / edit) with ~8 lines each — same shape, same `breadcrumbParentPath`, same `resolveBreadcrumbLabel` for `:identifier` | [`route-registry.tsx:84-118`](../../apps/admin/src/app/router/route-registry.tsx:84) |
| F4 | **H** | `toTableSort`, `toSortParams`, `toApiKeySortField`, `isApiKeySortable` are entity-named re-implementations of a purely contract-driven mapping | [`api-keys.logic.ts:194-239`](../../apps/admin/src/pages/api-keys/api-keys.logic.ts:194) |
| F5 | **M** | Three near-identical `template.replace(':param', encodeURIComponent(x))` implementations exist in two packages | [`api-keys.logic.ts:166-188`](../../apps/admin/src/pages/api-keys/api-keys.logic.ts:166), [`api-keys.path.ts:23`](../../packages/api-client/src/api-keys/api-keys.path.ts:23) |
| F6 | **H** | Five hook adapters per entity (`useXQuery`, `useXDetailQuery`, `useCreate/Update/DeleteXMutation`) that differ only in service call, key and `onX` callback name | [`use-api-keys.ts:47-198`](../../apps/admin/src/features/api-keys/use-api-keys.ts:47) |
| F7 | **M** | The query-key factory (`all` / `list(params)` / `detail(id)`) is hand-written per feature; a key typo silently disables invalidation | [`features/api-keys/api-keys.const.ts:26-34`](../../apps/admin/src/features/api-keys/api-keys.const.ts:26) |
| F8 | **M** | The `<form id noValidate className="space-y-4">` + `Alert` for `formError` block is duplicated between the create and edit windows | [`ApiKeyCreateDialog.tsx:76-87`](../../apps/admin/src/pages/api-keys/ui/ApiKeyCreateDialog.tsx:76), [`ApiKeyEditDialogForm.tsx:109-119`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditDialogForm.tsx:109), [`ApiKeyFormFields.tsx:34-38`](../../apps/admin/src/pages/api-keys/ui/ApiKeyFormFields.tsx:34) |
| F9 | **M** | The same field copy exists twice: `Név`, `Leírás`, `Lejárat` (and their hints) are declared in both the create and the edit label maps, so a wording change can drift | [`api-keys.const.ts:104-123`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:104), [`api-keys.const.ts:238-253`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:238) |
| F10 | **M** | The list URL exists as two literals — `APP_ROUTE_API_KEYS_PATH` **and** `API_KEYS_LIST_ROUTE_PATH` — pinned only by a registry test, while the doc says "one literal, N consumers" | [`app.const.ts:45`](../../apps/admin/src/app/app.const.ts:45), [`api-keys.const.ts:261`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:261) |
| F11 | **L** | `sortable: isApiKeySortable('x')` is passed per column by hand, so a non-sortable column can be marked sortable | [`ApiKeysTable.tsx:22-58`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:22) |
| F12 | **L** | `LIMIT_OPTIONS` (default / 50 / max) is re-declared per page although all three numbers come from the contract | [`api-keys.const.ts:63-67`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:63) |
| F13 | **L** | Duplicate module imports: `@callback/ui` imported twice in one file (`buttonVariants` / `PlusIcon` split off) | [`ApiKeysPage.tsx:3-5`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:3), [`ApiKeyViewDialog.tsx:1-8`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx:1) |
| F14 | **L** | Retry/back copy that every entity needs identically (`Vissza a listához`, `Nem található`, retry labels) is re-declared per page instead of sitting next to `lib/error-surface.const.ts` | [`api-keys.const.ts:180-186`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:180) |

Not findings (checked, correct): no page store exists and `zustand` is not installed (§6.4
decision); the delete confirmation keeps its open flag in `useState` (AIS-173 exception);
`LoginPage` / `PlaceholderPage` / `NotFoundPage` / `CallsPlaceholderPage` are the four
documented surface exceptions; the `.catch(() => {})` in the delete handler is commented and
rendered by the confirmation, so it satisfies "never swallow silently".

---

## 4. Standardization backlog

Ordered by leverage. Each item names its target file so the work is mechanical.

| # | Standard | Target | Removes | Risk |
| --- | --- | --- | --- | --- |
| S1 | **`EntityOverlayBody`** — one component that takes `{ isLoading, isNotFound, pageErrorMessage, isRetrying, onRetry, onBack, loadingMessage, notFoundTitle, notFoundMessage, children }` and renders the four states | new `apps/admin/src/components/entity/EntityOverlayBody.tsx` | F1 (~80 lines) | low — pure presentation |
| S2 | **`useEntityOverlayState(detail)`** — returns `{ status, pageError, notFound, retry }` so no component compares `errorSurface` | new `apps/admin/src/features/entity-dialog/use-entity-overlay-state.ts` (`*.logic.ts` for the classification) | F2 | low |
| S3 | **`createEntityRouteEntries({...})`** — one call produces the parent entry plus create/view/edit children, including breadcrumb parent and the `:identifier` resolver | new `apps/admin/src/app/router/entity-routes.logic.ts` | F3 (~30 lines/entity) | medium — registry test must keep asserting data |
| S4 | **`createEntityQueryKeys(namespace)`** — `{ all, list(params), detail(id) }` from one namespace string | new `apps/admin/src/features/api/entity-query-keys.ts` | F7 | low |
| S5 | **`createEntityHooks({ service, keys, empty, entityName })`** — returns the five adapters; a page keeps only what is genuinely domain-specific (`toCreateInput`, stale-write re-read) | new `apps/admin/src/features/api/create-entity-hooks.ts` | F6 (~200 lines/entity) | medium — types must stay narrow |
| S6 | **`useTableSort({ sortFields, defaultSort })`** — `{ toTableSort, toSortParams, isSortable }`, derived from the contract allow-list | new `apps/admin/src/features/api/use-table-sort.ts` | F4, F11 | low |
| S7 | **`buildRoutePath(template, param, value)`** — one substitution helper, used by both `pages/**` route builders and `packages/api-client` path modules | new `apps/admin/src/lib/route-path.logic.ts` (+ reuse in `api-client`) | F5 | low |
| S8 | **`toPageErrorView(errorSurface, errorMessage)`** in the hook layer (or a `pageError` field on every result) | `apps/admin/src/features/api/api-hooks.logic.ts` | F2 residual | low |
| S9 | **`EntityFormShell`** — form id, `noValidate`, spacing and the `formError` `Alert` in one place; field ids derived by `toFieldId(formId, field)` | new `apps/admin/src/components/entity/EntityFormShell.tsx` | F8 | low |
| S10 | **One field-copy map per entity** (`label`, `createHint`, `editHint`) instead of a create map plus an edit map | page `<page>.const.ts` shape, documented in `New-Admin-Page.md` step 12b | F9 | low |
| S11 | **One list-path literal** — page const owns it, `app.const.ts` re-exports it (app → pages is legal for the registry already) | `app/app.const.ts` + page const | F10 | low |
| S12 | **`EntityListPage` scaffold** — header link action + `PageShell` + `DataTable` + `Pagination` + `PageErrorState` + `Outlet`, parameterised by columns, copy and hook | new `apps/admin/src/components/entity/EntityListPage.tsx` (or a documented template) | duplicated list composition per entity | **higher** — see §5 |
| S13 | **Shared entity copy** — `ENTITY_NOT_FOUND_TITLE/MESSAGE`, `ENTITY_BACK_TO_LIST_LABEL` next to the retry labels | `apps/admin/src/lib/error-surface.const.ts` | F14 | low |
| S14 | **`ENTITY_LIST_LIMIT_OPTIONS`** from the contract (default / middle / max) | `packages/shared` or `features/api` const | F12 | low |
| S15 | **Executable template** — a `templates/entity-page/` fixture that `pnpm typecheck` compiles, so the standard is code, not prose | new `apps/admin/src/pages/__template__/` (excluded from routing, kept compiling) | "copy the last page and hope" | medium |
| S16 | **Housekeeping** — merge duplicate `@callback/ui` imports, enable `no-duplicate-imports` | `apps/admin` lint config | F13 | low |

**Recommended sequencing:** S7 → S2/S8 → S1 → S4 → S6 → S3 → S9/S10 → S5 → S11–S16 → S12/S15.
The first eight are mechanical and each one shrinks the next. S5 and S3 change shape rather than
delete lines, so they come after the small helpers that they would otherwise duplicate.

---

## 5. Why S12 is deliberately last (and optional)

The list composition is the only place where a genuine *variation* point exists: filter bar,
bulk selection, per-row actions and tabs are all plausible and all page-specific. A scaffold
that tries to own them becomes a configuration object with a dozen boolean props — the opposite
of the §8 "props-driven, one responsibility" rule. So S12 is scoped to the **AIS-174 standard
list only** (header link + table + pager + error + outlet) and must stay slot-based: a page that
needs filters passes them as `children`. If that cannot be expressed without a boolean forest,
the item is dropped and step 11 of [`New-Admin-Page.md`](../Specs/New-Admin-Page.md) stays prose.

---

## 6. Out of scope (documented gaps, unchanged by this plan)

- **No search / filter UI.** `useListParams` parses `search`; no page exposes it. Needs its own ticket.
- **No per-row action.** The row name is the link into the read-only overlay. Needs its own ticket.
- **No page store.** `zustand` stays uninstalled until a page has genuine transient UI state (§6.4).
- **No code generator.** S15 is a compiling template; a generator script is a separate decision.

---

## 7. Definition of done for the backlog

```bash
pnpm quality            # layers + dead code + tokens + themes + field errors + docs
pnpm test:quality
pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
```

Plus, per item: the new helper has its own `*.test.ts` covering all branches, the
`api-keys` slice is migrated to it **in the same change** (no second pattern left behind), and
[`New-Admin-Page.md`](../Specs/New-Admin-Page.md) step 9/11/12 plus
[`UI-Architecture.md`](../Specs/UI-Architecture.md) §4.0/§5 are updated so the next page reads
the new recipe instead of the old one.
