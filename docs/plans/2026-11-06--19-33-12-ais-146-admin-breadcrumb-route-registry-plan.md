# Plan — AIS-146: breadcrumb data model + pure derivation logic from the route registry (admin)

**Date:** 2026-11-06 · **Parent:** AIS-140 · **Ticket:** AIS-146 (subtask) · **Prerequisite:** AIS-145 (breadcrumb primitive), AIS-144 (chevron icon)
**Reference slice:** `api-keys` — routes `/api-keys`, `/api-keys/:identifier`

---

## 1. Goal

A breadcrumb that is **derived**, never hand-written: every entry of `app/router/route-registry.tsx`
declares its own crumb and its parent path, and one **pure** function turns
`(routes, pathname)` into the ordered root→leaf trail. The `<Breadcrumb>` primitive (AIS-145)
renders it, the admin injects `react-router`'s `Link`, `AdminLayout` mounts it temporarily under the
nav until the AIS-140 header redesign (two-band shell) moves it into the second band.

No new dependency, no page work, no data fetching.

---

## 2. Verified facts the plan relies on

| Claim | Verified location | Note |
| --- | --- | --- |
| `RouteEntry` has only `path`/`navLabel`/`element`/`protected`/`hidden` | [`route-entry.interface.ts:14`](../../apps/admin/src/app/router/route-entry.interface.ts:14) | the three breadcrumb fields are new |
| The registry is the only route list | [`route-registry.tsx:49`](../../apps/admin/src/app/router/route-registry.tsx:49) | 5 entries + `NOT_FOUND_ROUTE_ENTRY` (`path: '*'`) |
| The nav is derived; nothing to add there | [`AdminNav.tsx`](../../apps/admin/src/app/layout/AdminNav.tsx:1), [`New-Admin-Page.md:50`](../../docs/Specs/New-Admin-Page.md:50) step 13 | "no work" stays true |
| The layout takes `routes` as a **prop** | [`admin-layout.interface.ts:11`](../../apps/admin/src/app/layout/admin-layout.interface.ts:11) | `AppBreadcrumb` must follow the same rule |
| `Breadcrumb` primitive exists and is exported | [`Breadcrumb.tsx:69`](../../packages/ui/src/components/breadcrumb/Breadcrumb.tsx:69), [`index.ts:330`](../../packages/ui/src/index.ts:330) | `items`, `ariaLabel`, `renderLink`; last crumb is `aria-current="page"`; empty `items` → no `<nav>` |
| `BreadcrumbItem` is `{ label, to? }` | [`breadcrumb.interface.ts:9`](../../packages/ui/src/components/breadcrumb/breadcrumb.interface.ts:9) | admin must **not** re-declare it |
| Detail route template lives in the page const | [`api-keys.const.ts`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:1) `API_KEY_DETAIL_ROUTE_PATH` | page must not import `app` |
| `RouteEntry` literals also exist outside the registry | [`route-registry.mock.tsx:27`](../../apps/admin/src/test/mocks/route-registry.mock.tsx:27) (4), [`AppRouter.test.tsx:25`](../../apps/admin/src/app/router/AppRouter.test.tsx:25) (2) | a **required** field breaks them → they are part of the change |
| `exactOptionalPropertyTypes` is **off** | [`tsconfig.base.json:2`](../../tsconfig.base.json:2) | `to?: string` may be assigned `undefined`, but the logic still builds objects conditionally |
| `AdminLayout.test.tsx` counts links | [`AdminLayout.test.tsx:75`](../../apps/admin/src/app/layout/AdminLayout.test.tsx:75) | must be revisited once crumbs render links |

---

## 3. Design decisions

### 3.1 Inherited from the ticket (AIS-140 **D5**)

`breadcrumbLabel`, `breadcrumbParentPath`, `resolveBreadcrumbLabel` on `RouteEntry`; the chain is
walked **upwards** from the matched entry; cycle-protected; a `null` label is skipped but does not
break the chain; the leaf crumb carries no `to`; an unknown pathname yields `[]`.

