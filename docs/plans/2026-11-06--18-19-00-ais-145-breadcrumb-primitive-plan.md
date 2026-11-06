# AIS-145 — router-free `Breadcrumb` primitive

**Created:** 2026-11-06 18:19 (Europe/Budapest)
**Ticket:** AIS-145 (subtask of AIS-140) · **Parent:** AIS-140 *Admin fejléc újratervezése: sticky két sávos shell, témaválasztó és breadcrumb*
**Scope:** `packages/ui` only (+ `docs/Specs/UI-Architecture.md`). No admin app change, no route model, no dependency.
**Sibling order (mandatory):** AIS-144 (icon set — **done in the tree**) → **AIS-145 (this)** → AIS-146 (breadcrumb data model + pure derivation in `apps/admin`) → AIS-147 (sticky header wiring).

---

## 1. Why

`packages/ui` has no breadcrumb and the admin header needs one. The constraint is architectural:
`@callback/ui` must **never** depend on `react-router` (§1–§4 of [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:227)),
so the primitive cannot import `Link`. The component therefore renders the *structure* and the caller
**injects** the link element through a render prop. Everything route-related (registry, `§N` paths,
labels) belongs to AIS-146 and stays out of this ticket.

Verified prerequisites in the tree today:

| Prerequisite | State |
| ------------ | ----- |
| `ChevronRightIcon` (AIS-144) in [`icons.tsx`](../../packages/ui/src/components/icon/icons.tsx:120), exported from [`index.ts`](../../packages/ui/src/index.ts:321) | present |
| `ICON_BASE_PROPS` already sets `aria-hidden="true"` + `focusable="false"`, and `ICON_BASE_CLASS = 'h-4 w-4 shrink-0'` ([`icon.const.ts`](../../packages/ui/src/components/icon/icon.const.ts:9)) | present |
| Token classes for text (`text-text-primary`, `text-text-muted`), `packages/ui` has no router dependency | confirmed |
| `packages/ui` entry point is `./src/index.ts` ([`package.json`](../../packages/ui/package.json:6)), so the new export is public API (knip does not report unused exports of an entry file) | confirmed |
| `docs/Specs/UI-Architecture.md` §4 primitive table + `**Utolsó frissítés**` header | present, needs a row + date |

---

## 2. Decisions to lock before coding

| # | Decision | Rationale / consequence |
| - | -------- | ----------------------- |
| **D1** | The link element is **injected**: `renderLink?: BreadcrumbLinkRenderer`. Without it the crumb falls back to a plain `<a href={to}>`. | Keeps `react-router` out of `packages/ui`. The admin passes `<Link>` (AIS-147); any other consumer or a test can pass a stub. The fallback is documented in JSDoc — it is a *full page navigation*, not an SPA navigation. |
| **D2** | The **last** crumb is always `<span aria-current="page">`, even when it carries `to`. It is never a link, never focusable. | The current page must not link to itself; `aria-current="page"` is the single a11y signal screen readers rely on. Test asserts absence of `role="link"` / `href` on it. |
| **D3** | A non-last crumb **without** `to` renders as `<span>` (plain text), not as a dead link. | Avoids a focusable element that goes nowhere; makes `to` genuinely optional on `BreadcrumbItem`. |
| **D4** | Separators are their own `<li aria-hidden="true">` between crumbs, so an `<ol>` of `n` crumbs renders `2n-1` `<li>` elements. | Matches the ticket spec; noted explicitly because it makes `getAllByRole('listitem')` counts non-obvious. `aria-hidden` **plus** the icon's own `aria-hidden` is intentional belt-and-braces, so the separator cannot enter the accessible name even if the icon contract changes. |
| **D5** | Empty `items` renders **nothing at all** — no empty `<nav>` landmark. | An empty navigation landmark is a a11y defect (axe: empty landmark / landmark with no content). Documented in JSDoc and pinned by a test. |
| **D6** | `BREADCRUMB_DEFAULT_ARIA_LABEL = 'Útvonal'`, overridable through `ariaLabel`. | Same convention as `PAGINATION_DEFAULT_ARIA_LABEL = 'Lapozás'` ([`pagination.const.ts`](../../packages/ui/src/components/pagination/pagination.const.ts:13)) — Hungarian default, exported constant so tests and callers use one literal. |
| **D7** | No separator size constant. Instead, pass **no** class to `ChevronRightIcon` + `className="text-text-muted"`. The icon's own `ICON_BASE_CLASS` (`h-4 w-4`) already equals `size-4`; `cn()`/tailwind-merge would let `size-4` override it, but the extra const would be a second source of truth. | Removes the ticket's *optional* `BREADCRUMB_SEPARATOR_SIZE_CLASS`; keeps `breadcrumb.const.ts` free of unused exports (knip `quality:dead-code`). |
| **D8** | Items are keyed by index (`key={`${index}-${item.label}`}`). | Labels and `to` may legitimately repeat; index is the only stable identity for a positional trail. |
| **D9** | No local state, no `useEffect`, no `useMemo`, no `React.Children` inspection. A pure mapping of `items`. | The React rules forbid data/business logic in components; the component is a pure renderer and the mapping is trivially pure. |

