# AIS-96 — admin: page-level `Alert` + retry and app-level banner (401 / offline / 503)

**Date:** 2026-10-28
**Ticket:** <https://zakzag.atlassian.net/browse/AIS-96> (subtask of AIS-87)
**Plan:** `docs/plans/2026-10-28--23-25-00-ais-96-admin-error-surfaces-banner-page-plan.md`
**Spec:** `docs/Specs/UI-Architecture.md` §4.1

## What was asked

Two of the four `D11` error tiers were missing. A failed list read ended in an inline `Alert`
inside the table card — visually identical to a network outage — and nothing reacted to a `401`
at all. This change adds tier 2 (page alert + retry) and tier 3 (app banner), decided by one pure
function. Toast/log drawer stay in AIS-86.

## What changed

| File                                                                  | Change                                                                                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/banner/banner.variants.ts`                | NEW — CVA recipe (`info`/`warning`/`danger`), token-only accents, full-width strip.                                                                   |
| `packages/ui/src/components/banner/banner.interface.ts`               | NEW — `BannerProps` as `BannerBaseProps & (BannerDismissibleProps \| BannerStaticProps)`, so `dismissLabel` is mandatory whenever `onDismiss` exists. |
| `packages/ui/src/components/banner/Banner.tsx`                        | NEW — `role="alert"` for `danger`, `role="status"` otherwise; `action` slot; labelled close control.                                                  |
| `packages/ui/src/index.ts`                                            | CHANGE — explicit `Banner` / `bannerVariants` / type exports.                                                                                         |
| `packages/ui/test/banner.test.tsx`                                    | NEW — 10 cases (variants, roles, title, action, dismiss, no dismiss, `cn` merge).                                                                     |
| `apps/admin/src/lib/error-surface.interface.ts`                       | NEW — `ErrorSurface`, `BannerCondition`, `BannerCopy`, `BannerModel`, `NamedErrorLike`.                                                               |
| `apps/admin/src/lib/error-surface.const.ts`                           | NEW — Hungarian banner/page copy, `FIELD_SURFACE_CODES` (single source), `BANNER_COPY`, `BANNER_CONDITION_PRIORITY`, `ABORT_LIKE_ERROR_NAMES`.        |
| `apps/admin/src/lib/error-surface.logic.ts`                           | NEW — `isAbortLike`, `toApiError`, `toErrorSurface`, `toBannerCondition`, `toBannerModel`.                                                            |
| `apps/admin/src/lib/error-surface.logic.test.ts`                      | NEW — 26 cases covering every surface branch and the banner precedence.                                                                               |
| `apps/admin/src/features/error-surface/query-error.store.ts`          | NEW — stable snapshot of the query cache errors for `useSyncExternalStore`.                                                                           |
| `apps/admin/src/features/error-surface/error-surface.interface.ts`    | NEW — `QueryErrorStore`.                                                                                                                              |
| `apps/admin/src/features/error-surface/use-online-status.ts`          | NEW — `navigator.onLine` + `online`/`offline` events.                                                                                                 |
| `apps/admin/src/features/error-surface/use-app-error-banner.ts`       | NEW — derives `{ model, dismiss }`; dismissal is `useState`, reset when the cached error set changes.                                                 |
| `apps/admin/src/features/error-surface/use-app-error-banner.test.tsx` | NEW — 6 wiring cases.                                                                                                                                 |
| `apps/admin/src/components/error/app-error-banner.interface.ts`       | NEW — `AppErrorBannerProps` (`onLogin` injected).                                                                                                     |
| `apps/admin/src/components/error/AppErrorBanner.tsx`                  | NEW — model → `Banner`; returns `null` when no condition.                                                                                             |
| `apps/admin/src/components/error/AppErrorBanner.test.tsx`             | NEW — 8 cases (offline/online, 401 CTA, 503, no-response, 500 ignored, dismiss, reappear).                                                            |
| `apps/admin/src/components/error/page-error-state.interface.ts`       | NEW — `PageErrorStateProps`.                                                                                                                          |
| `apps/admin/src/components/error/PageErrorState.tsx`                  | NEW — `Alert` + retry button, disabled while `isRetrying`.                                                                                            |
| `apps/admin/src/components/error/PageErrorState.test.tsx`             | NEW — 4 cases.                                                                                                                                        |
| `apps/admin/src/App.tsx`                                              | CHANGE — `<AppErrorBanner onLogin={logout} />` above the header.                                                                                      |
| `apps/admin/src/features/api-keys/api-keys.interface.ts`              | CHANGE — query result exposes `error: ApiError \| null`, `errorMessage`, `errorSurface`, `isFetching`.                                                |
| `apps/admin/src/features/api-keys/use-api-keys.ts`                    | CHANGE — builds those fields via `toApiError` / `toErrorMessage` / `toErrorSurface`.                                                                  |
| `apps/admin/src/features/api-keys/api-keys.const.ts`                  | CHANGE — `FIELD_ERROR_CODES` is now a re-export of `FIELD_SURFACE_CODES`.                                                                             |
| `apps/admin/src/pages/api-keys/ApiKeysPage.tsx`                       | CHANGE — `PageErrorState` when `errorSurface === 'page'`, otherwise the table.                                                                        |
| `apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx`                   | CHANGE — error branch removed (`error`, `onRetry` props dropped).                                                                                     |
| `apps/admin/src/pages/api-keys/api-keys.interface.ts`                 | CHANGE — `ApiKeysTableProps` = rows + `isLoading`.                                                                                                    |
| `apps/admin/src/pages/api-keys/api-keys.const.ts`                     | CHANGE — `API_KEYS_RETRY_LABEL` removed (the retry copy is global).                                                                                   |
| `apps/admin/src/test/mocks/api-error.mock.ts`                         | CHANGE — `createAbortError()`, `createServerErrorWithRequestId()`; repaired the `createStatusError` doc block.                                        |
| `apps/admin/src/test/mocks/online-status.mock.ts`                     | NEW — `mockOnlineStatus`, `emitConnectivityEvent`, `restoreOnlineStatus`.                                                                             |
| `apps/admin/src/test/mocks/query-error.mock.ts`                       | NEW — `seedQueryError`, `clearQueryErrors`.                                                                                                           |
| Tests updated                                                         | `ApiKeysTable.test.tsx` (error case removed), `use-api-keys.test.tsx` (surface/message/requestId assertions).                                         |
| `docs/Specs/UI-Architecture.md`                                       | CHANGE — date, layer map, `Banner` primitive row, §4.1 error surfaces, api-keys state row.                                                            |

## Behaviour rules (frozen)

1. **One classifier** — `toErrorSurface`: abort → `silent`, non-`ApiError` → `page`, `status === null` → `banner`, `401`/`503` → `banner`, field code + `issues[]` → `field`, everything else → `page`.
2. **No banner store** — the condition is derived from `navigator.onLine` + the query cache; the only local state is the dismissal flag, which is reset when the cached error set changes.
3. **One condition at a time** — offline beats `401`, `401` beats `503`; nothing stacks.
4. **No duplicate sentence** — the page renders `PageErrorState` only for `page`; banner conditions are left to the layout shell.
5. **No auto-hide** — the banner disappears only when the condition ends or the user closes it.
6. **The 401 CTA only clears the session** — `logout()`; the existing `ProtectedLayout` then renders the login form.
7. **Server text never rendered** — copy comes from `lib/error-surface.const.ts` / `toErrorMessage`.

## Verification

```
pnpm --filter @callback/ui test        # 71 tests, 9 files
pnpm --filter @callback/admin test     # 145 tests, 14 files
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
```

All green; palette check over `apps/admin/src` + `packages/ui/src` returns nothing.

## Notes for the next ticket (AIS-86)

`useApiKeysQuery` still exposes the raw `ApiError`, so `requestId` is available for the log
drawer. The banner deliberately ignores mutation failures — those are toast-tier.