### 3.2 Added while planning

| # | Decision | Reason |
| --- | --- | --- |
| **D1** | `breadcrumbLabel` is **required** (`string \| null`), not optional | an optional field would let a new route silently ship without a crumb; required turns the omission into a compile error. Cost: 6 existing literals get the field (registry + not-found + 4 mock entries + 2 test literals) |
| **D2** | Crumb inclusion test is `breadcrumbLabel !== null \|\| resolveBreadcrumbLabel !== undefined` | resolves the ticket's ambiguity: the detail route needs *both* `breadcrumbLabel: null`-like behaviour (no static text) *and* a resolver. `null` alone therefore cannot mean "excluded" |
| **D3** | `BreadcrumbCrumb` is a **type alias** of `@callback/ui`'s `BreadcrumbItem`, not a copy | DRY: a copied shape can drift from the primitive it is fed into |
| **D4** | `AppBreadcrumb` reads **only** `useLocation()`; the params are derived from the pattern match inside the pure logic — **no `useParams()`** | `AdminLayout` is the element of `<Route path="/*">`, so `useParams()` there returns `{ '*': 'api-keys/abc123' }` and **not** `identifier`; the `:identifier` match happens in the *nested* `<Routes>` inside `ProtectedRoutes`. `useParams()` would therefore hand `undefined` to the resolver (ticket text says `useParams()`; this is a deliberate, tested deviation) |
| **D5** | Static match first, then `:param` pattern, catch-all `'*'` **never** matches | an unknown URL must produce `[]` (no empty landmark); the catch-all has a page, not a position in a trail |
| **D6** | Parent links are built by `interpolatePath(template, params)`; a template param the leaf does not provide yields `undefined` → that crumb renders as **text, no link** | prevents a literal `:identifier` link; the primitive already supports "crumb without `to`" |
| **D7** | Traversal is bounded by a `Set` of visited **entry paths** (no depth counter) | a cycle can only repeat a path, so the set is exact and terminating; a depth cap would be a second, untestable rule |
| **D8** | `AppBreadcrumb` takes `routes` as a **prop** and does not import the registry | same testability rule as `AdminLayout`/`AdminNav` (§4.1 of the UI spec) |
| **D9** | The provisional mount is a second row **inside** `<header>`, marked with a `TODO(AIS-140)` comment | the header subtask only moves the element; no logic changes with it |
| **D10** | Wording gets a single home: `APP_HOME_LABEL`, `APP_API_KEYS_LABEL`, `APP_CALLS_LABEL` in `app.const.ts`, used by `navLabel` **and** `breadcrumbLabel` | [`app.const.ts:1`](../../apps/admin/src/app/app.const.ts:1) already states that wording has exactly one home; two equal literals in one object is the drift the file exists to prevent |

---

## 4. Work breakdown (implementation order)

### Step 1 — `apps/admin/src/app/router/route-entry.interface.ts`

Three new readonly members, JSDoc in English, each referencing AIS-140 **D5**:

```ts
/** Crumb text, or `null` when the route has no crumb of its own (a resolver may still supply one). */
readonly breadcrumbLabel: string | null;
/** Registry path of the parent route; the trail is built by walking this upwards. */
readonly breadcrumbParentPath?: string;
/** Mandatory when `path` contains `:`; receives the params derived from the matched URL. */
readonly resolveBreadcrumbLabel?: (params: Readonly<Record<string, string>>) => string;
```

### Step 2 — `apps/admin/src/app/app.const.ts`

Add `APP_API_KEYS_LABEL` and `APP_CALLS_LABEL` (values: `'API kulcsok'`, `'Hívások'`), keep
`APP_NAV_HOME_LABEL` as the landing label (D10).

### Step 3 — `apps/admin/src/app/router/route-registry.tsx`