---

## 3. Files

| File | Change |
| ---- | ------ |
| `packages/ui/src/components/breadcrumb/breadcrumb.interface.ts` | **new.** `BreadcrumbItem`, `BreadcrumbLinkRendererProps`, `BreadcrumbLinkRenderer`, `BreadcrumbProps` — all `readonly`, JSDoc on each. |
| `packages/ui/src/components/breadcrumb/breadcrumb.const.ts` | **new.** `BREADCRUMB_DEFAULT_ARIA_LABEL = 'Útvonal'` plus the class recipes: `BREADCRUMB_LIST_CLASSES`, `BREADCRUMB_LINK_CLASSES`, `BREADCRUMB_CURRENT_CLASSES`, `BREADCRUMB_SEPARATOR_CLASSES`. Token classes only — no palette, no hex; no DOM-id constants (the component needs none). |
| `packages/ui/src/components/breadcrumb/Breadcrumb.tsx` | **new.** The component described in §4. |
| [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts:321) | Explicit exports: `Breadcrumb`, `BREADCRUMB_DEFAULT_ARIA_LABEL`, and the four types. Added after the icon block, before the trailing section. |
| `packages/ui/test/breadcrumb.test.tsx` | **new.** Full matrix of §5. |
| `packages/ui/test/mocks/breadcrumb-items.mock.ts` | **new.** `BREADCRUMB_SINGLE_ITEM`, `BREADCRUMB_THREE_ITEMS`, `BREADCRUMB_MIDDLE_WITHOUT_TO`. Fixtures never live in the test file. |
| `packages/ui/test/mocks/breadcrumb-link-renderer.mock.tsx` | **new.** `createBreadcrumbLinkRendererMock()` → `{ renderLink, calls }` with `vi.fn()` inside, typed as `BreadcrumbLinkRenderer`. |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:227) | New §4 table row `Breadcrumb (AIS-145)` + refresh the `**Utolsó frissítés**` header block (see §7). |

No change to `packages/ui/package.json`, no new dependency, no `react-router` import anywhere in
`packages/ui`.

---

## 4. Component contract

```tsx
export interface BreadcrumbItem {
  /** Visible crumb text. */
  readonly label: string;
  /** Target path of a crumb. Ignored on the last crumb (D2). */
  readonly to?: string;
}

export interface BreadcrumbLinkRendererProps {
  readonly to: string;
  readonly children: ReactNode;
}

/** Injected link factory — `react-router`'s `Link` in the admin, `<a>` by default. */
export type BreadcrumbLinkRenderer = (
  props: BreadcrumbLinkRendererProps,
) => ReactElement;

export interface BreadcrumbProps {
  readonly items: readonly BreadcrumbItem[];
  /** Accessible name of the `<nav>`; defaults to `BREADCRUMB_DEFAULT_ARIA_LABEL`. */
  readonly ariaLabel?: string;
  /** Optional link element factory; omitted → plain `<a href>`. */
  readonly renderLink?: BreadcrumbLinkRenderer;
}
```

Rendered shape (three crumbs, no `renderLink`):

```html
<nav aria-label="Útvonal">
  <ol class="...">
    <li><a href="/api-keys" class="...">API kulcsok</a></li>
    <li aria-hidden="true"><svg class="text-text-muted ..." aria-hidden="true">…</svg></li>
    <li><span class="...">Detail</span></li>
    <li aria-hidden="true"><svg aria-hidden="true">…</svg></li>
    <li><span aria-current="page" class="text-text-primary">Szerkesztés</span></li>
  </ol>
</nav>
```

Implementation rules:

- `if (items.length === 0) return null;` as the first statement (D5), JSDoc says so.
- `<nav aria-label={ariaLabel ?? BREADCRUMB_DEFAULT_ARIA_LABEL}>` → `<ol className={BREADCRUMB_LIST_CLASSES}>`.
- `items.map((item, index) => …)`: the last index is the current crumb; every earlier index is
  followed by one separator `<li>`.
- Link branch: `to !== undefined ? (renderLink ? renderLink({ to, children: item.label }) : <a href={to} className={BREADCRUMB_LINK_CLASSES}>{item.label}</a>) : <span className={BREADCRUMB_CURRENT_CLASSES}>{item.label}</span>` (D1/D3) — extracted into a small local pure helper `renderCrumb` **inside the same file**, not exported, to keep the JSX flat.
- Link classes must include the focus recipe
  `focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring`
  only if a border exists; otherwise `focus-visible:outline-none focus-visible:shadow-focus-ring`
  plus `rounded-control` so the ring has a shape. Verify against `theme.css` before choosing.
- JSDoc: English, on the component and on every public type/prop (DoD).

---

## 5. Test matrix (`packages/ui/test/breadcrumb.test.tsx`)

