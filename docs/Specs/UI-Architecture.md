# UI Architecture — `@callback/ui`, tokens and admin app layers

**Utolsó frissítés: 2026-11-05 — AIS-133 (az „új admin oldal” checklist egységesítése).** A recept
egyetlen, fájlnév-szintű igazságforrása a [`New-Admin-Page.md`](./New-Admin-Page.md): ez a doksi a §6
helyett **mindig** azt linkeli, a §5 state-plan marad a state-buckets tábla egyetlen helye, és az új
`pnpm quality:docs` kapu (§9) pirosra fordítja, ha egy pointer-forrás elveszti a linket vagy egy `§N`
hivatkozás nem létező szekcióra mutat.

**AIS-85 (2026-11-05):** Az `ApiKeyForm` a
referencia-implementáció: `useAppForm` + `useNotifier()`, `pageError` state és success `Alert` nélkül,
`FormActions` pending-gombbal. A form csak a **látható** részt dönti el: siker → `notify.success`
(egy toast + egy log bejegyzés), `field` hiba → mező + fókusz, toast nélkül, `page` hiba → a capture
toastja (a form `formError`-ja `null` marad), és csak a `field` hiba **gazdátlan** maradéka kerül a
form `Alert`-jébe — a `toFormErrorPlan` most a `toErrorSurface` besorolást is megkapja (lásd §4.4).
A `renderWithProviders` teszt-harness a `NotificationHost`-ot is mountolja, és a valódi capture
adaptereket köti a store-hoz, így a `ApiKeyForm.test.tsx` a teljes láncot méri (§8).

**AIS-84 (2026-11-05):** a globális notification capture az admin SPA-ban — minden lezárt HTTP
kísérlet (`HttpEvent`), minden elutasított query/mutation és minden `meta.successMessage`-dzsel
jelentkező írás **külön kód nélkül** kerül a logba. Egyetlen store-példány
(`app/notifications/notification.store.ts`) osztozik a cache-callbackeken, az `onEvent` listeneren és a
`<NotificationProvider>`-en; a `<NotificationHost />` az `AdminLayout`-ban mountol. A láthatóság
továbbra is a `toErrorSurface` döntése: `silent` → nincs bejegyzés, `field`/`banner` → csak log,
`page` → log **és** toast. A transport-esemény szándékosan **nem** toastol (D3: nincs benne hibakód,
így nem tudná a helyes szöveget választani) — a mátrix a §4.1.3-ban.

**AIS-82 (2026-11-04):** a log panel prezentációs primitívei — `LogDrawer` + `LogEntryRow`
(lásd §4) —: összecsukott oldalszéli fül (`aria-expanded` + `aria-controls`), **nem modális**
becsúszó panel (nincs overlay, nincs focus trap, `Escape` zár), hat szűrő chip (`Mind` / `Siker` /
`Hiba` / `Figyelmeztetés` / `Info` / `Rendszer`), injektált `formatTimestamp`, és lapozás **csak
propon** (`hasMore` / `onLoadMore`). A store, a host és a 20/50-es lap-ablak továbbra is AIS-83.

**AIS-131 (2026-11-04):** a referencia-szelet teljes CRUD — `pages/api-keys/ApiKeyDetailPage`
(`/api-keys/:identifier`): detail olvasás `useApiDetail`-en, inline `PATCH` szerkesztés `useAppForm`-mal,
törlés `ConfirmDialog`-gal, `409 STALE_WRITE` → oldalszintű újratöltés. A state-tábla új sora §5-ben, a
döntések (`updatedAt` minta-token, `key={updatedAt}` remount, `404` külön ág) a
[`Admin-Data-Flow.md`](./Admin-Data-Flow.md) §3.7-ben. Ugyanennek a szeletnek a záró javítása: a
`features/forms` bekerült a `SHARED_FEATURES` allow-listbe (§9.1), mert a `useAppForm` közös
infrastruktúra, nem egy oldal use-case-e; a detail-card teszt pedig a `data-status` selectorral
címzi a badge-et, mert a „nincs lejárat" szöveg szándékosan kétszer szerepel a kártyán.

**AIS-80 (2026-11-04):** a notification-log `sessionStorage` tükre — `createNotificationStorage`
(`load` / `save` / `flush` / `clear`), verziózott envelope (`aisztens.notifications.v1`,
`{ version: 1, entries }`), cap 200, injektált `StorageLike` és injektált írás-ütemező, csendes
degradáció hiba esetén. A store-hoz **nincs** bekötve: a bekötés az AIS-83 providere. Részletek a
`packages/notifications` core §-ban lentebb.

**AIS-83 (2026-11-04):** a `@callback/notifications` **React rétege** a `./react` al-exporton —
`NotificationProvider` (store + `sessionStorage` tükör + `error`/`unhandledrejection` figyelők),
`useToasts` / `useLogDrawer` / `useLogEntries` / `useToastTimers` hookok (`useSyncExternalStore`),
`createNotifier` + `useNotifier`, és a `NotificationHost` (toast-időzítők, lapozási ablak). A core
továbbra sem importál Reactet: a `tsconfig.core.json` a `src/core`-t DOM nélkül fordítja, a
`tsconfig.json` a React réteget DOM+JSX-szel. Részletek a §4 „React bindings and host" blokkban.