| Entry | `breadcrumbLabel` | `breadcrumbParentPath` | `resolveBreadcrumbLabel` |
| --- | --- | --- | --- |
| `/login` (`PUBLIC_ROUTE_ENTRIES`) | `null` | — | — |
| `/` | `APP_NAV_HOME_LABEL` | — (root) | — |
| `/api-keys` | `APP_API_KEYS_LABEL` | `APP_ROUTE_HOME_PATH` | — |
| `/api-keys/:identifier` | `null` | `APP_ROUTE_API_KEYS_PATH` | `(params) => params.identifier` |
| `/calls` | `APP_CALLS_LABEL` | `APP_ROUTE_HOME_PATH` | — |
| `*` (`NOT_FOUND_ROUTE_ENTRY`) | `null` | — | — |

`navLabel` values stay byte-identical (they now reference the extracted constants).

### Step 4 — `apps/admin/src/app/router/breadcrumb.interface.ts` (new)

```ts
export type BreadcrumbCrumb = BreadcrumbItem;            // from '@callback/ui' (D3)

export interface MatchedRoute {                          // internal result of the matcher
  readonly entry: RouteEntry;
  readonly params: Readonly<Record<string, string>>;
}
```

### Step 5 — `apps/admin/src/app/router/breadcrumb.logic.ts` (new, pure — no hook, no `window`, no I/O)

Public API:

```ts
export function matchRoute(routes: readonly RouteEntry[], pathname: string): MatchedRoute | null;
export function interpolatePath(template: string, params: Readonly<Record<string, string>>): string | undefined;
export function toBreadcrumbItems(routes: readonly RouteEntry[], pathname: string): readonly BreadcrumbCrumb[];
```

Internal (not exported, keeps the surface minimal for `knip`):

1. `normalisePathname` — strip the trailing `/` (except for `/` itself).
2. `matchStatic` — pass 1 over the entries: `path` without `:` and equal to the pathname.
3. `matchDynamic` — pass 2: equal segment count, each `:name` segment captures a non-empty segment.
4. `resolveLabel(entry, params)` — `entry.breadcrumbLabel ?? entry.resolveBreadcrumbLabel?.(params) ?? entry.path`
   (the last fallback keeps a mis-declared registry from rendering `undefined`; the registry test
   makes it unreachable).
5. `buildChain` — upward walk with `visited: Set<string>`, missing `breadcrumbParentPath` target →
   stop silently, `breadcrumbLabel === null && no resolver` → skip but keep walking.
6. Leaf handling — the last emitted crumb drops `to`; every earlier crumb gets
   `interpolatePath(entry.path, params)` and is rendered as text when that is `undefined` (D6).

Complexity is `O(routes)` per call — no memoisation, no cache.

### Step 6 — `apps/admin/src/app/layout/AppBreadcrumb.tsx` + `app-breadcrumb.interface.ts` (new)

```tsx
const ROUTER_LINK_RENDERER: BreadcrumbLinkRenderer = ({ to, children }) => (
  <Link to={to}>{children}</Link>
);

export function AppBreadcrumb({ routes }: AppBreadcrumbProps) {
  const { pathname } = useLocation();
  return <Breadcrumb items={toBreadcrumbItems(routes, pathname)} renderLink={ROUTER_LINK_RENDERER} />;
}
```

Module-scope renderer: a **new function identity per render would remount the links**; the constant
keeps React reconciliation stable and needs no `useCallback`.

### Step 7 — `apps/admin/src/app/layout/AdminLayout.tsx`

Second row inside `<header>` (below the brand/nav row), preceded by
`{/* TODO(AIS-140): moved into the second band of the two-row header shell. */}`:

```tsx
<div className="mx-auto w-full max-w-5xl px-6 pb-2">
  <AppBreadcrumb routes={routes} />
</div>
```

Token classes only (no palette utility, no colour literal).

### Step 8 — test doubles (`apps/admin/src/test/mocks/`)

- [`route-registry.mock.tsx`](../../apps/admin/src/test/mocks/route-registry.mock.tsx:1) — add
  `breadcrumbLabel` (and one parent) to the four entries so the file compiles and the layout test
  can assert a real crumb.
