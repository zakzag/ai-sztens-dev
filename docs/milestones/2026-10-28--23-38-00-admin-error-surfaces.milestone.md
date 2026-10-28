# Admin error surfaces — page alert + retry and app banner (AIS-96)

**Ticket:** <https://zakzag.atlassian.net/browse/AIS-96> · **Plan:** `docs/plans/2026-10-28--23-25-00-ais-96-admin-error-surfaces-banner-page-plan.md`

## Problem

The `D11` design (unified API contract plan) defines four places where a server error may become
visible. Only tier 1 (field errors, AIS-95) and an improvised inline alert existed:

- a failed list read rendered an `Alert` **inside the table card**, so “the server answered 500”
  and “the laptop is offline” looked the same;
- nothing reacted to `401` — the admin kept talking to the API with a dead token;
- there was no persistent, app-level message for conditions that outlive a page.

## Evidence

| Situation | Before |
|---|---|
| DevTools offline + list open | one sentence in the table card, no retry hint, no distinction from a `500` |
| `401` on any request | silent: same alert text as a `409`, no session action |
| `503` | plain `SERVER_ERROR_MESSAGE`, no “temporary outage” signal |
| Same failure on two pages | two separate components decided copy independently |

## Design rationale

- **One classifier.** `toErrorSurface(error)` is pure and total, so tier selection is testable and
  cannot drift between components: abort → `silent`, non-`ApiError` → `page`, `status === null` →
  `banner`, `401`/`503` → `banner`, field code with `issues[]` → `field`, else `page`.
- **No banner store.** The condition is *derived*: `navigator.onLine` (via `useSyncExternalStore`)
  plus the errors already in the TanStack Query cache. Copying server state into Zustand is what the
  UI rules forbid, and a store would let the banner drift from the cache.
- **Alternatives rejected.** (a) per-page banner wiring — every new page would forget it;
  (b) a Zustand `banner` slice — a second source of truth for server state;
  (c) auto-hiding after N seconds (SWR behaviour) — hides a condition that is still true.
- **One condition at a time.** offline → `401` → `503`; the banner never stacks two sentences, and
  the page suppresses its own alert for banner-classified failures, so a single failure has exactly
  one voice.
- **The error object keeps `requestId`**, which the AIS-86 log drawer will display.

## Implementation

| Area | Files |
|---|---|
| New primitive | `packages/ui/src/components/banner/{Banner.tsx,banner.variants.ts,banner.interface.ts}` (+ `index.ts`, `test/banner.test.tsx`) |
| Classifier (pure) | `apps/admin/src/lib/error-surface.{interface,const,logic}.ts` (+ `error-surface.logic.test.ts`) |
| Derivation hooks | `apps/admin/src/features/error-surface/{use-online-status.ts,query-error.store.ts,use-app-error-banner.ts}` (test) |
| Tier-2 component | `apps/admin/src/components/error/{PageErrorState.tsx,page-error-state.interface.ts}` (test) |
| Tier-3 component | `apps/admin/src/components/error/{AppErrorBanner.tsx,app-error-banner.interface.ts}` (test) |
| Wiring | `apps/admin/src/App.tsx` (banner above the header, `onLogin={logout}`) |
| Page change | `use-api-keys.ts` exposes `error`/`errorMessage`/`errorSurface`/`isFetching`; `ApiKeysPage.tsx` renders `PageErrorState`; `ApiKeysTable.tsx` no longer renders errors |
| Docs | `docs/Specs/UI-Architecture.md` §4.1, `docs/history/2026-10-28--23-38-00-ais-96-admin-error-surfaces.md` |

## Outcome and verification

- offline → top banner, gone on the `online` event;
- `401` → banner “Lejárt a munkamenet.” with a *Bejelentkezés* CTA that clears the token
  (`logout()`), after which the existing `ProtectedLayout` shows the login form;
- `503` → banner, no CTA; `500`/`403`/`404`/`409` → page alert with a working *Újrapróbálás* that
  calls `refetch`; a successful retry removes the alert and renders the list;
- field errors (AIS-95) unchanged; mutations stay on the form alert (toast tier is AIS-86).

```
pnpm --filter @callback/ui test        # 71 passed
pnpm --filter @callback/admin test     # 145 passed
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
```

Manual check: DevTools → Network offline, then a mocked `500` — two different surfaces, no
duplicated sentence.

## Follow-ups

- AIS-86: toast + log drawer (tier 4) reads `requestId` from the same query-cache errors.
- `AppErrorBanner` lives in `components/` but is a thin container (it uses two hooks); if a second
  layout ever needs it, move it to `app/` and keep the presentational half in `components/`.
- Mutation failures are intentionally not banner-classified; revisit only if a `401` on a mutation
  needs the same session CTA.
