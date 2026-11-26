# Entity page standardization — decision record

**Date:** 2026-11-08 23:58
**Plan:** [`2026-11-08--23-58-00-entity-page-standardization-plan.md`](../plans/2026-11-08--23-58-00-entity-page-standardization-plan.md)
**Status:** review complete, implementation not started

---

## 1. Problem / feature

The admin app has exactly one entity page (`api-keys`), built as the reference slice for every
page that follows. The question was whether that slice had already pushed the cross-cutting
concerns into reusable pieces — windows, routes, URLs, notifications, error handling, API
requests — or whether a second entity page would still copy a large amount of glue.

## 2. Measured data / evidence

| Concern | Reusable today | Measured duplication per additional entity page |
| --- | --- | --- |
| Overlay windows (`EntityDialog`, `ConfirmDialog`) | yes | frame 0 lines, **body ~80 lines** |
| Routes (registry, nav, breadcrumb) | yes | **~30 lines** of registry entries |
| URLs (`useListParams`) | yes | sort/route mapping **~45 lines** |
| Notifications | yes | **0** — host mounted once in `AdminLayout` |
| Error handling | yes | tier→slot projection **3 sites** |
| API requests | yes | hook adapters **~200 lines** |

Gate status: `quality:field-errors` reports no violations; searches for `fetch`, raw `useForm`,
`any`, default exports, `history.back()` and colour literals in `apps/admin/src` return nothing.

## 3. Root cause / design rationale

The two layers below the page were generalized when they were extracted
(`features/api/use-api-*`, `lib/error-surface.logic.ts`, `packages/ui` primitives), but the
**page-local composition layer was not**: it is the layer where a reference slice legitimately
looks like a single page. Nothing is wrong with those 600 lines individually — each follows the
rules — they are simply still shaped as "one page" instead of "one page *type*".

The alternative considered and rejected: a single generic `<EntityPage config={…}>` component.
It would have to own filters, bulk selection, per-row actions and tabs — all genuinely
page-specific — and would turn into a boolean forest, violating the "props-driven, one
responsibility" rule. The chosen shape is therefore a set of small helpers plus slot-based
composition, not one configurable page.

## 4. Solution / implementation

No code changed. The plan defines 16 items; the ordered set is:

| # | Item | Removes |
| --- | --- | --- |
| S7 | `buildRoutePath(template, param, value)` | 3 hand-written `String.replace` builders in 2 packages |
| S2/S8 | `useEntityOverlayState` + `toPageErrorView` | 3 × `errorSurface === 'page'` projection |
| S1 | `EntityOverlayBody` (loading / not-found / page-error / content) | ~80 duplicated lines |
| S4 | `createEntityQueryKeys(namespace)` | hand-written key factories |
| S6 | `useTableSort({ sortFields, defaultSort })` | 4 entity-named sort helpers |
| S3 | `createEntityRouteEntries({...})` | 3 registry children per entity |
| S9/S10 | `EntityFormShell` + one field-copy map | duplicated `<form>` + `Alert`, duplicated labels |
| S5 | `createEntityHooks({service, keys, empty})` | ~200 adapter lines |
| S11–S16 | single list-path literal, shared copy, limit options, compiling template, `LIMIT_OPTIONS`, duplicate imports | drift risks |

Deliberately deferred: a generic list-page scaffold (S12) and a code generator — the first stays
slot-based or is dropped, the second is a separate decision.

## 5. Outcome and how to verify

End state: a new entity page contributes only its contract, its domain mapping and its column /
field / copy declarations; the overlay body, hooks, sort mapping, registry children and route
builders come from shared modules.

Verification per item:

```bash
pnpm quality        # includes quality:layers, quality:field-errors, quality:docs
pnpm test:quality
pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
```

Acceptance: after S1–S10 the `api-keys` slice is migrated in the same change (no second pattern
left behind), and a new entity page's diff contains no `errorSurface ===` comparison, no
`template.replace(':`, and no hand-written query-key array.

## 6. Follow-ups

- Search/filter UI and per-row actions stay documented gaps (they need their own tickets).
- `zustand` stays uninstalled until a page has genuine transient UI state.
- The two literals for the list URL (F10) are currently held together by a registry test only.