- **new** `breadcrumb-routes.mock.ts` — fixture registry covering every branch: static root, static
  child, dynamic child with resolver, `breadcrumbLabel: null` (excluded), an entry whose parent path
  does not exist, a two-entry cycle (`/cycle-a` ↔ `/cycle-b`), and a dynamic entry **without** a
  resolver (fallback branch).

### Step 9 — `AppRouter.test.tsx`

Add `breadcrumbLabel: null` to the two inline `RouteEntry` literals (compile fix, no behaviour change).

---

## 5. Test plan

### 5.1 `apps/admin/src/app/router/breadcrumb.logic.test.ts` (new)

| # | Case | Expectation |
| --- | --- | --- |
| 1 | `/` | one crumb, no `to` (leaf) |
| 2 | `/api-keys` | `[Kezdőlap, API kulcsok]`; `Kezdőlap` has `to: '/'`, the second has none |
| 3 | `/api-keys/abc123` | `[Kezdőlap, API kulcsok, abc123]`; `API kulcsok` links to `/api-keys` |
| 4 | `/api-keys/` (trailing slash) | identical to case 3 |
| 5 | resolver receives the params | spy resolver called with `{ identifier: 'abc123' }` |
| 6 | `breadcrumbLabel: null`, no resolver | entry skipped, its parent still present |
| 7 | `breadcrumbParentPath` points nowhere | the trail stops there, no throw |
| 8 | cycle `A → B → A` | finite list, no hang (run under a 2 s test timeout) |
| 9 | unknown pathname (`/nope`) | `[]` |
| 10 | the `*` catch-all is never matched | `[]` even though a catch-all entry exists |
| 11 | static beats dynamic | `/api-keys` does not select the `:identifier` entry |
| 12 | dynamic entry without a resolver | label falls back to the raw path, no `undefined` in the DOM |
| 13 | parent template param the leaf cannot fill | the parent crumb has **no** `to` (`interpolatePath` → `undefined`) |
| 14 | `interpolatePath` unit cases | fills `:a`, leaves an unknown `:b` → `undefined`, empty params → `undefined` |

### 5.2 `apps/admin/src/app/layout/AppBreadcrumb.test.tsx` (new)

- mounted **exactly like the layout**: `MemoryRouter` + `<Route path="/*" element={<AppBreadcrumb routes={…} />} />`,
  with `initialEntries` `/api-keys` and `/api-keys/abc123`; asserts `Útvonal` landmark, crumb order,
  `href`s, and `aria-current="page"` on the last crumb;
- **D4 proof**: the `abc123` crumb is present even though the component sits in the `/*` route
  (a `useParams()` implementation would render `undefined` here);
- unknown URL → `queryByRole('navigation', { name: 'Útvonal' })` is `null`;
- the breadcrumb links are `react-router` links: clicking `Kezdőlap` navigates without a reload
  (assert via the rendered `href` plus a route change, no full page load).

### 5.3 `apps/admin/src/app/router/route-registry.test.ts` (extend)

| Invariant | Red when |
| --- | --- |
| every `breadcrumbParentPath` names an existing entry path | typo, or a deleted parent |
| every path containing `:` has `resolveBreadcrumbLabel` | a dynamic route without a resolver |
| `breadcrumbLabel === null && no resolver` only on `protected === false` or `path === '*'` | a protected static page silently missing from the trail |
| the parent chain of every entry terminates | a cycle introduced later |
| `navLabel` and `breadcrumbLabel` share the constant | already covered by reading both from `app.const.ts`; assert the strings once |

### 5.4 `apps/admin/src/app/layout/AdminLayout.test.tsx` (extend)

- the breadcrumb region (`navigation` named `Útvonal`) is rendered inside `<header>`;
- the existing "no route is linked" assertion at
  [`AdminLayout.test.tsx:75`](../../apps/admin/src/app/layout/AdminLayout.test.tsx:75) is reframed:
  with `routes={[]}` there are **no crumbs and no links** (the primitive renders nothing), so the
  count stays `1` — the test comment is updated to say the breadcrumb is empty by construction;