**Utolsó frissítés:** 2026-11-05 (AIS-136: a notification alrendszer app-shell lezárása — egy **mindig látható** log-drawer fogantyú (`aria-expanded`/`aria-controls` mindkét állapotban, váltakozó glyph és accessible name, badge mindkét állapotban), a **toast-mátrix** teljessé tétele (`field` → csak log, `banner`/`page` → log **és** toast), a render-crash bekötése `AppErrorBoundary` injektált `onError` portján át, valamint az `ApiKeyEditForm` `notify` portja — lásd §4.1.3, §4 és §5) (AIS-84: globális notification capture — `QueryCache`/`MutationCache` callbackek + HTTP `onEvent` + `<NotificationHost />` az `AdminLayout`-ban, lásd §4.1.3 és §5) (AIS-112: a form-séma a shared kérés-sémából származik, a validációs copy egy kétnyelvű katalógusból jön — lásd §4.3) (AIS-111: **egy** hibakód-katalógus — `lib/api-error-code.const.ts` `ERROR_CODE_CATALOGUE` totális recordja, amiből az `ERROR_CODE_MESSAGE` és a `FIELD_SURFACE_CODES` deriválódik —, valamint a generikus `lib/field-errors.logic.ts` `toFieldErrors(error, target)`, lásd §4.1.1–4.1.2; a **shared-infra feature** kivétel dokumentálva: `features/api` és `features/error-surface` bármely page/feature számára importálható; a `pnpm test:quality` / `test:agents` Node 26-kompatibilis glob-hívást használ; előtte AIS-122: a réteg-, holt-kód-, token- és field-error szabályok **gépi gate-ek** — `pnpm quality`, lásd §9; AIS-119: a lista szűrő/rendezés/oldal állapota az **URL-ben** él — `features/api/use-list-params.ts`; AIS-118: az `src/app/` réteg)
**AIS-115 (2026-11-04):** a közös form-minta — `features/forms/use-app-form.ts`
(`useAppForm`) egy helyen fogja össze a zod resolvert, a `toFieldErrors` mezőhiba-leképezést, az
első hibás mező determinisztikus fókuszát, a `reset → notify → onSuccess` siker-konvenciót és az
opcionális notification portot (`FormNotifier`, AIS-84 előtt `null`); a tiszta döntés a
`use-app-form.logic.ts`-ben, a részletek a [`Forms-and-Validation.md`](./Forms-and-Validation.md:1)
specben (lásd §4.4). Az `ApiKeyForm` átállása **AIS-85**-ben megtörtént.
**AIS-113 (2026-11-04):** tíz form primitív — `FormField`, `FormSection`, `FormActions`, `Select`,
`NumberInput`, `DatePicker`, `Checkbox`, `Switch`, `RadioGroup`, `Combobox` (lásd §4) —, a
`FormField` **render prop** alapú (`ariaProps` a nyers DOM-hoz, `id`/`invalid`/`describedBy` a
primitívekhez), a logika a `combobox.logic.ts` / `radio-group.logic.ts` tiszta függvényeiben, és
`vitest-axe` alapú a11y gate a `test/form-a11y.test.tsx`-ben (§7 új sor: `vitest-axe`).
A `Input`/`Textarea` változatlan — nincs törés a `packages/ui`-ban.
**AIS-116 (2026-11-03):** hét data-display primitív — `Skeleton`, `Spinner`, `EmptyState`,
`DescriptionList`, `StatusBadge`, `Pagination`, `DataTable` (lásd §4) —, és a teljes `api-keys`
oldal rájuk állítva: lap/lapméret/rendezés az URL-ben, működő lapozóval (§5).
**AIS-117 (2026-11-04):** öt overlay primitív — `Dialog`, `ConfirmDialog`, `Drawer`, `Tooltip`,
`DropdownMenu` (lásd §4) — **Radix viselkedéssel, saját vizuális réteggel**: a focus trap, az
`Esc`, az `aria-modal`, a portál és a fókusz-visszaállítás a Radixé, a felület a token-alapú CVA
recept; Radix CSS-import nélkül. A `Drawer` **nem** `Popover`, hanem `Dialog` + `side` variáns
(modalitás: focus trap + `Esc` + scroll-lock kell egy űrlapos panelhez) — ezért három Radix csomag
kell, nem négy. A `ConfirmDialog` csak a döntést adja vissza (`onConfirm`), nem navigál és nem
zárja be magát. A `packages/ui/package.json` első runtime dependency-jei a Radix csomagok (§7).
**AIS-130 (2026-11-04):** a page-state szabály **le van zárva**, és a szabály nyer: a sorrend
**URL → TanStack Query → page-local store → `useState`**
([`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) §6.1). A `zustand`
**nincs telepítve** — egyetlen oldalnak sincs tranziens UI-állapota, ezért a store-factory a
szabályban csak **referencia-minta**; aki először használja, ugyanabban a change-ben telepíti,
`installed`-ra váltja a §7 sort és megírja a store-tesztet. Ez a döntés szünteti meg a §6 és a §5
eddigi ellentmondását: a §5 a §6-ot **idézi**, nem fordítja.
**Status:** living document — describes the _current_ state of the React side of the monorepo.
**Authority:** [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1) is the
normative rule set; this document explains how the repo implements it. Where this document and
the rule set disagree, the rule set wins and this document is the bug.

## 1. Where the pieces live

| Package / app         | Role                                                                                                                         | Build                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `packages/ui`         | Design tokens + presentational primitives. **Source-only** (no `dist`): consumers bundle the `.ts`/`.tsx` sources directly.  | `tsc --noEmit` (type check only) |
| `packages/api-client` | The only place that talks to the backend (typed services + Zod parsing at the boundary). Tested with **jest + ts-jest**.     | `tsc` → `dist`                   |
| `packages/shared`     | Wire schemas, shared pure helpers used by API, web and admin. Tested with jest.                                              | `tsc` → `dist`                   |
| `apps/admin`          | Admin SPA. Consumes `@callback/ui` primitives and `@callback/api-client` services. Tested with **vitest + Testing Library**. | `tsc --noEmit` + `vite build`    |
| `apps/web`            | Public site. Consumes `@callback/ui` (`Card` + tokens) since AIS-122; still a flat `App.tsx` + `pages/*`, no layer folders.  | `tsc --noEmit` + `vite build`    |

Why `packages/ui` has no build step (decision **D14** of the AIS-57 plan): its only
consumer is a Vite bundle, so a `dist` would add a build ordering dependency and
would let Tailwind scan stale output. The `predev`/`test` root scripts therefore
only build `@callback/shared`.

## 2. Layer map (apps)

```text
app → pages → features → entities → services → lib
```

Imports flow downwards only — no page→page, no feature→feature imports. The two
**shared infrastructure features** (`features/api`, `features/error-surface`) are the
only exception: any page and any feature may import them, because they hold generic
plumbing (TanStack Query adapters, error surface) and no use-case business logic.

The rule file describes the **target** structure. The table below shows both the target and
what exists in `apps/admin` today, so nobody mistakes a planned folder for an existing one.

| Layer                 | Target contents                                                  | State in `apps/admin/src` (2026-10-21)                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`                 | providers, router, layout shell, session store                   | **exists** (AIS-118): `app/router/` (the route registry + `AppRouter` + `ProtectedRoute`), `app/layout/` (`AdminLayout` + `AdminNav`), `app/providers/` (`AppProviders` + `SessionProvider`), `app/session/` (`useRequireSession`), `app/error/` (`AppErrorBoundary`). `App.tsx` is composition only; the session implementation still lives in `auth/AuthContext.tsx` (the cookie session is AIS-74) |
| `pages/<page>`        | route composition, optional page store, page-only parts in `ui/` | **exists**: `pages/api-keys/` (`ApiKeysPage.tsx`, `api-keys.const.ts`, `.interface.ts`, `.logic.ts`, `ui/ApiKeysTable.tsx`, `ui/ApiKeyForm.tsx`) — the first page folder; plus the flat `pages/LoginPage.tsx` and `pages/PlaceholderPage.tsx`                                                                                                                                                         |
| `features/<use-case>` | query/mutation hooks, pure `*.logic.ts`                          | **exists**: `features/api-keys/` (`api-keys.const.ts`, `.interface.ts`, `.logic.ts`, `use-api-keys.ts`) and `features/error-surface/` (`use-online-status.ts`, `use-app-error-banner.ts`, `query-error.store.ts`)                                                                                                                                                                                     |
| `entities/<entity>`   | domain types, pure mappers, display components                   | **exists**: `entities/api-key/` (`api-key.interface.ts`, `api-key.mapper.ts`, `api-key.const.ts`) — mappers only, no display components yet                                                                                                                                                                                                                                                           |
| `services`            | composition root (client instance + token supplier)              | **exists**: `services/api-client.ts` + `services/api-client.const.ts`                                                                                                                                                                                                                                                                                                                                 |
| `lib`                 | pure helpers and formatters                                      | **exists**: `lib/date.ts`, `lib/error-message.ts`, `lib/error-surface.logic.ts`, `lib/api-error-code.const.ts` (single code→copy catalogue), `lib/field-errors.logic.ts` (generic failure→form mapping) (+ their `*.const.ts` / `.interface.ts`)                                                                                                                                                      |
| `components`          | generic presentational shells (no data access)                   | **exists**: `components/BuildInfoFooter.tsx`, `components/error/PageErrorState.tsx`, `components/error/AppErrorBanner.tsx` (the latter is a thin container: all decisions live in `features/error-surface` + `lib/error-surface.*`)                                                                                                                                                                   |
| `test/mocks`          | all fixtures, doubles, wrappers                                  | **exists**: `test/mocks/handlers/` (MSW network doubles: `api-keys.handlers.ts`, `generic.handlers.ts`, `handler-envelope.ts`), `server.ts`, `render-with-providers.tsx`, `request-recorder.ts`, `api-error.mock.ts`, `query-client.mock.tsx`, `online-status.mock.ts`, `query-error.mock.ts`                                                                                                         |

Besides the per-page use cases, `features/api/` holds the shared TanStack Query adapters
(`use-api-list.ts`, `use-api-detail.ts`, `use-api-mutation.ts`, `use-list-params.ts`,
`api-hooks.logic.ts`). `features/api-keys` is a thin adapter over them — that is why
`features/api` counts as shared infrastructure, not as another page's use case.

`apps/web` is out of scope for this document's **layer map**: it has no features/entities
folders yet, so `pnpm quality:layers` cruises `apps/admin/src` only. The site _is_ on
`packages/ui` tokens and primitives since AIS-122, and `pnpm quality:tokens` covers it.

## 3. Design tokens (`packages/ui/src/styles/theme.css`)

Consumers import the token file right after Tailwind and register the primitive
sources for class scanning:

```css
@import 'tailwindcss';
@import '../../../packages/ui/src/styles/theme.css';
@source "../../../packages/ui/src";
```

### 3.1 Colour tokens

**Theme identity (admin retheme, 2026-10-22):** graphite / ash surfaces (low-chroma
cool neutrals) with a **teal-cyan accent**. The previous violet palette is gone; token
_names_ are unchanged, so no component had to be touched to pick up the new look.

| Group   | Tokens                                                                                                                                               | Typical utility                         | Role                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Brand   | `--color-primary`, `--color-primary-hover`, `--color-primary-foreground`, `--color-secondary(-foreground)`, `--color-tertiary`, `--color-quaternary` | `bg-primary`, `text-primary-foreground` | teal accent (`195°`), dark ink on the accent         |
| Surface | `--color-surface-base/-raised/-sunken/-overlay`                                                                                                      | `bg-surface-raised`                     | graphite ladder, base darkest at `L≈0.17`            |
| Border  | `--color-border-hairline/-default/-strong/-focus`                                                                                                    | `border-border-hairline`                | **dark** greys (`L≈0.30 / 0.36 / 0.45`) + teal focus |
| Text    | `--color-text-primary/-secondary/-muted/-inverse`                                                                                                    | `text-text-secondary`                   | light greys for the dark surfaces                    |
| State   | `--color-success/-warning/-danger/-info` (+ `-foreground`)                                                                                           | `bg-danger text-danger-foreground`      | saturated fills with dark or white ink respectively  |

### 3.2 Depth, shape, motion, thickness

| Group     | Tokens                                                                                     | Utility                            |
| --------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| Depth     | `--shadow-neu-raised`, `--shadow-neu-inset`, `--shadow-neu-pressed`, `--shadow-focus-ring` | `shadow-neu-raised`                |
| Shape     | `--radius-control`, `--radius-card`, `--radius-pill`                                       | `rounded-card`                     |
| Motion    | `--ease-neu`, `--duration-fast`, `--duration-base`                                         | `duration-fast`                    |
| Thickness | `--border-width-hairline`, `--border-width-default`, `--border-width-strong`               | `border-hairline`, `border-strong` |

`border-hairline`, `border-strong`, `duration-fast` and `duration-base` are
custom `@utility` declarations: Tailwind v4 has no theme namespace for border
widths or transition durations, so the tokens are plain custom properties
exposed through those utilities (decision **D15**).

### 3.2.1 Default border colour (**D40**)

Tailwind v4 preflight ships `border-style: solid` with **no border colour**, so
`border-color` resolves to `currentColor`. Every primitive that set only a
_width_ (`border border-hairline`) therefore painted its outline with the
near-white text token — the "whitish outlines" defect. Two layers of defence:

1. `theme.css` `@layer base` sets `border-color: var(--color-border-hairline)`
   for `*, ::before, ::after, ::backdrop, ::file-selector-button`. The
   `utilities` layer is emitted after `base`, so `border-danger`,
   `border-info`, `border-border-focus` and friends still win.
2. Every primitive states its resting outline explicitly
   (`border border-hairline border-border-hairline`) so the colour survives even
   if the base reset is ever removed.

Rule of thumb: a `border`/`border-b`/`border-t` utility **without** a colour
token now renders dark grey by default — never light. If a component needs a
non-default outline, it must name a border/state token.

### 3.3 Non-negotiable styling rules

1. No colour literal in `apps/*/src` — literals exist **only** in `theme.css`.
2. No Tailwind palette utility (`bg-slate-800`, `text-indigo-500`, …) and no
   palette opacity modifiers.
3. No arbitrary colour values (`bg-[#101010]`); arbitrary _layout_ values
   (`grid-cols-[2fr_1fr]`) are allowed.
4. New visual concepts are built once in `packages/ui` as a primitive or a CVA
   variant — never inline in a page.
5. Overlays render into a **`document.body` portal** (Radix `Portal`) and stack with
   the Tailwind scale utilities `z-40` (backdrop) / `z-50` (panel). There is **no
   z-index token**: overlay depth is layout, not colour, and the palette gate does not
   cover it (AIS-117 **D5**). The literals live in the primitives' `.const.ts` files,
   never repeated in JSX.

Definition-of-done check — the gate that enforces §3.3 (it also scans
`packages/ui/src`, which the old `rg` one-liner did not):

```bash
pnpm quality:tokens   # must print "OK quality:tokens (palette): 0 violations"
```

The gate is dependency-free (no `rg` needed on Windows) and implements exactly the
three rules above; see §9 for its negative fixture and its exemption list.

## 4. Primitives (`packages/ui/src/components`)

| Primitive                                                                          | Variants / props                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                                           | `variant`: `primary` \| `secondary` \| `ghost` \| `danger`; `size`: `sm` \| `md` \| `lg`; `isLoading`                 | `type` defaults to `button` (**D17**); submitting requires an explicit `type="submit"`. Loading sets `disabled` + `aria-busy`.                                                                                                                                                                                                                                                     |
| `Input`                                                                            | `label`, `id`, `error`, `hint`, `invalid`                                                                             | `id` is required so the label association is deterministic. Error wins over hint; `aria-invalid` + `aria-describedby` are wired. Forwards its ref so react-hook-form can focus the first invalid field.                                                                                                                                                                            |
| `Textarea`                                                                         | same props as `Input` + `rows` (default `4`)                                                                          | Multi-line twin of `Input` — same sunken recipe, `resize-y`, ref forwarded. Added by AIS-41 so a 2000-character description does not live in a one-line field.                                                                                                                                                                                                                     |
| `Card`                                                                             | `title`, `description`                                                                                                | Raised surface; title renders as an `h2`.                                                                                                                                                                                                                                                                                                                                          |
| `Table` + `TableHead` / `TableBody` / `TableRow` / `TableHeaderCell` / `TableCell` | native attributes                                                                                                     | `Table` owns the scroll container; header cells default to `scope="col"`.                                                                                                                                                                                                                                                                                                          |
| `Badge`                                                                            | `variant`: `neutral` \| `info` \| `success` \| `warning` \| `danger`                                                  | Variant names are the shared vocabulary for domain mappers.                                                                                                                                                                                                                                                                                                                        |
| `Alert`                                                                            | `variant`: `info` \| `success` \| `warning` \| `danger`, `title`                                                      | `danger` is announced as `role="alert"`, the others as `role="status"`.                                                                                                                                                                                                                                                                                                            |
| `Banner`                                                                           | `variant`: `info` \| `warning` \| `danger`, `title`, `action`, `onDismiss` + `dismissLabel`                           | App-level, full-width strip for a _persistent condition_ (offline / expired session / 503). `danger` → `role="alert"`, the others → `role="status"`. The props type makes `dismissLabel` mandatory whenever `onDismiss` is given, so the close control always has an accessible name. No timer: the banner disappears only when the condition ends or the user closes it (AIS-96). |
| `Skeleton`                                                                         | `shape`: `line` \| `field` \| `row`; `lines`                                                                          | Static placeholder (**D3**): sunken surface + inset shadow, **no** pulse — `theme.css` carries no motion token for it. The whole tree is `aria-hidden`; the loading sentence belongs to the surrounding region.                                                                                                                                                                    |
| `Spinner`                                                                          | `size`: `sm` \| `md`; `label` (default `Betöltés…`)                                                                   | `role="status"` on the wrapper, the ring is `aria-hidden`, the label is `sr-only`. Ring drawn from border tokens only (`border-border-strong` + `border-t-primary`).                                                                                                                                                                                                               |
| `EmptyState`                                                                       | `title`, `description`, `action?: { label, onAction }`                                                                | The “success, but no rows” state. Root is `role="status" aria-label={title}`; the CTA's `aria-label` is `` `${label} — ${title}` `` so a repeated button text stays unambiguous. Works without a CTA.                                                                                                                                                                              |
| `DescriptionList`                                                                  | `items: { label, value }[]`, `isLoading`, `empty`, `columns`: `1` \| `2`                                              | A real `<dl>`/`<dt>`/`<dd>` (each pair in a `div`, allowed since HTML 5.2). `isLoading` renders skeleton rows and **no** `dd`; empty renders the `empty` slot (or one neutral line).                                                                                                                                                                                               |
| `StatusBadge`                                                                      | `status`, `label`, `variant` (the `Badge` vocabulary)                                                                 | `<Badge variant data-status={status}>`. Adds **no** colour: the `status → variant` mapper stays in `entities/`.                                                                                                                                                                                                                                                                    |
| `Pagination`                                                                       | `meta: PaginationMeta`, `onPageChange`, `onLimitChange?`, `limitOptions?`, `ariaLabel?`                               | Structurally typed (**D1**) so `meta.pagination` from `@callback/shared` is assignable without a mapper — the UI package does not depend on the contract. `<nav>`, `aria-current="page"`, labelled prev/next, `<label>` + `<select>` for the page size. Pure rules in `pagination.logic.ts` (`toVisiblePages`, `toRangeLabel`, `clampLimit`).                                      |
| `DataTable`                                                                        | `rows`, `columns`, `rowKey`, `sort`, `onSortChange`, `isLoading`, `loadingRowCount`, `empty`, `caption`, `rowActions` | Composes the six `Table*` primitives (**Út A**, no `@tanstack/react-table`). It **never sorts locally** (**D2**) — it reports intent, the server owns the order. Sortable header = `<button>` inside the `<th>`, `aria-sort` on the `<th>`. Loading keeps the header and renders placeholders; empty renders the `empty` slot (default `EmptyState`).                              |

| `FormField` | `id`, `label`, `hint`, `error`, `required`, `children(field)` | The **only** place `aria-invalid` + `aria-describedby` are wired. The child is a render prop (**D1**), never `cloneElement`: `field` carries `id`/`invalid`/`describedBy` for our primitives and a spread-safe `ariaProps` for raw DOM controls. Error wins over hint; `required` adds an `sr-only` „(kötelező)". |
| `FormSection` | `legend`, `description?`, `children` | `<fieldset>` + `<legend>` instead of a styled `div` + heading, so the group name is announced when focus enters it. |
| `FormActions` | `submitLabel?`, `cancelLabel?`, `onCancel?`, `isSubmitting?`, `align?` | Submit is hard-wired to `type="submit"` (`Button` defaults to `button`, so this is the whole point). `isSubmitting` → `isLoading` on submit **and** disables cancel. Defaults live in `form-actions.const.ts`. |
| `Select` | `id`, `options[]`, `placeholder?`, `invalid?`, `describedBy?` | Native `<select>` reusing `inputVariants` (**D3**). The placeholder is a disabled option with the empty value (`SELECT_PLACEHOLDER_VALUE`), so it can never collide with a domain value. |
| `NumberInput` | native input attributes + `invalid?`, `describedBy?` | Native `input[type="number"]` (stepper, `min`/`max`/`step`, numeric keyboard), same recipe as `Select`. |
| `DatePicker` | `id`, `value`, `onChange`, `min?`, `max?`, `invalid?`, `describedBy?` | Controlled native `input[type="date"]` with a `yyyy-mm-dd` **string** contract — no date library, no conversion helper and no `@callback/shared` import in `packages/ui` (**D6**); the caller owns the domain format. |
| `Checkbox` | `id`, `label`, `description?`, `invalid?`, `describedBy?` | Native checkbox and its `<label>` in one component. `accent-primary` is the only portable way to colour it; `description` sits inside the label, so no second id is needed. |
| `Switch` | same contract as `Checkbox` | Native checkbox with `role="switch"`: keyboard, form serialisation and react-hook-form keep working with no JS state (**D4**). The visible track is a `peer-*`-styled sibling, the thumb is its `::after`. `aria-checked` follows the controlled `checked`. |
| `RadioGroup` | `name`, `legend`, `options[]`, `value`, `onChange`, `orientation?`, `invalid?`, `describedBy?`, `disabled?` | Controlled `<fieldset>` group. Arrow keys delegate to the pure `nextOptionValue` (wraps at both ends, skips disabled options); the platform still moves focus, so the two never fight. Tests target `role="group"` + the legend. |
| `Combobox` | `id`, `options[]`, `value`, `inputValue`, `onSelect`, `onInputValueChange`, `emptyMessage?`, `invalid?`, `describedBy?` | Fully controlled (**D5**): the caller owns value _and_ typed text. Filtering and index maths live in `combobox.logic.ts` (`filterOptions`, `nextActiveIndex`, `clampActiveIndex`, `normalizeQuery` — accent-insensitive). WAI-ARIA combobox pattern with `aria-activedescendant`. Local options only; async search / multi-select are out of scope. |
| `Toast` (AIS-81) | `level`: `success` \| `error` \| `warning` \| `info` \| `system`, `message`, `detail?`, `repeatCount?`, `onDismiss`, `onPause?`, `onResume?`, `depth?` | One notification card. The accent is the `Alert`/`Banner` border recipe; `error` → `role="alert"`, every other level → `role="status"`. **Stateless by contract**: no timer, no store, no storage — it reports the dismiss intent and forwards `pointerenter`/`pointerleave`, so the auto-dismiss clock belongs to the host (AIS-83). The entry animation is pure CSS through Tailwind's `starting:` variant, and `onPause` is omitted from the DOM attributes so the media event cannot clash with the callback. `detail` renders clamped to two lines with a `title`. |
| `ToastStack` (AIS-81) | `toasts` (**newest first**), `onDismiss`, `onPause?`, `onResume?` | Fixed bottom-right container and the live region itself (`role="region"`, `aria-live="polite"`, `aria-atomic="false"`, labelled). Renders at most `TOAST_MAX_VISIBLE` (`3`) cards, so the **newest** survive an overflow, and assigns each card its `depth` (`scale`/`opacity`) so older cards read as “behind”. `TOAST_STACK_Z_INDEX` is `z-60` — a toast must stay readable above the dialog/drawer surface (`z-50`). Pure rules in `toast.logic.ts` (`toToastDepth`). |
| `LogDrawer` (AIS-82) | `entries` (**newest first**, already sliced), `isOpen`, `unseenCount`, `levelFilter`, `hasMore`, `onToggle`, `onClose`, `onFilterChange`, `onLoadMore`, `onClear`, `formatTimestamp` | Collapsed edge tab (`aria-expanded` + `aria-controls`, count badge only when `unseenCount > 0`) plus a **non-modal** sliding panel: no overlay, no focus trap, page stays scrollable, `Escape` closes. Six chips (`Mind` / `Siker` / `Hiba` / `Figyelmeztetés` / `Info` / `Rendszer`) as `aria-pressed` buttons — `Siker` exists because the store emits `success`. Panel is `role="log"` with `aria-live="off"` (the announcement noise stays on the toasts). `LOG_DRAWER_Z_INDEX` is `z-40`: below the modal overlay and below the toast stack. Paging is **props only**; the 20/50 window belongs to AIS-83. |
| `LogEntryRow` (AIS-82) | `entry`, `formatTimestamp` | One row: level glyph chip **+** level text (severity is never colour-only), injected timestamp, `break-words` message, `detail` only when present. Reuses the `Toast` chip recipe and glyph map, so a toast and its log row cannot disagree about a level. |

Exports are explicit from `packages/ui/src/index.ts` (no `export *`). `cn()` is
exported too so pages can merge caller classes with the recipe classes.
The seven data-display primitives above arrived with **AIS-116**; the accessible names the
pager uses (`PAGINATION_NEXT_LABEL`, …) are exported as well, so a page test asserts against
the same constant the component renders.

**`LogDrawer` has one persistent arrow handle (AIS-136).** One always-mounted `<button>` toggles the
panel in **both** directions — it used to render only while collapsed. It exposes `aria-expanded`
and `aria-controls` in both states, flips its glyph (`‹` collapsed → `›` open) and its accessible
name (`LOG_DRAWER_OPEN_LABEL` / `LOG_DRAWER_CLOSE_LABEL`), keeps the unseen badge in both states and
reports the single intent through `onToggle`; `✕` (`LOG_DRAWER_HEADER_CLOSE_LABEL`, a **different**
name so two controls are never indistinguishable) and `Escape` stay as secondary close paths. The
element is a sibling **after** the panel, because the collapsed panel is `pointer-events-none` — a
handle inside it would be unreachable exactly when it is needed. Its position never changes
(`right-0`): the open panel reserves a right gutter (`LOG_DRAWER_HANDLE_GUTTER`) instead, so there is
no viewport-dependent offset and no layout shift. The panel stays **non-modal**: no overlay, no focus
trap, page still scrollable.

The ten form primitives arrived with **AIS-113** and are the mandatory route for new forms:
a form composes `FormSection` → `FormField` → primitive, and `FormActions` for the buttons.
`Input`/`Textarea` are intentionally left untouched (they keep their own `label`/`hint`/`error`
props), so nothing in `packages/ui` broke. The a11y gate for all of them is
`packages/ui/test/form-a11y.test.tsx` (default / hint / error / disabled / open-listbox).

The toast layer arrived with **AIS-81** and is only the *presentation* of the notification
subsystem. `ToastLevel` is declared in `packages/ui`; the store (`@callback/notifications`, AIS-79)
declares its own `NotificationLevel` union with the same five literals, because `packages/ui` and
`packages/notifications` must not import each other (React peer vs. framework-free core). The two
vocabularies are kept in sync by **pinned tests on both sides** — `NOTIFICATION_LEVELS` in
`packages/notifications` and the `TOAST_LEVEL_GLYPHS` keys in `packages/ui` — so a change on one side
without the other fails a suite instead of drifting silently. `ToastStackProps.toasts` is **newest
first** — the store prepends — and that contract is the only reason the trimming keeps the newest
cards when the list overflows. The timers, the `notify` facade and the `NotificationHost` belong to
AIS-83 and must never leak into these two primitives: they hold no `useState`, no `useEffect` and no
storage access.

The log panel arrived with **AIS-82** and completes the presentational half of the same subsystem.
`LogEntryItem` is structurally typed, so the store's `NotificationEntry` is assignable with no mapper
(the extra `source`/`read`/`toast`/`repeatCount` fields are simply ignored) and `packages/ui` stays
free of `@callback/notifications` imports. The drawer is deliberately **non-modal** — it is a
diagnostics side view, so `OverlayShell` (focus trap, overlay, scroll lock) must **not** be reused —
and it owns no state: the filter, the unseen count, `hasMore` and the visible slice all come from the
host. The panel element stays mounted and only its `translate-x` class changes, which animates both
directions and keeps the tab's `aria-controls` from dangling, while the panel *content* renders only
while open so nothing hidden is focusable. The single side effect in `packages/ui` lives here: a
`document` `keydown` listener, registered only while open, that closes on `Escape`. Timestamps are
injected (`formatTimestamp`) so the package stays independent of the app's date helpers.

#### `packages/notifications` core (AIS-79)

Framework-independent store: the single source of truth for notifications **and** system log entries.
`createNotificationStore(options?)` is a **factory, not a singleton** — the owning app decides the
lifetime, so two apps (or two tests) never share state. No React, no DOM, no storage, no `zod`; the
package's `tsconfig` enables only `lib: ES2022`, so a `window`/`document`/`localStorage` reference
fails the build instead of leaking in.

| Aspect                | Contract                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API                   | `emit`, `dismiss(id)`, `markAllRead`, `clear`, `subscribe`, `getSnapshot`, `getServerSnapshot`                                                                 |
| Snapshot              | `{ entries, toasts }`, **both newest first**; referentially stable while nothing changes (what `useSyncExternalStore` requires)                                |
| Ring buffer           | `NOTIFICATION_MAX_ENTRIES = 500`, the oldest entry dropped                                                                                                    |
| Toast ids             | `NOTIFICATION_MAX_VISIBLE_TOASTS = 3` (mirror of `TOAST_MAX_VISIBLE`); a 4th toast drops the oldest **id**, its entry stays in the log                        |
| Dedupe                | identical `level` + `message` within `NOTIFICATION_DEDUPE_WINDOW_MS = 2000` (inclusive) bumps `repeatCount`, refreshes `createdAt`, moves the toast to the front |
| Toast default         | `toast = level !== 'system'`; an explicit `toast` flag wins                                                                                                   |
| Redaction             | a `detail` record is redacted by the store (`authorization`, `token`, `password`, `apiKey`, `secret`, …) and only then serialised — no emitter can bypass it  |
| Restored entries      | `initialEntries` seeds `entries` **only**; `toasts` always starts empty, so a reload never resurrects an expired toast (AIS-80/83)                            |
| Injected dependencies | `now()` clock, caps, dedupe window; ids come from `createNotificationId(now, sequence)` — deterministic, no `crypto`/`Math.random` in the core                  |
| Listener errors       | caught **per listener** and forwarded to `onListenerError` (default `console.error`), so one broken subscriber cannot silence the rest                          |

User-facing text is never produced here (no i18n): the emitter supplies the sentence, and
`notification-event.const.ts` holds only event kinds plus their default `level` / `source` / `toast`
classification.

#### `sessionStorage` mirror (AIS-80)

`createNotificationStorage({ storage, key, cap, schedule })` is the only part of the subsystem that
knows a storage exists, and it knows it only through an injected `StorageLike` — the package builds
with `lib: ["ES2022"]`, so `window`, `sessionStorage` and `requestAnimationFrame` cannot appear in its
code at all. The adapter is **not** bound to the store: the app restores once with `load()`, seeds
`createNotificationStore({ initialEntries })` with the result, forwards each `entries` snapshot to
`save()`, and calls `flush()` from a `pagehide` handler (AIS-83). Nothing throws and nothing is
reported to the user — losing the mirror is acceptable, breaking the app is not.

| Aspect           | Contract                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key / envelope   | `aisztens.notifications.v1`, payload `{ version: 1, entries }` — the version lives in the key *and* in the envelope                                        |
| Cap              | `NOTIFICATION_STORAGE_MAX_ENTRIES = 200`, oldest dropped (smaller than the 500-entry memory buffer); the cap is also enforced on restore                  |
| Payload          | `entries` only — never `toasts`, never timers, so a reload cannot resurrect an expired card                                                                |
| Validation       | all-or-nothing: version, `entries` array, then every entry field (`id`, `level`, `source`, `message`, `detail?`, `createdAt`, `read`, `toast`, `repeatCount`); unknown extra keys are tolerated |
| Rejection        | `missing` / `malformed-json` / `wrong-version` / `wrong-shape` → the key is removed (except `missing`) and the store starts empty; no migration in phase 1 |
| Write coalescing | injected `NotificationWriteScheduler`; default is a microtask, AIS-83 passes `requestAnimationFrame`; the pending write always carries the **latest** entries |
| Duplicate writes | a payload equal to the last written (or restored) one is skipped — a toast dismissal must not cost an `setItem`                                            |
| Failure modes    | `setItem` throws → memory-only, the payload is **not** marked written so the next save retries; `getItem` throws → empty list, no `removeItem`             |
| `clear()`        | cancels the pending write **before** `removeItem`, otherwise a queued flush would resurrect the key                                                        |

#### React bindings and host (AIS-83)

`@callback/notifications/react` is the second export of the package and the only code that knows
React exists. An app mounts **one** pair:

```tsx
<NotificationProvider includeDetails={import.meta.env.DEV}>
  <App />
  <NotificationHost />
</NotificationProvider>
```

| Aspect            | Contract                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore           | store **and** mirror are built in `useState` lazy initialisers, so `storage.load()` runs once, synchronously, and the first paint already shows the restored log (no flash)          |
| Subscriptions     | every hook is `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)`; derivation happens in `useMemo`, never inside `getSnapshot` (that would loop)     |
| Toast lifetimes   | `success`/`info` 4 s, `warning` 6 s, `error` **sticky** (`system` sticky too); one timeout per toast id, owned by `NotificationHost` via `useToastTimers`                            |
| Pause             | `pointerenter` clears the timer, `pointerleave` restarts a **full** TTL; `document.hidden` clears every timer and becoming visible restarts the countdown of what is still on screen |
| Log window        | `20` rows on open, `+50` per „Korábbiak betöltése", `hasMore` derived from the filtered buffer; a filter change resets the window — state lives in `useLogDrawer` (`useState`)      |
| Mark read         | opening the drawer calls `markAllRead()` in the toggle handler, not in an effect, so one click = one store write                                                                    |
| Emitters          | `createNotifier(store)` works without React; `useNotifier()` binds the provider store. There is **no** module-level `notify` singleton                                                            |
| Runtime capture   | the provider registers `window` `error` + `unhandledrejection` (`source: 'runtime'`, `level: 'error'`) and removes both on unmount; the stack is only recorded with `includeDetails`  |
| Mirror writes     | the provider forwards every `entries` snapshot to `storage.save`, flushes on `pagehide` and once more on unmount; the default scheduler is one flush per animation frame              |
| Timestamps        | `formatTimestamp` is injected (default `toLocaleTimeString('hu-HU')`) and forwarded to `LogDrawer`, so `packages/ui` stays free of app date helpers                                |

`logNavigation` from the base plan is **not** part of AIS-83: router logging needs the app's
`react-router` callbacks, so it is added in AIS-84 where the router actually lives. **AIS-84 shipped
without it** (key decision 8 of the ticket): a navigation log is pure noise, so a follow-up ticket
turns it on behind an explicit flag instead of shipping a permanently disabled logger.

#### 4.1.3 Global capture in the admin app (AIS-84)

Nothing in a page or a form has to call `notify` to report a failure. Three central emitters write
into the one store the UI renders, and each of them maps through
[`notification-events.logic.ts`](../../apps/admin/src/app/notifications/notification-events.logic.ts:1)
(pure, one function per source):

| Source | Condition | Level | `source` | Toast |
| ------ | --------- | ----- | -------- | ----- |
| `HttpEvent` | `outcome: 'success'` | `system` | `api` | no |
| `HttpEvent` | `outcome: 'error'` (any status, incl. `status: null`) | `error` | `api` | no (**D3**) |
| `QueryCache.onError` | `surface === 'silent'` (abort) | — | — | no entry |
| `QueryCache.onError` | `field` (addressable input) | `error` | `api` | no (**AIS-136 D1**) |
| `QueryCache.onError` | `banner` (`401`, `503`, `status === null`) | `error` | `api` | **yes** (AIS-136) |
| `QueryCache.onError` | `page` | `error` | `api` | **yes** |
| `MutationCache.onError` | same four rules as a failed read | `error` | `api` | see above |
| `MutationCache.onSuccess` | `meta.successMessage` non-empty | `success` | `form` | **yes** |
| `MutationCache.onSuccess` | no meta / blank copy | — | — | no entry |
| `AppErrorBoundary` (AIS-136) | a component threw while rendering | `error` | `runtime` | **yes** |
| `window` `error` / `unhandledrejection` | always (AIS-83, unchanged) | `error` | `runtime` | yes |

**The toast matrix is a total function of the surface** (AIS-136 `D1`): `silent` → no entry,
`field` → log only, `banner` and `page` → log **and** toast. `toFailureToast(surface)` in the same
logic module is an exhaustive `switch`, so a new `ErrorSurface` member cannot silently inherit one of
the two answers. A `banner` failure is toasted **in addition to** `AppErrorBanner`, deliberately
(`D2`): the banner expresses the persistent **condition** (offline / expired session / 503) and
survives a dismissed toast, while the toast marks the **moment** the failure happened. A field
failure stays off the toast, because the input keeps focus and shows the message.

A render crash reaches the user through the same store: `AppErrorBoundary` takes an **injected**
`onError` port (it is a class component, so no hook — `D3`), and
[`runtime-error.ts`](../../apps/admin/src/app/notifications/runtime-error.ts:1) turns the report into
the catalogued `runtime.error` entry (`RUNTIME_ERROR_MESSAGE` + `toRuntimeDetail`, stack only when
`import.meta.env.DEV`). `App.tsx` builds that emitter once from the single store, so the boundary
depends on a port rather than on a singleton.

Why the transport event is log-only (**D3**, a deliberate deviation from the ticket's key decision 5):
`HttpEvent` carries a status but **no code and no `issues[]`**, so it can neither pick the accurate
Hungarian copy nor respect the classifier that decides where a failure is allowed to appear.
Toasting there would put two cards on screen for every failed write — one with the status copy, one
with the code copy. The transport therefore only *records* the attempt, which is what the log panel
is for: the detail is `"{durationMs} ms"` and the message is `"{METHOD} {path} — {status|hálózati hiba}"`.

Wiring, in the order `main.tsx` performs it:

1. `app/notifications/notification.store.ts` creates the **single** store and its `sessionStorage`
   mirror (an injected store is *not* seeded by the provider, so the restore happens before the store
   exists — AIS-83 `D3`);
2. `setHttpEventListener(createHttpEventEmitter(store))` — `services/http-events.ts` is the registry
   the transport reads, because `services` may not import `app/` (`no-service-to-higher-layer`);
3. `createAppQueryClient(store)` builds the one `QueryClient` with
   `new QueryCache(createQueryCacheHandlers(store))` and the matching `MutationCache`; the retry and
   refetch defaults are unchanged (`retry: 1`, no refetch on focus);
4. `AppProviders` mounts `QueryClientProvider → NotificationProvider → SessionProvider`, and
   `AdminLayout` renders `<NotificationHost />` as a **sibling of `<main>`** — so the stack and the
   drawer survive navigation and exist on every protected page, while the public login route has no
   host at all.

`useApiMutation` accepts an optional `mutationKey`, which is what the failure entry puts into
`detail` (`mutationKey=["api-keys","create"]`) — without it the log would say *that* a write failed
but not *which* one.

### 4.0 Overlay primitives (AIS-117)

| Primitive       | Variants / props                                                                                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Dialog`        | `open`, `onOpenChange`, `title`, `description?`, `footer?`, `size`: `sm` \| `md` \| `lg`, `closeLabel?`                                   | Modal card over a dimmed backdrop. **Controlled only** (the page owns "is it open"). Radix supplies focus trap / `Esc` / outside dismiss / focus restoration; `aria-modal="true"` is set explicitly (Radix only hides siblings), `aria-labelledby` comes from the rendered `Title` — no id props. No `Dialog.Trigger` is required, so a dialog can be opened from a table row. |
| `ConfirmDialog` | `open`, `onOpenChange`, `title`, `description?`, `confirmLabel`, `cancelLabel?`, `tone`: `danger` \| `primary`, `isPending?`, `onConfirm` | **Reports the decision only** (**D4**): confirm calls `onConfirm` and the dialog stays open — the caller closes it when the mutation succeeds, otherwise a failure would erase the question. `isPending` disables both buttons, marks confirm `aria-busy` and **blocks `Esc`/cancel dismissal**. `confirmLabel` is required; there is no generic "OK".                         |
| `Drawer`        | `open`, `onOpenChange`, `title`, `description?`, `side`: `right` \| `left`, `footer?`, `closeLabel?`                                      | Same modal shell as `Dialog` (**D3**) with a full-height edge-pinned panel; the body is the scroll container, so the footer stays reachable. Built on `react-dialog`, **not** `react-popover` — a form panel needs the modal contract.                                                                                                                                         |
| `Tooltip`       | `content`, `children` (trigger), `side?`, `delayMs?`, `disabled?`                                                                         | Ships **its own** `Tooltip.Provider` (**D6**) so a consumer cannot forget it. The content is `aria-describedby` only — **never** the accessible name (**D7**); the trigger must already be labelled. `disabled` renders the trigger alone.                                                                                                                                     |
| `DropdownMenu`  | `trigger`, `items: DropdownMenuItem[]`, `label?`, `align?`, `emptyLabel?`                                                                 | **Data-driven** (**D8**): `{ id, label, onSelect, tone?, disabled? }`, `tone: 'default' \| 'danger'`. Selecting calls `onSelect(id)` and closes the menu. Empty `items` renders one disabled `DROPDOWN_MENU_EMPTY_LABEL` row instead of an empty box. Keyboard/roving focus is Radix's.                                                                                        |

The a11y gate for all five is [`overlay-a11y.test.tsx`](../../packages/ui/test/overlay-a11y.test.tsx:1)
(`vitest-axe`, WCAG A/AA rule sets, `color-contrast` off in jsdom). Behavioural coverage lives in
`dialog` / `confirm-dialog` / `drawer` / `tooltip` / `dropdown-menu` test files; the jsdom shims
(`ResizeObserver`, pointer capture, `scrollIntoView`) and the `pointerEventsCheck: 0` user-event
instance are shared from `test/mocks/`.

### 4.1 Error surfaces (AIS-96)

A failure becomes visible in exactly one of four places. The decision is made by
`toErrorSurface(error)` in `apps/admin/src/lib/error-surface.logic.ts` — pure, no React,
no I/O — so no component inspects `status`, `code` or the server `message`.

| First matching condition                            | Surface              | Rendered by             |
| --------------------------------------------------- | -------------------- | ----------------------- |
| `AbortError` / `CancelledError`                     | `silent`             | nothing                 |
| not an `ApiError`                                   | `page`               | `PageErrorState`        |
| `status === null` (offline, DNS, CORS)              | `banner`             | `AppErrorBanner`        |
| `401`                                               | `banner` (login CTA) | `AppErrorBanner`        |
| `503`                                               | `banner`             | `AppErrorBanner`        |
| field code with `issues[]` (§4.1.1)                 | `field`              | RHF `setError` (AIS-95) |
| everything else (`400`, `403`, `404`, `409`, `5xx`) | `page`               | `PageErrorState`        |

Banner state is derived, never stored: `useOnlineStatus()` mirrors `navigator.onLine`
(`useSyncExternalStore` over the `online`/`offline` events) and
`useAppErrorBanner()` reads the TanStack Query cache through `query-error.store.ts`
(a stable snapshot, so React does not loop). Precedence: offline → `401` → `503`; only one
condition is ever rendered. The only local state is the dismissal flag, reset when the set
of cached errors changes. Copy: `lib/error-surface.const.ts`; messages: `toErrorMessage`.

#### 4.1.1 One code catalogue (AIS-111)

`lib/api-error-code.const.ts` holds the **single** `code → copy` table.
`ERROR_CODE_CATALOGUE` is a **total** `Record<ApiErrorCode, ApiErrorCodeCopy>` over the
shared `API_ERROR_CODE` catalogue, and both derived artefacts are computed from it — they
are never written by hand:

| Derived export        | Consumed by                                         | Rule                        |
| --------------------- | --------------------------------------------------- | --------------------------- |
| `ERROR_CODE_MESSAGE`  | `toErrorMessage` (page/alert copy)                  | one Hungarian sentence/code |
| `FIELD_SURFACE_CODES` | `toErrorSurface` (`field` tier) and `toFieldErrors` | `fieldMessage !== null`     |

Consequence: adding a code to `packages/shared` is a **compile error** here until copy and a
field decision exist for it. That gap is what the old pair of hand-maintained tables (plus a
feature re-export) silently hid — `STALE_WRITE` and `SEMANTIC_VALIDATION_FAILED` (AIS-108)
rendered the generic `409`/`422` sentences until AIS-111.

Field-capable today: `VALIDATION_FAILED`, `SEMANTIC_VALIDATION_FAILED`,
`API_KEY_IDENTIFIER_CONFLICT`. `STALE_WRITE` is deliberately **not** field-capable: it
blames `updatedAt`, a hidden concurrency token, so it stays page-level with reload copy.

#### 4.1.2 Failure → form (`lib/field-errors.logic.ts`)

`toFieldErrors<F extends string>(error, { fieldPaths, defaultPathByCode })` is the only
implementation of “which inputs are wrong, with what copy”. The caller passes the paths its
form owns; the code→path default (`409` → `identifier`) stays in the **feature**, because
only it knows its own field names. Rules, in order:

1. cancellation → nothing at all (`silent`, same value as `toErrorSurface`);
2. not an `ApiError`, or a code outside `FIELD_SURFACE_CODES` → page copy only;
3. `issues[]` present → one message per owned path (first issue per path wins); an
   unaddressable path adds one page copy;
4. `issues[]` empty → `defaultPathByCode` when it names an owned path, otherwise page copy.

The server's `issue.message` is English developer text and is never rendered.

### 4.1 The `app/` layer (`apps/admin/src/app/`)

The application shell: providers, routing, layout, session and the error boundary. It is the
top of the layer map, so it may import `pages/`, but nothing imports it except `App.tsx`.

| Folder           | Contents                                                                      | Rule                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/router/`    | `route-registry.tsx` (the route table), `AppRouter.tsx`, `ProtectedRoute.tsx` | The registry is the **only** place a route exists. The `<Routes>` markup and the navigation are both derived from it — there is no second, hand-written link list                                                |
| `app/layout/`    | `AdminLayout.tsx` (header + nav + `<main>`), `AdminNav.tsx`                   | The layout owns the frame; it never decides whether the user is logged in — that is `ProtectedRoute`'s job                                                                                                       |
| `app/providers/` | `AppProviders.tsx` (the provider chain), `SessionProvider.tsx`                | The order is `QueryClientProvider → SessionProvider`. The `QueryClient` is **created in `main.tsx`** and handed in as a prop, because the notification store (AIS-84) binds its cache callbacks to that instance |
| `app/session/`   | `use-require-session.ts`, `session.interface.ts`                              | The `app/` layer reads the session **only** through this hook, so the cookie session (AIS-74) changes one file instead of the layout, the router and the nav                                                     |
| `app/error/`     | `AppErrorBoundary.tsx`                                                        | The fourth error tier: a render error must not blank the page — it shows `PageErrorState` instead                                                                                                                |

The components take the route table as a **prop** (`routes`), never by importing it. That is what
lets a component test mount the shell with a minimal registry instead of the whole application.

### 4.2 Adding a route

One entry in `app/router/route-registry.tsx`:

```tsx
{
  path: '/companies',
  navLabel: 'Cégadatok',
  element: <CompaniesPage />,
  protected: true,
}
```

- `navLabel: null` → the route exists but is not linked in the navigation.
- `hidden: true` → the route has a label but stays out of the navigation (the index route).
- The registry test enforces the invariants: unique paths, a leading slash, and **no path may start
  with `/api/`** — the Vite dev proxy forwards `^/api/` to the API, so a colliding route would
  answer with JSON instead of the app shell (see §8.1).

### 4.3 Form schemas and validation copy (AIS-112)

A form schema is **derived** from the shared request schema, never re-typed:

```ts
// apps/admin/src/pages/api-keys/api-keys.logic.ts
export const apiKeyFormSchema = createApiKeySchema
  .omit({ description: true, expiresAt: true })
  .extend({
    description: trimmedStringSchema({ max: API_KEY_DESCRIPTION_MAX_LENGTH }),
    expiresAt: dateOnlySchema.or(z.literal('')),
  });
```

Two overrides, both about the _form_ and not about the rule: an empty description is allowed
(the mapper omits it) and `expiresAt` holds a calendar day instead of an ISO instant. Everything
else — limits, patterns, rejection copy — comes from `@callback/shared`.

**No validation sentence lives in the admin app.** The copy is one catalogue
(`packages/shared/src/contract/common/validation-message.const.ts`, `en` + `hu`), and the language
is decided in exactly two places:

| Where                                                                        | Call                                                      | Effect                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`apps/admin/src/main.tsx`](../../apps/admin/src/main.tsx:1)                 | `configureValidationLocale('hu')`                         | every schema message resolved after boot is Hungarian                          |
| [`ApiKeyForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:55) | `zodResolver(schema, { errorMap: VALIDATION_ERROR_MAP })` | the zod-generated issues (`too_small`, `invalid_string`, …) are translated too |

Tests must do the same: [`apps/admin/src/test/setup.ts`](../../apps/admin/src/test/setup.ts:1) calls
`configureValidationLocale('hu')`, so a missing translation fails a test instead of reaching a user.
Schema tests that parse without the map are testing the **server** path, i.e. English.

### 4.4 The form pattern (`useAppForm`, AIS-115)

A page never wires `useForm` + `zodResolver` + `setError` itself any more. It declares the schema,
the ordered field paths and the submit call, and
[`useAppForm`](../../apps/admin/src/features/forms/use-app-form.ts:1) returns
`{ register, handleSubmit, errors, formState, formError, reset, setServerError, clearFormError }`:

| Concern              | Where it is decided                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| validation           | `zodResolver(schema, { errorMap: VALIDATION_ERROR_MAP })` inside the hook (§4.3)                                             |
| which input is wrong | `lib/field-errors.logic.ts` `toFieldErrors` (AIS-111), **not** the hook                                                      |
| focus order          | `use-app-form.logic.ts` `toFormErrorPlan` + declared `fieldPaths`; only the **first** entry focuses                          |
| page-level message   | the hook's `formError`, rendered as one `Alert` — **only** when the failure was `field`-surface and the mapping left a residue; `page`/`banner`/`silent` failures keep it `null` (AIS-85 `D2`, who-speaks table in [`Forms-and-Validation.md`](./Forms-and-Validation.md:1) §3.1) |
| success feedback     | `reset(defaultValues)` → `notify.success(successMessage)` → `onSuccess`; the port is `useNotifier()` from `@callback/notifications/react` (structurally a `FormNotifier`), and the mutation carries **no** `meta.successMessage`, so exactly one toast appears (AIS-85 `D1`) |

`handleSubmit` is the **ready** submit handler (goes straight onto `<form onSubmit={…}>`), not
react-hook-form's curried function — a page therefore cannot bypass the validate → submit → reset →
notify order. The hook holds no field name and no sentence, and never branches on `error.code`
(the field-error gate, §9.3). Full contract and tests: [`Forms-and-Validation.md`](./Forms-and-Validation.md:1).
`ApiKeyForm.tsx` is the reference implementation since **AIS-85**: `Input`/`Textarea` carry their own
`label`/`hint`/`error`/`aria` wiring, so they are **not** wrapped in `FormField` (that would render two
labels and the primitive overrides `aria-describedby` after `...rest`); `FormField` is for controls that
bring no label of their own.

## 5. State plan per page

The bucket order is the one in [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) §6:
**list/navigation state → the URL, server state → TanStack Query, transient page UI state → that
page's Zustand store, local state → `useState`**, and form state → react-hook-form. Never mix them.
A page appears in this table even when **three of the four buckets are intentionally empty** —
"no store" is a decision, not an omission (compare **D9**).

| Page                                                                 | Server state                                                                                                                                                                                                                                            | Page UI state                                                                                                                                                                                           | Form state                                                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/api-keys` (AIS-41, `/api-keys` route)                         | `useApiKeysQuery` / `useCreateApiKeyMutation` in `features/api-keys`; query keys only from `features/api-keys/api-keys.const.ts` (`API_KEYS_QUERY_KEYS`). The query hook exposes the raw `error` (keeps `requestId`), `errorMessage` and `errorSurface` | **none** — no Zustand store, no filters/sort/tabs (D9), and since AIS-85 no form-level error state either (the hook owns `formError` as residue only). The app banner keeps only a dismissal flag (`useState`), never server data | `useAppForm` + `apiKeyFormSchema` (`pages/api-keys/api-keys.logic.ts`) with `API_KEY_FIELD_PATHS` and `DEFAULT_FIELD_PATH_BY_CODE`; success → `useNotifier()`, `409` → `identifier` field with focus and no toast (D8/D36, AIS-85 `D1`/`D2`) | The table never renders `apiKey` — `entities/api-key/api-key.mapper.ts` drops it (D33); `expiresAt` goes through `lib/date.ts` (D6); the payload omits empty optional fields (D32). Failure routing: `errorSurface === 'page'` → `PageErrorState` + retry **and** the capture toast for the write; `banner` → only `AppErrorBanner` speaks, the page renders nothing extra (AIS-96); `field` → the input, plus the residue `Alert` only when a path has no input (AIS-85) |
| `pages/api-keys/ApiKeyDetailPage` (AIS-131, `/api-keys/:identifier`)  | `useApiKeyDetailQuery` / `useUpdateApiKeyMutation` / `useDeleteApiKeyMutation` in `features/api-keys`; the identifier is the `useParams` value and part of `API_KEYS_QUERY_KEYS.detail(identifier)`. All three expose `error` / `errorMessage` / `errorSurface` | **none** — no store. Three `useState` flags only: dialog open, “last write was stale”, “last write succeeded”. None survives navigation and none copies server data (a remount is not needed for them)    | `useAppForm` + `apiKeyEditFormSchema`; `updatedAt` is a **prop**, never a field, and the form is remounted with `key={updatedAt}` after a save (the hook ends a submit with `reset(defaultValues)`) | `identifier` and `apiKey` are not editable (the PATCH contract is `.strict()`); `404` has its own branch instead of an empty `DescriptionList`; `409 STALE_WRITE` → page `Alert` + reload via `isStaleWriteFailure`, `422` → the blamed input; the delete runs through `ConfirmDialog` and closes only on success (AIS-131) |
| `pages/LoginPage` (`/login` route)                                   | none                                                                                                                                                                                                                                                    | none                                                                                                                                                                                                    | `AuthContext` + `auth/session-token.ts` over `sessionStorage`; no RHF yet                                                                          | The token storage key lives in one module only (D19). The `app/` layer reads the session through `useRequireSession()` only, so the cookie session (AIS-74) changes one file. API-side auth guard is out of scope                                                                                                                           |
| `pages/PlaceholderPage` (`/` route)                                  | none                                                                                                                                                                                                                                                    | none                                                                                                                                                                                                    | none                                                                                                                                               | Static shell for the authenticated landing route; replaced when a real dashboard lands                                                                                                                                                                                                                                                      |
| `/calls` route (a registry entry in `app/router/route-registry.tsx`) | none                                                                                                                                                                                                                                                    | none                                                                                                                                                                                                    | none                                                                                                                                               | Placeholder markup carried by the route registry; becomes a page folder when the calls feature starts                                                                                                                                                                                                                                       |

Adding a page means adding a row here in the same change (rule §0.10). If a page has **transient** UI
state that is neither URL- nor server-owned (rule §6.1 step 3 answered yes), it gets a page-local
store factory inside its own folder — never a global store. Exactly **two** global stores are
allowed: the session store (`app/providers/session-provider.tsx`) and the notification/log store
(`app/notifications/notification.store.ts`, AIS-84). Both are global because their consumer exists
before any page does — the router reads the session, and the cache callbacks plus the HTTP listener
write into the store before the first render. Any other global store is a defect.

**Form state is always react-hook-form, and always through `useAppForm` (AIS-115, §4.4).**
The page-level failure message a form shows is the hook's own `formError` state, so a form never
copies server data into a store and never keeps a second `useState` for errors.

**List state lives in the URL (AIS-119), not in a store.** A list's filter, sort and page are
read from and written back to the URL through [`features/api/use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:1)
(`useListParams(schema)`), so they are **not** page UI state and never enter a Zustand store.
The hook is generic and takes the resource's shared list-query schema as a parameter; the
parsed `params` is what the generic `useApiList` (AIS-114) feeds into a TanStack Query key.
`zustand` therefore stays **uninstalled** — the decision was closed in **AIS-130** (§7): it is added
together with the first page that genuinely needs transient UI state (open drawer, selected row,
column filters), and that change flips the §7 row to `installed`.

**AIS-116 closed the loop on `pages/api-keys`:** the page now _renders_ what the URL says and
_writes_ back what the user asks for, so the row above still holds “no page store”:

| Interaction                     | URL write                                                                                      | UI                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| next/previous page, page number | `setParam('page', n)`                                                                          | `Pagination` (`meta.pagination`) |
| page size                       | `setParam('limit', n)` (`API_KEYS_LIMIT_OPTIONS`: 20 / 50 / 100)                               | `Pagination` limit `<select>`    |
| sortable header click           | `setParams(toSortParams(sort))` — **one** write for `sort` + `order`, page reset to 1 (**D4**) | `DataTable` `aria-sort`          |

Two `setParam` calls would each rebuild the URL from the same pre-render `params`, so the first
change would be lost (and two history entries created). That is why `setParams(patch)` exists and
why `toSortParams` returns a patch instead of writing twice. The same change fixed the write path
in `useListParams`: the URL builder now compares against the **schema** defaults, not against the
candidate's own values — otherwise `sort`, `order` and `limit` were silently dropped from the URL.
The table still owns nothing: the failure stays `PageErrorState` (`D11`), and the sorted column is
`toTableSort(params)` computed from the URL on every render.

## 6. New page recipe

The step-by-step, file-name-level, layer-ordered checklist is
[`New-Admin-Page.md`](./New-Admin-Page.md) (owner AIS-133). It is the **only** place that lists the
steps — this section and `.roo/rules/react.coding-standards.md` §12 only point at it.

What stays in this document, because it is a decision rather than a step:

- **§5 is the state plan** — a new page adds **one row** there, even when three of the four buckets
  are intentionally empty ("no store" is a decision, not an omission);
- **§4.4 is the form pattern** — every form goes through `useAppForm`, and the plumbing is never
  re-implemented in a page;
- **§3.3 and §4 are the styling and primitive vocabulary** the checklist refers to.

Route registration is derived: one `RouteEntry` in `app/router/route-registry.tsx` produces both the
`<Routes>` markup and the navigation, so `AdminNav.tsx` needs **no** edit for a new page.

## 7. Dependency list (UI side)

| Dependency                                                                                              | Where                                    | Why                                                                                                             | State                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class-variance-authority`                                                                              | `packages/ui`                            | variant recipes                                                                                                 | installed                                                                                                                                                                                                                                                                     |
| `clsx`, `tailwind-merge`                                                                                | `packages/ui`                            | `cn()` class merging                                                                                            | installed                                                                                                                                                                                                                                                                     |
| `tailwindcss` + `@tailwindcss/vite`                                                                     | `apps/admin`                             | Tailwind v4 pipeline                                                                                            | installed                                                                                                                                                                                                                                                                     |
| `@tanstack/react-query`                                                                                 | `apps/admin`                             | server-state bucket                                                                                             | installed                                                                                                                                                                                                                                                                     |
| `react-router-dom`                                                                                      | `apps/admin`                             | routing                                                                                                         | installed                                                                                                                                                                                                                                                                     |
| `@callback/shared`, `@callback/ui`, `@callback/api-client`                                              | `apps/admin`                             | workspace packages                                                                                              | installed                                                                                                                                                                                                                                                                     |
| `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | `packages/ui`, `apps/admin`              | component + hook tests                                                                                          | installed                                                                                                                                                                                                                                                                     |
| `msw`                                                                                                   | `apps/admin`                             | network-boundary doubles for hook/component tests (service boundary is the mock point, not the service)         | installed (`^2.15.0`)                                                                                                                                                                                                                                                         |
| `@vitest/coverage-v8`                                                                                   | `packages/ui`, `apps/admin`              | LCOV coverage for the SonarQube report (`test:cov` → `pnpm sonar:coverage`, see [`SonarQube.md`](SonarQube.md)) | installed (`^3.2.4`)                                                                                                                                                                                                                                                          |
| `vitest-axe`                                                                                            | `packages/ui`                            | a11y gate for the form primitives (`test/form-a11y.test.tsx`)                                                   | installed (`^0.1.0`) — dev-only, brings `axe-core`. Its `toHaveNoViolations` matcher has no working Vitest 3 type augmentation, so the suite asserts on `results.violations`; `color-contrast` is off in jsdom (`test/mocks/axe-options.mock.ts`) because jsdom has no canvas |
| `jest`, `ts-jest`, `@types/jest`                                                                        | `packages/shared`, `packages/api-client` | framework-free package tests (D13)                                                                              | installed                                                                                                                                                                                                                                                                     |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@eslint/js`                                | `apps/admin`                             | lint harness                                                                                                    | installed                                                                                                                                                                                                                                                                     |
| `react-hook-form`                                                                                       | `apps/admin`                             | form-state bucket (`ApiKeyForm`)                                                                                | installed (`^7.54.2`, resolved 7.90.0)                                                                                                                                                                                                                                        |
| `zod` (direct dependency)                                                                               | `apps/admin`                             | form schema validation                                                                                          | installed (`^3.24.1`, resolved 3.25.76) — **pinned to v3** so `zodResolver` accepts the zod-3 schema objects from `@callback/shared` (D30). A second zod (4.x) exists only for `knip`; see the `packageExtensions` note below §7.                                             |
| `@hookform/resolvers`                                                                                   | `apps/admin`                             | `zodResolver` for react-hook-form                                                                               | installed (`^3.9.1`, resolved 3.10.0) — the v3 line, matching zod v3. It declares `zod` as a **peer only**, so `pnpm-workspace.yaml > packageExtensions` injects a real zod 3 dependency; without that, its `.d.ts` resolved knip's zod 4 and `apps/admin`'s `tsc` failed.    |
| `zustand`                                                                                               | `apps/admin`                             | page-local stores, global session store                                                                         | **planned — added with the first page that needs UI state** (`/api-keys` has none, D9)                                                                                                                                                                                        |
| `@callback/notifications`                                                                               | `packages/notifications`, `apps/admin`   | notification + log store, framework-free (AIS-79) + React bindings on `./react` (AIS-83), consumed by the admin capture (AIS-84) | **core + React bindings installed, consumed by `apps/admin`** — `react`/`react-dom` are **peer** dependencies, `@callback/ui` is a dependency, `@testing-library/*` and `jsdom` are dev-only. The root export stays React-free; `build` runs `tsconfig.core.json` (no DOM) first, then `tsconfig.json` (DOM + JSX), so a DOM reference in `src/core` cannot compile. The admin app imports both the core (`createNotificationStore`, `createNotificationStorage`) and `./react` (`NotificationProvider`, `NotificationHost`) |
| `dependency-cruiser`                                                                                    | repo root                                | layer gate: `app → pages → features → entities → services → lib` (§9.1)                                         | installed (`^16`) — dev-only, never shipped                                                                                                                                                                                                                                   |
| `knip`                                                                                                  | repo root                                | dead-code gate: unused files / exports / dependencies (§9.2)                                                    | installed (`^5`) — dev-only, `apps/api` deliberately out of scope (D8)                                                                                                                                                                                                        |

Adding a dependency requires updating this table in the same change. Rows marked
_planned_ must not be read as available. The `zustand` row's decision was **closed in AIS-130**: it
stays _planned_ because no page has transient UI state yet; the page that first needs one installs it,
flips this row to `installed` and ships the store test in the same change (§5, rule §6.4).

**Two zod instances, on purpose (AIS-113 build fix).** `@hookform/resolvers` declares `zod` as a
_peer_ and imports it by bare specifier, while `knip` (dev-only, repo root) depends on zod **4**.
pnpm hoists knip's copy into `node_modules/.pnpm/node_modules/zod`, so the resolver's
`T extends z.Schema<any, any>` type resolved to zod 4's `$ZodType` and `apps/admin`'s `tsc` failed
("missing `def`, `type`, `toJSONSchema`, `check`") although the runtime was fine. The fix lives in
[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:1) → `packageExtensions`:
`@hookform/resolvers` now gets a real `zod: ^3.24.1` dependency, so it type-checks against the same
zod 3 instance the app uses. Do **not** replace it with an `overrides: zod: 3.x` entry — forcing a
single version breaks knip with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**AIS-116 added no dependency at all** (decision **Út A**): the data-display primitives compose the
existing `Table*` components instead of adopting `@tanstack/react-table`, because both the sorting
and the paging are **server-side** (`sort`/`order`/`page` are query fields) and the API caps a page
at 100 rows — a client-side sorting engine and virtualisation would be dead code plus a second
table implementation to migrate. `packages/ui/package.json` is unchanged.

**AIS-117 added the first runtime dependencies of `packages/ui`** — behaviour-only Radix
packages, all three in `dependencies` (`react`/`react-dom` remain `peerDependencies`):

| Dependency                      | Where         | Why                                                                | State     |
| ------------------------------- | ------------- | ------------------------------------------------------------------ | --------- |
| `@radix-ui/react-dialog`        | `packages/ui` | focus trap, `Esc`, outside dismiss, portal, focus restoration      | installed |
| `@radix-ui/react-dropdown-menu` | `packages/ui` | roving focus, typeahead, `Esc`, menu roles for the row-action menu | installed |
| `@radix-ui/react-tooltip`       | `packages/ui` | hover/focus timing, `aria-describedby` wiring, placement           | installed |

`@radix-ui/react-popover` is deliberately **absent** (**D3**): the `Drawer` is modal, so it is
built on `@radix-ui/react-dialog` with a `side` variant. Measured effect on
`apps/admin` at the time of writing: **0 bytes** — nothing imports the overlays yet, so Rollup
tree-shakes them out of `dist/assets/index-*.js` (`grep radix` on the output: 0 hits). The real
delta will be measured in **AIS-22**, the first consumer.

## 8. Verification commands

```bash
# framework-free packages (jest)
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test

# React side (vitest)
pnpm --filter @callback/ui test
pnpm --filter @callback/ui build      # tsc type check only
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build

# coverage for SonarQube (writes coverage/ui|admin/lcov.info)
pnpm --filter @callback/ui test:cov
pnpm --filter @callback/admin test:cov

# everything, from the repo root
pnpm test
```

`pnpm --filter @callback/admin build` is also the check that the Tailwind
`@source` registration works: the emitted `dist/assets/*.css` must contain the
token utilities (`shadow-neu-raised`, `bg-primary`, `rounded-control`, …).

### 8.1 SPA deep link through the dev proxy

Every client-side route must survive a **direct load**, because a user can paste or reload
`http://localhost:5174/<route>`. The trap is the dev proxy: a plain `'/api'` key in
`apps/admin/vite.config.ts` is a _prefix_ match, so it also captures SPA routes that merely
start with `/api` — `/api-keys` was forwarded to the NestJS API, which answered
`{"message":"Cannot GET /api-keys","statusCode":404}`. The proxy key is therefore the regex
**`'^/api/'`** (see the comment in the config); the same applies to `apps/web`.

```bash
# deep link must be the SPA shell, not JSON
curl -s -o NUL -w "%{http_code} %{content_type}\n" http://localhost:5174/api-keys
#   expect: 200 text/html

# the actual API call must still be proxied
curl -s -o NUL -w "%{http_code} %{content_type}\n" http://localhost:5174/api/api-keys
#   expect: 200 application/json
```

Invariant: **no SPA route may collide with the API base path prefix.** Production is safe by
construction (Caddy `handle /api/*`, nginx `try_files … /index.html`), only the Vite dev server
needs the regex.
The palette check in §3.3 is part of the definition of done as well.

## 9. CI quality gates (AIS-122)

The rules in `.roo/rules/react.coding-standards.md` are **machine-enforced**. Five static gates
run in the `quality-gates` CI job (`.github/workflows/ci.yml`), one step per gate, so the red step
names the failing rule. A sixth machine check, `pnpm typecheck`, guards the types themselves and
runs in `build-test` (§9.5). Locally the five gates are one command:

```bash
pnpm quality          # layers → dead code → tokens → field errors → docs
pnpm test:quality     # the gates' own tests (negative + positive fixtures)
```

Nothing here builds or runs tests: every gate is a static file walk plus one
`dependency-cruiser` run, which is why the whole job reports in about a minute.

The **whole definition of done in one command** — the same set the CI runs across its jobs,
sequenced fast-gates-first so a cheap rule violation fails before a five-minute test run:

```bash
pnpm qa:all   # quality → test:quality → sonar:test → test:agents → build → lint → test
```

It is the command to run before pushing a branch; it is deliberately _not_ wired into
`prepare`/`pre-commit`, because it takes minutes (the git-hook plan covers the fast subset).

| Command                     | Enforces                                                                                                                  | Scope                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `pnpm quality:layers`       | `app → pages → features → entities → services → lib`; no page→page, no feature→feature (shared infra excepted), no cycles | `apps/admin/src` (the only app with layers)            |
| `pnpm quality:dead-code`    | no unused file, export, exported type or dependency                                                                       | `apps/{admin,web}` + `packages/{ui,api-client,shared}` |
| `pnpm quality:tokens`       | no colour literal, no Tailwind palette utility, no arbitrary colour value                                                 | `apps/*/src` **and** `packages/ui/src`                 |
| `pnpm quality:field-errors` | no `error.status ===` / `error.code ===` / `instanceof ApiError` outside a pure decision function                         | `apps/*/src`                                           |
| `pnpm quality:docs`         | every relative link resolves, every `§N` reference exists, every `docs/Specs` doc carries a valid `**Utolsó frissítés:**`, and every pointer source links [`New-Admin-Page.md`](./New-Admin-Page.md) | `docs/Specs` (minus `outdated/`) + the pointer sources |

### 9.1 Layer gate (`dependency-cruiser`)

The rules live in **one module**, `.dependency-cruiser.rules.cjs`, imported by two configs so
"the gate" and "the proof of the gate" cannot drift:

| Config                             | Target                                                |
| ---------------------------------- | ----------------------------------------------------- |
| `.dependency-cruiser.cjs`          | `apps/admin/src` (the real tree)                      |
| `.dependency-cruiser.fixtures.cjs` | `scripts/quality/fixtures/layers/{negative,positive}` |

Element patterns are written **location-agnostically** (`(?:^|/)src/pages/([^/]+)/`), which is
what lets one rules module match both the real tree and a fixture tree.

The only legal cross-feature edges are the **shared infrastructure features**, defined once
as `SHARED_FEATURES` in the rules module: `features/api`, `features/error-surface` and
`features/forms`. A page may import its own feature plus these; a feature may import its own
modules plus these. Everything else still trips `no-feature-to-feature` or
`no-feature-to-higher-layer`.

`features/forms` joined the list with the AIS-131 fix: `useAppForm` is the one form pattern
every page composes (AIS-115), it is a hook and therefore cannot live in `lib` (React + RHF), and
re-implementing it per page is exactly what AIS-115 removed. The AIS-131 slice was the first
cross-page consumer (`pages/api-keys/ui/ApiKeyEditForm.tsx`) and the gate was right to complain —
the missing piece was the allow-list entry, not the import.

Documented grandfathers — visible in the module with a one-line reason each:

| Edge                                  | Why                                                          | Removed by                       |
| ------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `components → features/error-surface` | `AppErrorBanner` is a deliberate thin container (AIS-96)     | AIS-96 follow-up                 |
| `auth` as its own element             | three files import it legitimately; it ranks with `services` | AIS-74 (`auth/` → `app/session`) |

The repo imports its own modules with **explicit `.js` specifiers**; `dependency-cruiser` resolves
them to `.ts`/`.tsx` natively through `enhancedResolveOptions.extensions`. Two options are absent
on purpose: `extensionAlias` (not in its config schema — it rejects the whole config) and
`tsConfig` (neither `apps/admin/tsconfig.json` nor its base declares `paths`/`baseUrl`, and an
`extends`-ing config is resolved from the cwd, which produced `TS5083`/`TS18003`).

### 9.2 Dead-code gate (`knip`)

`knip.json` configures five workspaces and one **exclusion**:

| Entry                                             | Reason                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ignoreWorkspaces: ["apps/api"]`                  | Nest DI resolves providers at runtime and `apps/api/drizzle/**` is generated — triaging those false positives is its own ticket. A gate that cries wolf gets switched off. |
| `entry: scripts/lib/agent-artifacts/generate.mjs` | The CLI is invoked from `scripts/init.sh` / `init.ps1`, which `knip` cannot see.                                                                                           |
| `ignoreDependencies: ["tailwindcss"]`             | Used only from CSS (`@import "tailwindcss"`), never imported from TypeScript.                                                                                              |
| `ignoreExportsUsedInFile: true`                   | Mock helpers and constants are exported for readability but used in their own file; a real orphan is still reported as an unused **file**.                                 |

Triage happened in the same change: the orphan barrel `packages/shared/src/contract/index.ts` was
deleted (it duplicated `packages/shared/src/index.ts`), and the `DEFAULT_EMIT` duplicate alias in
`scripts/lib/agent-artifacts/overrides.mjs` was replaced by `EMITTABLE` at its single call site.

### 9.3 Token gate and field-error gate

Both are dependency-free Node ESM scripts in `scripts/quality/`, sharing a posix-path walker
(`walk-sources.mjs`) and one reporter (`report.mjs`, printing `file:line: [rule] snippet`).

- **Token gate**: three rules — colour literal (`#…`, `rgb(`, `hsl(`, `oklch(`, …), Tailwind
  palette utility (incl. `text-white` / `bg-black` and `/50` modifiers), arbitrary colour value.
  The **only** exemption is `packages/ui/src/styles/theme.css` from the literal rule (it _is_ the
  palette); a palette utility inside that file still fails.
- **Field-error gate**: the allowlist _is_ the rule — `apps/*/src/lib/error-surface.logic.ts`,
  `apps/*/src/lib/error-message.ts` and `apps/*/src/**/*.logic.ts`. Test code
  (`*.test.ts(x)`, `apps/*/src/test/**`) is out of scope, and exclusion wins over the allowlist.
  Since AIS-111 the decision functions are `error-surface.logic.ts`, `error-message.ts` and
  `field-errors.logic.ts`; the catalogue (`api-error-code.const.ts`) holds data only, so it
  needs no allowlist entry.

### 9.4 The proof (negative fixtures)

Every gate is proven to **fire**, not just to be green — a gate that cannot fail is not a gate:

| Gate         | Negative fixture                                                                                                             | Positive fixture                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Layers       | `fixtures/layers/negative` → exit ≠ 0 and names `no-page-to-page`, `no-feature-to-feature`, `no-lib-to-higher-layer`         | `fixtures/layers/positive` → exit 0 (`no-page-to-foreign-feature` proves a page may import its _own_ feature)                |
| Dead code    | (no fixture: `knip` is a tool, the gate is its exit code)                                                                    | —                                                                                                                            |
| Tokens       | `fixtures/palette/negative` (a `bg-slate-800` + `text-white/80` + `bg-[#101010]` component, a `#101010`/`rgb(…)` stylesheet) | `fixtures/palette/positive` (token classes, `grid-cols-[2fr_1fr]`, `#main`)                                                  |
| Field errors | `fixtures/field-errors/negative` (a component and a hook branching on `status` / `code` / `instanceof ApiError`)             | `fixtures/field-errors/positive` (the allowlisted decision file, a clean component, a `*.test.tsx` asserting on error shape) |

**The one accepted deviation (decision D4 of the AIS-122 plan):** `knip` has no fixture pair. It is
a third-party tool and the gate _is_ its exit code, so a synthetic dead-code tree would test `knip`,
not our own rule. The "a gate that cannot fail is not a gate" requirement is met by the other three
gates, each proven red on a real violation **and** green on a legal edge.

`pnpm test:quality` runs both directions plus unit tests for the walker, the reporter and each rule
(`*.test.mjs` next to the code, `node --test`). The positive fixture deliberately contains a
`features/alpha → features/api` edge, so the shared-feature exception is proven by the same test
that proves the gate is red on a real violation.

### 9.5 `pnpm typecheck` and the required checks

Added in the 2026-11-04 close-out. `pnpm typecheck` is a machine check but **not** one of the four
gates: it runs in `build-test`, immediately after "Build shared".

```json
"typecheck": "pnpm --filter @callback/shared build && pnpm -r typecheck"
```

`@callback/shared` is built first because it and `@callback/api-client` are consumed through
`dist/*.d.ts`, and `tsc --noEmit` emits none — a fresh clone would otherwise fail on unresolved
types. Every workspace owns its own `typecheck` script, since `pnpm -r` fails outright when a
selected workspace has none:

| Workspace             | Script                                | Scope               |
| --------------------- | ------------------------------------- | ------------------- |
| `packages/shared`     | `tsc --noEmit -p tsconfig.json`       | src + test          |
| `packages/api-client` | `tsc --noEmit -p tsconfig.json`       | src + test          |
| `packages/ui`         | `tsc --noEmit -p tsconfig.json`       | src + test          |
| `apps/admin`          | `tsc --noEmit -p tsconfig.json`       | src + test          |
| `apps/web`            | `tsc --noEmit -p tsconfig.json`       | src                 |
| `apps/api`            | `tsc --noEmit -p tsconfig.build.json` | **production only** |

**Known gap — tracked, not silenced.** `apps/api` checks `tsconfig.build.json`, the same file
`nest build` compiles with, which excludes `**/*spec.ts` and `test/**`. Running it against
`tsconfig.json` surfaces **20 pre-existing errors in 6 files**: a missing `deletedAt` in
`test/envelope-contract.e2e-spec.ts`, unchecked `document.paths` in `openapi.registry.spec.ts`,
`precision` assertions on a Drizzle `PgColumn` that does not expose them, and two overlapping casts
in `test/lib/envelope.matchers.ts`. `nest build` never type-checked those files, so CI never saw
them. They are tracked in **AIS-128**; until they are fixed the check covers the production scope
exactly — no more and no less.

The negative proof for this check: introduce a deliberate type error in any `src/**/*.ts` file —
`pnpm typecheck` exits non-zero with the `TS####` code and the file:line.

#### 9.5.1 Required status checks

The gates only prevent a merge once the job is **required**. That is a repository setting, not
repository code — `ci.yml` cannot express it. Require these three job names (`name:` of each job,
verbatim, including the punctuation):

- `Install, build, lint, unit test` — the `build-test` job, which now runs `pnpm typecheck`
- `Quality gates (layers, dead code, tokens, field errors)` — the `quality-gates` job
- `API e2e (envelope + OpenAPI gates, Postgres)` — the `api-e2e` job

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=Install, build, lint, unit test' \
  -F 'required_status_checks.contexts[]=Quality gates (layers, dead code, tokens, field errors)' \
  -F 'required_status_checks.contexts[]=API e2e (envelope + OpenAPI gates, Postgres)' \
  -F enforce_admins=true \
  -F 'required_pull_request_reviews.required_approving_review_count=0' \
  -F restrictions=
```

Repeat the same call with `dev`. If the repository uses **rulesets** instead of branch protection,
the manual path is _Settings → Rules → Rulesets → New branch ruleset → Require status checks to
pass → add the three names above_.

**Prove the requirement once per branch:** open a throwaway PR that adds `bg-slate-800` to any
`apps/admin/src` component. `quality-gates` must go red on the token step **and** the merge button
must be disabled; removing the class turns it green again. A required check that never fails is
indistinguishable from no check at all.