| # | Case | Assertion |
| - | ---- | --------- |
| T1 | empty `items` | `queryByRole('navigation')` is `null`; container is empty (D5). |
| T2 | one crumb | no `link` role at all; text rendered; the element has `aria-current="page"`; no `pointer-events`-clickable element. |
| T3 | three crumbs | two `link` elements, order equals input order, `href` equals `to`; exactly one `aria-current="page"`; its text is the last label. |
| T4 | `renderLink` injected | the spy is called for **each non-last crumb** with `{ to }` (assert `calls.map(c => c.to)`), the last crumb is **not** passed to it, and the rendered link is the renderer's own element (query by its `data-testid`). |
| T5 | middle crumb without `to` | that crumb is not a link and has no `aria-current`; siblings stay links. |
| T6 | separators | `container.querySelectorAll('[aria-hidden="true"]')`-based helper counts `n-1` separators; every separator `<li>` has `aria-hidden="true"`; the accessible name of the `nav` does **not** contain the chevron (assert `getByRole('navigation', { name })` matches). |
| T7 | `ariaLabel` | default → `nav` accessible name is `BREADCRUMB_DEFAULT_ARIA_LABEL`; override → the override, and the default literal is absent. |
| T8 | accessibility | `axe` (as in [`overlay-a11y.test.tsx`](../../packages/ui/test/overlay-a11y.test.tsx:1)) over three crumbs: no violations; the last crumb has neither `role="link"` nor `href`. |
| T9 | token-only classes | the anchor's `className` contains `text-text-secondary` (or the chosen link token), **no** `#`, no palette utility — as a cheap guard for the palette gate. |

Test names describe behaviour (`it('omits the nav landmark when there is no crumb')`), fixtures and
the renderer mock come from `test/mocks/**` (no inline `vi.fn()` bodies in the test file beyond
assertions).

---

## 6. Steps

1. Create the three source files (§3) with the contract of §4; keep `Breadcrumb.tsx` under ~80 lines.
2. Add the explicit exports to [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts:321).
3. Add fixtures + renderer mock, then the test file with T1–T9.
4. Run the gates (all must be green):
   - `pnpm --filter @callback/ui test`
   - `pnpm --filter @callback/ui build`
   - `pnpm quality:tokens` / `pnpm quality:dead-code` (knip: `index.ts` is the package entry, so the new public exports must **not** be reported; if knip does report them, do **not** add an ignore — check the entry wiring instead)
   - `pnpm quality:docs` (the §4 row adds no broken link and no dangling `§N`)
   - `pnpm typecheck`, `pnpm lint`
5. Grep guards:
   - `rg "react-router" packages/ui` → no match
   - `rg "useState|useEffect|useMemo|useCallback" packages/ui/src/components/breadcrumb` → no match (D9)
   - `rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" packages/ui/src/components/breadcrumb` → no match
6. Update [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:227) (§7).
7. Jira: comment the evidence (test/build/gate output, the decisions D1–D5) and move AIS-145
   `To Do → In Progress → Done`; leave AIS-146 unblocked.
8. Commit — single commit, title `AIS-145: feat(ui): add router-free Breadcrumb primitive`
   (types/exports/docs in the same commit; no separate docs commit).
9. History entry `docs/history/2026-11-06--<hh-ii-ss>-ais-145-breadcrumb-primitive.md` (written at
   close-out time) with the narrative + the D1–D9 list. No milestone: the design record is one
   primitive and a handful of decisions, and the §4 row + this plan already carry them.

---

## 7. Spec update (exact wording target)

Append to the second §4 table block, after the `LogEntryRow` row:

| Primitive | Variants / props | Notes |
| `Breadcrumb` (AIS-145) | `items: { label, to? }[]`, `ariaLabel?`, `renderLink?` | Router-free: the link element is **injected** through `renderLink` (react-router `Link` in the admin, `<a href>` fallback), so `packages/ui` never imports a router. Last crumb is a `<span aria-current="page">`, never a link; a crumb without `to` renders as text; `n` crumbs render `n-1` separators as `<li aria-hidden="true">`; empty `items` renders **no** `<nav>` landmark. |

Header: prepend a new `**AIS-145 (2026-11-06): …**` paragraph next to the existing AIS-144 block at
the top of the file and bump the header date to `2026-11-06` — the `quality:docs` gate requires a
valid `Utolsó frissítés` line, and the file already accumulates one paragraph per ticket.

---

## 8. Definition of done

- [ ] `packages/ui/src/components/breadcrumb/` exists with interface / const / component, JSDoc in English on every public symbol.
- [ ] Explicit exports in `index.ts`; no `react-router` import; no new dependency.
- [ ] T1–T9 green; fixtures/mocks in `test/mocks/**`.
- [ ] `test`, `build`, `typecheck`, `lint`, `quality:tokens`, `quality:dead-code`, `quality:docs` green.
- [ ] §4 row + `Utolsó frissítés` updated; history entry written.
- [ ] AIS-145 `Done` with the evidence comment; AIS-146/147 still unblocked.

---

## 9. Out of scope

Route registry, path→crumb derivation, labels/copy, `useBreadcrumb` hook and any `apps/admin` file
(**AIS-146**); the sticky two-band header, theme switcher, user-settings button and the nav/breadcrumb
row (**AIS-147**); dropdown/collapsing breadcrumbs for long trails; mobile truncation strategy;
schema-driven breadcrumbs; RTL support.