- a new case with `MOCK_ROUTE_ENTRIES` at `/detail` asserts the breadcrumb contributes its links
  (brand + nav + crumb links) so the count is an explicit sum, not a magic number.

---

## 6. Documentation

| File | Change |
| --- | --- |
| [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:542) §4.1 | `app/router/` row gains `breadcrumb.logic.ts` + `breadcrumb.interface.ts` (pure, params derived from the match, no `useParams`); `app/layout/` row gains `AppBreadcrumb.tsx` (injects the router `Link` into the primitive, takes `routes` as a prop) |
| [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:558) §4.2 | the `RouteEntry` example gains the three fields; new bullets: `breadcrumbLabel: null` = no crumb of its own, a `:` path **must** carry a resolver, `breadcrumbParentPath` must name an existing entry, unknown URL → no trail. Mention that `pnpm quality:docs` treats the example as text (no link parsing inside fences) |
| `UI-Architecture.md` header | `**Utolsó frissítés:` bumped with the AIS-146 line |
| [`New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md:49) step 12 | the registry entry must now also declare `breadcrumbLabel` (+ `breadcrumbParentPath`, + resolver for a `:` path); a missing crumb is a defect, not a style choice |
| `New-Admin-Page.md` header | date bumped |
| `docs/history/2026-11-06--<hh-mm-ss>-ais-146-admin-breadcrumb-infra.md` | post-implementation narrative (required by the repo rules) |
| `docs/milestones/2026-11-06--<hh-mm-ss>-breadcrumb-params-derived-from-route-pattern.milestone.md` | required: the `useParams()`/splat decision (D4) is a non-obvious root cause a future contributor would otherwise re-litigate |

---

## 7. Definition of done

```bash
pnpm --filter @callback/admin test
pnpm test
pnpm typecheck
pnpm lint
pnpm quality
```

- [ ] Every case in §5 is green; `breadcrumb.logic.ts` has **no** React import, no `window`, no `fetch`.
- [ ] `AppBreadcrumb` only composes: `useLocation` → `toBreadcrumbItems` → `<Breadcrumb>`.
- [ ] `pnpm quality:layers` green — the logic sits in `app/router`, no page→page or feature→feature edge.
- [ ] `pnpm quality:dead-code` green — every new export is consumed (logic by `AppBreadcrumb` and its tests, mocks by tests).
- [ ] `pnpm quality:tokens` green — no palette utility, no colour literal in the two new files.
- [ ] `pnpm quality:docs` green — after the `UI-Architecture.md`/`New-Admin-Page.md` edits and date bumps.
- [ ] `/api-keys/:identifier` shows the raw `identifier` as the leaf crumb (display name is AIS-140 **D6**, out of scope).
- [ ] No new npm dependency; `packages/ui` still has no `react-router` import.

---

## 8. Risks and follow-ups

| Risk | Mitigation |
| --- | --- |
| AIS-145 not merged yet → `Breadcrumb`/`BreadcrumbItem` missing | the primitive **is** in the current working tree ([`index.ts:330`](../../packages/ui/src/index.ts:330)); implement AIS-146 only on top of a tree that exports it, otherwise the branch does not compile |
| Required `breadcrumbLabel` breaks other branches' `RouteEntry` literals | the field is required on purpose (D1); the merge conflict is a one-line addition, and the registry test explains why |
| Duplicate `navLabel`/`breadcrumbLabel` wording drifts later | both read the same `app.const.ts` constant (D10) |
| The AIS-140 header redesign forgets the breadcrumb | the provisional mount carries a `TODO(AIS-140)` comment and the layout test asserts the region |
| Long `identifier` values overflow the trail | inherited from the primitive (`flex-wrap` in `BREADCRUMB_LIST_CLASSES`); no admin-side truncation until D6 decides on a display name |
