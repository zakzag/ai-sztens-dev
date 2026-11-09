# Entity page standardization — audit and backlog

**Utolsó frissítés:** 2026-11-08
**Status:** plan (not implemented)
**Scope:** `apps/admin` entity pages, `packages/ui`, `features/api`, `features/entity-dialog`, routing
**Reference slice:** `pages/api-keys` (the only real entity page today)

---

## 1. What is already reusable

| Area | Reusable, no work needed |
| --- | --- |
| Standard window | [`PageShell`](../../packages/ui/src/components/page-shell/PageShell.tsx:1), [`Card`](../../packages/ui/src/components/card/Card.tsx:1), [`DataTable`](../../packages/ui/src/components/data-table/DataTable.tsx:1), [`Pagination`](../../packages/ui/src/components/pagination/Pagination.tsx:1), [`EmptyState`](../../packages/ui/src/components/empty-state/EmptyState.tsx:1), [`DescriptionList`](../../packages/ui/src/components/description-list/DescriptionList.tsx:1), [`StatusBadge`](../../packages/ui/src/components/status-badge/StatusBadge.tsx:1), [`EntityDialog`](../../packages/ui/src/components/entity-dialog/EntityDialog.tsx:1), [`ConfirmDialog`](../../packages/ui/src/components/confirm-dialog/ConfirmDialog.tsx:1) |
| Routes and URLs | [`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:1) is the single route source; [`RouteEntry`](../../apps/admin/src/app/router/route-entry.interface.ts:1) carries `children`, breadcrumb label/parent/resolver; [`useEntityDialog`](../../apps/admin/src/features/entity-dialog/use-entity-dialog.ts:1) closes with `replace`; [`useListParams`](../../apps/admin/src/features/api/use-list-params.ts:1) owns list state in the URL |
| Notifications | [`NotificationHost`](../../apps/admin/src/app/layout/AdminLayout.tsx:69) is mounted once in the layout; capture adapters bound in `main.tsx`; a page only passes `useNotifier()` + `successMessage` into `useAppForm` |
| Error handling | [`toErrorSurface`](../../apps/admin/src/lib/error-surface.logic.ts:111) classifies `silent / banner / page / field`; [`PageErrorState`](../../apps/admin/src/components/error/PageErrorState.tsx:1); [`AppErrorBanner`](../../apps/admin/src/components/error/AppErrorBanner.tsx:21) in the layout; `useAppForm` maps field errors; `isNotFoundFailure` / `isStaleWriteFailure` |
| API requests | shared contract + [`endpoint.registry.ts`](../../packages/shared/src/contract/endpoint.registry.ts:1); [`service.registry.ts`](../../packages/api-client/src/service.registry.ts:1); generic [`useApiList`](../../apps/admin/src/features/api/use-api-list.ts:1) / [`useApiDetail`](../../apps/admin/src/features/api/use-api-detail.ts:1) / [`useApiMutation`](../../apps/admin/src/features/api/use-api-mutation.ts:1) |

**Verdict:** the platform layer is genuinely reusable. The gaps are all at the **entity page composition** level — the part a second entity copies verbatim.

---

## 2. What is not reusable yet (duplication and gaps)

| # | Gap | Evidence | Cost per new entity |
| --- | --- | --- | --- |
| G1 | The four-state detail block (`loading / not-found / page-error / ready`) is copy-pasted | [`ApiKeyViewDialog.tsx:95-131`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx:95) and [`ApiKeyEditDialog.tsx:69-105`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditDialog.tsx:69) | ~40 lines, and the branch **order already differs** between the two |
| G2 | No generic read-only overlay container | view dialog re-implements skeleton + `EmptyState` + `PageErrorState` + footer extras | ~130 lines |
| G3 | Create and edit form windows are near-identical | [`ApiKeyCreateDialog.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyCreateDialog.tsx:47) vs [`ApiKeyEditDialogForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditDialogForm.tsx:54) | ~80 lines |
| G4 | Route path builders are hand-written per entity | [`toApiKeyViewRoute`](../../apps/admin/src/pages/api-keys/api-keys.logic.ts:166) and `toApiKeyEditRoute` repeat the same `replace(:param, encodeURIComponent)` | 2 functions + tests |
| G5 | Query keys are a hand-copied shape | [`API_KEYS_QUERY_KEYS`](../../apps/admin/src/features/api-keys/api-keys.const.ts:26) — invalidation correctness depends on the `all` literal agreeing | 1 object |
| G6 | Field metadata is triplicated (create ids/labels/hints + edit ids/labels/hints) | [`api-keys.const.ts:93-137, 228-253`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:93) — `name/description/expiresAt` declared twice | ~60 lines |
| G7 | No `link` style primitive — inline recipes | [`ApiKeysTable.tsx:33`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:33) `text-text-primary underline-offset-4 hover:underline` | rule §7.4 breach |
| G8 | Bespoke detail header markup | [`ApiKeyDetailFields.tsx:49-58`](../../apps/admin/src/pages/api-keys/ui/ApiKeyDetailFields.tsx:49) | rule §7.4 breach |
| G9 | List-page composition is the next copy-paste | [`ApiKeysPage.tsx:49-123`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:49): `useListParams → useApiList → map → 4 states → DataTable + Pagination + Outlet` | ~75 lines |
| G10 | Route literals declared in three places | `APP_ROUTE_API_KEYS_PATH` ([app.const.ts:45](../../apps/admin/src/app/app.const.ts:45)), `API_KEYS_LIST_ROUTE_PATH` ([api-keys.const.ts:261](../../apps/admin/src/pages/api-keys/api-keys.const.ts:261)), created/edit templates | fragile, pinned only by a test |
| G11 | Swallowed rejection pattern is ad hoc | [`ApiKeyViewDialog.tsx:88`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx:88) `void deleteApiKey().catch(() => {})` | undocumented standard |
| G12 | No generic `useEntityDetailQuery` adapter | every entity repeats `errorSurface === 'page' ? errorMessage : null` + refetch plumbing | ~15 lines |

---

## 3. Standardization backlog (ordered, lowest risk first)

> Layer order is fixed: `packages/ui → lib → features/<generic> → pages`. Each item ships with tests and a `docs/Specs` update.

### S1 — `toEntityRoute` helper (pure, `apps/admin/src/lib/route.ts`)
Replaces G4. One function: `toEntityRoute(template, param, value)` → encoded path. `toApiKeyViewRoute` / `toApiKeyEditRoute` become one-line wrappers.

### S2 — `createEntityQueryKeys(namespace)` factory (`features/api/entity-query-keys.ts`)
Replaces G5. Guarantees `all` / `list(params)` / `detail(id)` share the prefix, so invalidation cannot drift.

### S3 — `useEntityDetailState` / `resolveEntityDetailState` (`features/entity-dialog/`)
Replaces G1 + G12. Pure resolver returns a discriminated `loading | notFound | error | ready`; hook wraps `useApiDetail` and exposes the state plus `refetch`. Both overlays then switch on one union instead of branching twice.

### S4 — `EntityViewDialog` container (`pages/<page>/ui/` template or `features/entity-dialog/`)
Replaces G2. Generic read-only overlay: `EntityDialog` + the S3 states + `footerExtras` slot (edit link + delete). Entity supplies title, field block, delete mutation.

### S5 — `EntityFormDialog` / `useEntityFormDialog` (`features/entity-dialog/`)
Replaces G3. Generic create/edit window: `EntityDialog` + `<form id>` + residue `Alert` + footer submit; entity supplies schema, defaults, field renderer, submit, success copy.

### S6 — Field metadata single source (`defineEntityFields`)
Replaces G6. One declaration `{ name, label, hint, id, kind }[]` derives create and edit id/label/hint maps and `fieldPaths`.

### S7 — `Link` / `linkVariants` primitive (`packages/ui`)
Replaces G7. Closes the §7.4 breach; table links and any in-page link use it.

### S8 — `DetailSection` / `BadgeRow` primitive (`packages/ui`)
Replaces G8. Closes the §7.4 breach for the expiry header recipe.

### S9 — `toVoid` / `runIgnoringRejection` helper (`lib`)
Replaces G11. Documented, named way to acknowledge a handled rejection without an empty `catch`.

### S10 — Route-path module per entity (`pages/<page>/<page>.routes.ts`)
Replaces G10. One file owns list path + create/view/edit templates + builders; the route registry and the page both import it. `app.const.ts` keeps only nav labels and the list path constant that the registry re-uses.

### S11 — Document the standard (`docs/Specs/New-Admin-Page.md`)
Add to §2 a step "reuse S1–S10 scaffolding"; add to §3 (Do not) rows: *do not copy the four-state block*, *do not hand-write a route builder*, *do not declare field ids twice*. Update `UI-Architecture.md` §5 state plan and §4 primitive list.

---

## 4. Rule deviations found (fix with the items above)

| Deviation | Rule | Fixed by |
| --- | --- | --- |
| Inline link style and bespoke detail-header markup | `react.coding-standards.md` §7.4 | S7, S8 |
| Same four-state logic duplicated → double test surface | §0.9, §10 | S3, S4 |
| Two overlays branch in a **different order** (latent defect) | §0.6 (one owner per rule) | S3 |
| Empty `.catch(() => {})` with no named helper | §9 (error handling) | S9 |
| Route literals in three files | §6.2 / single source | S10 |

---

## 5. Verification

```bash
pnpm quality        # layers + dead code + tokens + field errors + docs
pnpm test:quality
pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
```

Success signal: adding a second entity page reuses S1–S10 and creates **no** four-state block, **no** route builder and **no** duplicated field ids.
