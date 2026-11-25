# Customers admin screens — screen contract (list, detail, wizard, edit)

**Utolsó frissítés: 2026-11-25** (AIS-179: a cég adatlap **Kapcsolattartók** és **Felhasználók** füle —
a detail payloadból olvasva, lapozó és URL-listaállapot nélkül (`D-W3`), négy route-alapú overlay
(`/contacts/new`, `/contacts/:contactId/edit`, `/users/invite`, `/users/:userId/edit`), a
`CUSTOMER_PRIMARY_CONTACT_CONFLICT` / `CUSTOMER_USER_EMAIL_CONFLICT` / `CUSTOMER_OWNER_CONFLICT` kódok a
megfelelő vezérlőre irányítva, a meghívó visszavonása pedig **csak** `invited` soron — leszállítva; a
címke-chip sáv továbbra is az [AIS-193](https://zakzag.atlassian.net/browse/AIS-193) ticketé. Előző, 2026-11-25 — AIS-21: a cég **szerkesztő oldala** — `/customers/:id/edit` testvér
útvonal, `useAppForm` a szerződésből származtatott sémával, négy `FormSection`, mezőnkénti hibák a
`details[].path`-ból, a `409 STALE_WRITE` oldalszintű figyelmeztetés újratöltés gombbal, valamint a
detail fejléc írási műveletei (*Szerkesztés*, *Státusz váltása*, *Archiválás*) — leszállítva; a
**címke-chip sáv külön follow-up ticketre** került. Előző, 2026-11-25 — AIS-20: a cég **adatlap** váza — fejléc + `StatusBadge`, hat fül
`?tab=`-bal az URL-ben, `Áttekintés` és `Cégadatok` tartalommal, öt felület (loading / `404` /
`banner`-tier / hiba / siker) — leszállítva; a négy későbbi fül panelje a
`ui/customer-tab-panels.tsx` totális `Record`-jában már helyet kapott, a §10 fájltérkép ✅ jelölése ezt
rögzíti. Előző, 2026-11-25 — AIS-19: a lista oldal, a varázsló shellje, a page store és a
`use-tab-param` olvasó leszállítva; a lista szűrősora a három szerződéses szűrőt és a `q`-t viszi, a
sor-műveletek a `DropdownMenu`-ben élnek. Előző,
2026-11-24 — AIS-17 hullám-delta: a hullám hat döntése (`D-W1`–`D-W6`) átvezetve —
a felelős operátor fogalma teljesen megszűnt (DB-oszlop, szerződés, szűrő — 2026-11-24), a kapcsolattartók és a felhasználók a detail payloadból olvasnak
lapozó és URL-listaállapot nélkül (`D-W3`), a címkék chip-műveletek (`D-W1`), az aktivitás szerkesztése/törlése
`authorType === 'operator'` sorokra korlátozott (`D-W4`), a varázsló csak a céget hozza létre (`D-W6`); a
mezőkészletet az AIS-16 adta, a felületet az AIS-19 / AIS-20 / AIS-21 / AIS-179 / AIS-181 / AIS-182 építi; terv:
[`2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md`](../plans/2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md:1))
**Status:** living document — the current contract, not a snapshot
**Owner:** AIS-17 (parent story: AIS-15 `Admin - cég felület`)
**Contract source:** [`customers.schema.ts`](../../packages/shared/src/contract/customers/customers.schema.ts:1),
[`customers.list-query.ts`](../../packages/shared/src/contract/customers/customers.list-query.ts:1),
[`customers.enums.ts`](../../packages/shared/src/contract/customers/customers.enums.ts:1)
**Process owner:** [`New-Admin-Page.md`](New-Admin-Page.md) — when this file and that checklist disagree
about _which files to create and in what order_, the checklist wins. This file wins for **what the
customers screens contain**.

---

## 0. What this document is, and the one principle it repeats

AIS-17 asks for a **screen design built from existing primitives**, not for new markup. Two
consequences run through every section below:

1. **No new visual concept.** Every element is a `packages/ui` primitive or an admin pattern that
   already exists. `packages/ui` changes in this increment: **none**.
2. **No second source of truth.** Field names, limits, enum values and formats come from the AIS-16
   contract; column lists, tab names and copy come from this file; the state buckets come from
   [`UI-Architecture.md`](UI-Architecture.md) §5.

Anything the mockup (`docs/temp/12_ugyfelek_admin_mockup.html`, a local scratch file that is **not**
in git — hence not a link) shows that the contract does not carry is listed in §7 and is **not** part
of this screen family.

---

## 1. Routes and the URL contract

All four screens live in one page folder, `apps/admin/src/pages/customers/`. Paths follow the
"one literal, N consumers" rule of [`New-Admin-Page.md`](New-Admin-Page.md) §2: the list path lives in
[`app.const.ts`](../../apps/admin/src/app/app.const.ts:1) because the nav and the breadcrumb read it;
every page-owned path lives in `pages/customers/customers.const.ts` because `pages/` may not import
`app/`.

| Route | Element | Registry placement | Path constant |
| --- | --- | --- | --- |
| `/customers` | `CustomersPage.tsx` (composition) | protected entry, **with** `navLabel` | `APP_ROUTE_CUSTOMERS_PATH` |
| `/customers/new` | `CustomerCreatePage.tsx` (the wizard) | protected **sibling** entry, `navLabel: null`, `breadcrumbParentPath: '/customers'` | `CUSTOMERS_CREATE_ROUTE_PATH` |
| `/customers/:id` | `CustomerDetailPage.tsx` | protected **sibling** entry, `navLabel: null`, `breadcrumbLabel: null`, `resolveBreadcrumbLabel: (params) => params.id`, **children** (see below) | `CUSTOMER_DETAIL_ROUTE_PATH` |
| `/customers/:id/edit` | `CustomerEditPage.tsx` | protected **sibling** entry, `breadcrumbParentPath: '/customers'`, `resolveBreadcrumbLabel: (params) => params.id` | `CUSTOMER_EDIT_ROUTE_PATH` |
| `/customers/:id/contacts/new` | `ui/ContactCreateDialog.tsx` | `children` of the detail entry, `navLabel: null` | `CUSTOMER_CONTACT_CREATE_ROUTE_PATH` |
| `/customers/:id/contacts/:contactId/edit` | `ui/ContactEditDialog.tsx` | `children` of the detail entry, `navLabel: null` | `CUSTOMER_CONTACT_EDIT_ROUTE_PATH` |
| `/customers/:id/users/invite` | `ui/CustomerUserInviteDialog.tsx` | `children` of the detail entry, `navLabel: null` | `CUSTOMER_USER_INVITE_ROUTE_PATH` |
| archive confirmation | `ConfirmDialog` inside the row menu / detail header | **no route** (AIS-173 exception: a confirmation has no address) | — |

**Why the detail and the edit are siblings and not children of the list (D14).** In `api-keys` the
detail and the edit render **into** the list page's `<Outlet/>`, because they are dialogs over the
list. The customer detail is a page with six tabs and two of them carry their own tables; the edit
carries a four-section form. Both replace the list rather than float above it, so they are separate
registry entries and the list is not mounted behind them. Their breadcrumb parent is the list — the
same choice `api-keys` makes for `/api-keys/:identifier/edit`, so no new breadcrumb capability is
needed. The **contact and user surfaces stay overlays** (`EntityDialog`) and therefore nested children
of the detail entry, which is why `CustomerDetailPage` renders an `<Outlet/>`.

**URL parameters.**

| Parameter | Route | Values | Default | Invalid value | Owner |
| --- | --- | --- | --- | --- | --- |
| `page`, `limit`, `sort`, `order`, `q`, `type`, `status`, `source` | `/customers` | the shared list-query contract | contract defaults | falls back to the default, never throws | [`use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:1) + `customerListQuerySchema` |
| `tab` | `/customers/:id` | `overview` \| `data` \| `contacts` \| `users` \| `activity` \| `audit` | `overview` | falls back to `overview` | `features/api/use-tab-param.ts` — **created by AIS-19** (first consumer `?step=`), reused here from AIS-20 |
| `step` | `/customers/new` | `1` … `4` | `1` | falls back to `1` | `features/api/use-tab-param.ts` (new, AIS-19) |

`tab` and `step` are **not** list-query fields, and a component never reads `searchParams` itself
([`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1) §6.2). They get one
generic, tested reader: `features/api/use-tab-param.logic.ts` (`parseAllowedValue(value, allowed, fallback)`)
plus `use-tab-param.ts`, whose first consumer is `/customers` — `useListParams` stays untouched.

---

## 2. The list screen (`/customers`, AIS-19)

### 2.1 Elements and their primitives

| Element | Primitive / pattern |
| --- | --- |
| Page frame (single `h1`, subtitle, header action) | `PageShell` (`title`, `subtitle`, `actions`) |
| Header action „Új cég” | `Link` + `buttonVariants()` (a navigation, not a `Button` — [`UI-Architecture.md`](UI-Architecture.md) §4.0) + `PlusIcon` |
| Filters: free-text search | `Input` inside `FormField` (`type="search"`), debounced, writes `q` |
| Filters: type, status, source | `Select` inside `FormField`, one URL write per change |
| Filter reset | `Button` `variant="ghost"` — writes the schema defaults in **one** `setParams` call |
| Table | `DataTable` (`columns`, `sort`, `onSortChange`, `isLoading`, `rowActions`, `caption`) with `aria-sort` |
| Row name link | `Link` to `/customers/:id` (the row's name is the navigation, not a button) |
| Row menu (D3) | `DropdownMenu` (`rowActions`): *Megnyitás*, *Szerkesztés*, *Archiválás* |
| Archive confirmation | `ConfirmDialog` — open flag is local `useState` (AIS-173 exception) |
| Pager | `Pagination` (`meta.pagination`, `limitOptions`) |
| Loading | `DataTable` skeleton rows + `sr-only` loading sentence — **never** a spinner |
| Empty | `EmptyState` with title, description and a CTA (D4 + the `D8` exception) |
| Page error | [`PageErrorState`](../../apps/admin/src/components/error/PageErrorState.tsx:1) + retry, only when `errorSurface === 'page'` |
| Banner-tier failures (offline, `401`, `503`) | nothing on the page — the layout's `AppErrorBanner` already speaks |

### 2.2 Columns

Order is fixed; the contract column is named so a rename breaks the build.

| # | Header copy | Contract field | Render rule | Sortable |
| --- | --- | --- | --- | --- |
| 1 | Ügyfélszám | `customerNumber` | `font-mono` (`AIS-YYYYMM-NNN`) | yes |
| 2 | Név | `shortName ?? legalName` | the mapper picks the display name **once** | yes (both columns) |
| 3 | Típus | `type` | enum label from `entities/customer/customer.const.ts` | no |
| 4 | Adószám | `taxNumber` | `null` → „—” **and** the row shows the missing-data marker | no |
| 5 | Státusz | `status` | `StatusBadge` with the `D10` mapping | yes |
| 6 | Elsődleges kapcsolattartó | `primaryContactName` (derived, **D9**) | `null` → „Nincs” + missing-data marker | no |
| 7 | Utolsó aktivitás | `lastActivityAt` | [`lib/date.ts`](../../apps/admin/src/lib/date.ts:1) formatting, `null` → „—” | yes |
| 8 | Hiányos adat | `hasMissingData` | `Badge variant="warning"` with an `aria-label`, never colour alone | no |

`hasMissingData` is derived (tax number or registered postal code missing). It is never computed in
JSX: the row mapper reads the flag the API returns.

### 2.3 Query, filters, sort

- Three contractual filters — `type`, `status`, `source` — plus the free-text `q`, and there is **no fourth**:
  the responsible-operator filter was removed together with its column and its contract field (2026-11-24), so
  the list URL carries exactly these four values beside paging and sorting.
- One `useListParams(customerListQuerySchema)` call; `params` is both the request and the query key.
- Search is **server-side** (`q` over name, tax number, customer number — D2). Filtering the current
  page would contradict `meta.total`.
- Sort is intent-only: `DataTable` reports `{ column, direction }`, the page writes `sort` + `order`
  in **one** `setParams` call and resets `page` to `1`.
- Query keys come from `createEntityQueryKeys<CustomerListQuery>('customers')` — never a handwritten
  array.
- Page sizes: `LIST_QUERY_DEFAULT_LIMIT`, `50`, `LIST_QUERY_MAX_LIMIT` (injected by the page, exactly as
  `api-keys.const.ts` does).

### 2.4 The four states

| State | What the user sees |
| --- | --- |
| Loading | Header and filters stay interactive; the table keeps its header and shows skeleton rows; one `sr-only` sentence announces the load |
| Empty | `EmptyState`: title „Nincs megjeleníthető cég”, description differs for "no rows at all" vs "no rows for this filter", CTA „Új cég” |
| Error | `PageErrorState` + retry when the failure is `page`-tier; the retry is the same `refetch`; no toast from the page (the capture owns write failures, the banner owns global ones) |
| Success | Table + pager; the pager renders only when `meta !== null` |

---

## 3. The detail screen (`/customers/:id`, AIS-20 / AIS-179 / AIS-181)

Server state: `useApiDetail` with the `id` from the URL (D6) — never the list cache. The detail
response already carries `tags`, `contacts`, `customerUsers`; `activity` and `audit` are separate
list endpoints (`customers.listActivities`, `customers.listAuditLogs`).

### 3.1 Common chrome

| Element | Primitive |
| --- | --- |
| Frame + back link to the list | `PageShell` (`back` slot gets the `Link` from the page const) |
| Title | `shortName ?? legalName` + `customerNumber` in the subtitle |
| Header actions | `Link` + `buttonVariants()` (*Szerkesztés*), `DropdownMenu` (*Státusz váltása*, *Archiválás*) |
| Status | `StatusBadge` (D10) |
| Tabs | `Button` `variant="ghost"` / `primary` inside a labelled `<nav>`; **no new primitives package** — the tab strip is a page part in `ui/CustomerTabs.tsx`, the state is `?tab=` |
| Loading | `Skeleton` for the header + `DescriptionList isLoading` / `DataTable isLoading` per tab |
| Unknown id (`404`) | its own copy: „Ez a cég nem található.” + back link — **not** a generic error |
| Error | `PageErrorState` + retry |

The tab strip is the one element with no existing primitive. It stays a **page part** (not
`packages/ui`) until a second page needs tabs; promoting it is a separate ticket.

### 3.2 Tabs

| Tab (`?tab=`) | Elements | Primitives |
| --- | --- | --- |
| `overview` — Áttekintés | status + `statusChangedAt`, primary contact, last activity, missing-data notice | `StatusBadge`, `DescriptionList`, `Alert` (`warning`) |
| `data` — Cégadatok | key–value groups: azonosítók / jogi adatok / cím / egyéb | `Card` per group + `DescriptionList` (`columns: 2`) — **D12** |
| `contacts` — Kapcsolattartók | list + create/edit/delete, roles as badges, "belépő" marker when `customerUserId !== null`. The list is read from the **detail payload** (`D-W3`): **no pager, no URL list state** — **delivered by AIS-179** | `DataTable` (no `Pagination`) + `EntityDialog` (children routes), `StatusBadge`, `ConfirmDialog` |
| `users` — Felhasználók | list + invite; role/status per row, revoke **only** on an `invited` row. Also read from the **detail payload** (`D-W3`): **no pager, no URL list state** — the contract has no `listCustomerUsers` operation; **delivered by AIS-179** | `DataTable` (no `Pagination`) + `EntityDialog` (invite + edit), `StatusBadge` |
| `activity` — Tevékenység | feed (newest first) + „Megjegyzés írása” form. Edit/delete render **only** on rows where `authorType === 'operator'` (`D-W4`, a client-side rule until AIS-73/74 adds authentication) | `Card` list + `Textarea` + `Button` + `FormActions` in `useAppForm` |
| `audit` — Napló | read-only rows: `occurredAt`, `actorName`, `operation`, `tableName`; expandable diff | `DataTable` + the existing JSON logic of [`json.logic.ts`](../../packages/ui/src/lib/json.logic.ts:1) (`toPrettyJson`) — **no second renderer** |

### 3.3 The four states per tab

| Tab | Loading | Empty | Error | Success |
| --- | --- | --- | --- | --- |
| `overview` / `data` | `DescriptionList isLoading` (skeleton rows, no `dd`) | n/a — the detail always has a row | `PageErrorState` + retry (tier `page`) | the two lists |
| `contacts` | the **detail's own** loading state (`useApiDetail` in flight) — the tab has no list request of its own (`D-W3`), so there is no `DataTable isLoading` here | „Nincs kapcsolattartó” + CTA „Kapcsolattartó hozzáadása” | `PageErrorState` **inside the tab** + retry | table, no pager |
| `users` | the **detail's own** loading state, same reason (`D-W3`) | „Nincs belépő felhasználó” + CTA „Meghívás” | same | table, no pager |
| `activity` | skeleton cards | „Nincs rögzített tevékenység” + the note form | same | feed + the note form |
| `audit` | `DataTable isLoading` | „Nincs naplóbejegyzés” | same | table + JSON detail |

A nested tab error is **scoped to the tab**: it does not replace the whole page, because the other
tabs may be perfectly readable. That is the one place where `PageErrorState` is rendered inside a
region instead of at page level.

---

## 4. The create wizard (`/customers/new`, AIS-19)

### 4.1 Steps

| Step | Title | Fields (from `createCustomerSchema`) | Primitive |
| --- | --- | --- | --- |
| 1 | Típus | `type` (`company`, `sole_proprietor`, `organization`, `tax_number_individual`) | `RadioGroup` inside `FormField` |
| 2 | Név és adószám | `legalName` (required), `shortName`, `taxNumber`, `euVatNumber`, `companyRegistrationNumber`, `legalForm` | `Input`, `Select` (legal form) |
| 3 | Cím | `registeredAddressZip`, `registeredAddressCity`, `registeredAddressLine`, `registeredAddressCountry` (default `HU`) | `Input`, `Input`, `Input`, `Select` |
| 4 | Ellenőrzés | read-only summary of the draft + submit | `Card` + `DescriptionList`, `FormActions` |

- One `useAppForm` per step; the **wizard** owns the draft (see 4.2), the step owns its own fields.
- Step order and validity are pure: `customers-wizard.logic.ts` (`nextStep`, `previousStep`,
  `canLeaveStep(values, step)`), tested without React.
- Copy for the stepper lives in `customers.const.ts` (`CUSTOMERS_WIZARD_STEPS`), so the test asserts
  against the same constant the UI renders.
- „Mégse” closes to `/customers` (`navigate`, not `history.back()`), and it resets the store.

### 4.2 State ownership (D11 — confirmed: page-local Zustand store)

| Concern | Owner | Reason |
| --- | --- | --- |
| Which step is open | the **URL** (`?step=1..4`) | a reload, the back button and a copied link must land on the same step |
| The values carried between steps | `pages/customers/customers-wizard.store.ts` | react-hook-form seeds `defaultValues` **on mount only**; a per-step form cannot hand a value to the next step without a store |
| The current step's inputs | `useAppForm` | form state is always react-hook-form (`UI-Architecture.md` §4.4) |
| The submitted result | TanStack Query (`useApiMutation`) | server state never enters the store |

Store contract:

```ts
export interface CustomersWizardState {
  readonly draft: Partial<CreateCustomerInput>;
  readonly step: CustomerWizardStep;      // mirrored from the URL on mount, never the URL's owner
}
export interface CustomersWizardActions {
  setDraft: (patch: Partial<CreateCustomerInput>) => void;
  setStep: (step: CustomerWizardStep) => void;
  reset: () => void;
}
```

- Created once per mount by `CustomersWizardStoreProvider` inside the page folder; `useCustomersWizardStore(selector)`
  is the only read path. Nothing is exported outside `pages/customers/`.
- No `persist`: a half-filled draft must not survive a reload (it would resurrect a stale draft next
  to a fresh `?step=1`).
- `zustand` is installed by **AIS-19** in the same change; [`UI-Architecture.md`](UI-Architecture.md) §7's
  `zustand` row flips to `installed` and the store ships with tests (init → `setDraft` → `setStep` → `reset`).
- The store never holds a server payload and never mirrors `?step=` beyond the mount-time mirror.

### 4.3 The four states

| State | Behaviour |
| --- | --- |
| Loading | only while submitting: `FormActions isSubmitting` (button `isLoading` + cancel disabled) |
| Empty | n/a — there is no collection |
| Error | `field` tier → the input (through `toFieldErrors`); `page` tier → the form's residue `Alert` + the capture toast; `409` (duplicate tax number / customer number) → the field when it has a `fieldMessage`, otherwise the form `Alert` |
| Success | close to `/customers/:id` of the created row, toast, list invalidation through the mutation |

### 4.4 What the mockup shows and this screen does not

The mockup's wizard has **five** steps: `1 Típus`, `2 Adószám & név`, `3 Cím & számlázás`,
`4 Kapcsolattartó`, `5 Ellenőrzés`. Two changes are deliberate:

| Mockup step | Here | Why |
| --- | --- | --- |
| `3 Cím & számlázás` | `3 Cím` | Billing data does not exist in this increment (AIS-16 `D4`: no billing, no IBAN) |
| `4 Kapcsolattartó` | — (dropped) | A contact is its own entity with its own CRUD (AIS-16 `D5`, AIS-179); creating a customer and its contact in one form would need a transaction the API does not offer |
| `5 Ellenőrzés` | `4 Ellenőrzés` | kept, renumbered |

A third change is recorded by the wave (`D-W6`): **the wizard creates only the company**, with **one**
`POST /customers` request. AIS-182's description still says the wizard also creates the first contact; this
screen contract wins (§4.1, wave plan `Q-4`). On success the wizard navigates to
`/customers/:id?tab=contacts`, where the contact is added with its own dialog (`D-W3`, AIS-179) — the API
offers no customer+contact transaction, so a second create inside the wizard would only be able to leave a
half-created customer behind.

---

## 5. The edit surface (`/customers/:id/edit`, AIS-21)

| Element | Primitive / pattern |
| --- | --- |
| Form | `useAppForm` with `updateCustomerSchema` (partial `PATCH` + a **required** `updatedAt` token) |
| Fields | `FormSection` per group (Azonosítók / Jogi adatok / Cím / Besorolás) → `FormField` → `Input` / `Select` / `Combobox` |
| Tags (címkék) | **not** a form field (`D-W1`): `updateCustomerSchema` has no `tagIds`, so `PATCH` never carries tags. Tags are chip actions on the **Cégadatok** tab — `CustomerTagsCard` with *Új címke* (`createTag`, then `attachTag` when the catalogue id is known) and per-chip *Eltávolítás* (`detachTag`), each its own mutation invalidating the detail key |
| Buttons | `FormActions` (`submitLabel` „Mentés”, `cancelLabel` „Mégse”, `isSubmitting`) |
| Field error | `toFieldErrors` mapping, rendered on the field |
| Success | back to `/customers/:id`, toast, cache invalidation |
| `409 STALE_WRITE` | tier `page`: the capture toast is the single surface, the form stays open and **re-reads** the row (the cache invalidates only on success) — the `api-keys` precedent |
| Read before edit | the route element owns the read and its four states, and the form is keyed by `updatedAt` so a fresh read reaches the inputs |

Read-only-by-contract fields are **not** inputs: `customerNumber` (generated), `status`
(`PATCH /:id/status`, its own action), `createdAt`/`updatedAt` (server), `hasMissingData` (derived).

**Delivered by AIS-21 (2026-11-25), verified against the tree:** the page is
`pages/customers/CustomerEditPage.tsx` (read through `useCustomerDetail` + the **reused** pure
`toCustomerDetailState`, five surfaces: loading / `404` / banner-tier / error / success) and the form is
`pages/customers/ui/CustomerEditForm.tsx`, mounted **keyed by `updatedAt`** so a re-read reaches the
inputs through a remount. The derived schema, the record → values mapping, the payload builder and the
country list live in the pure `pages/customers/customer-edit.logic.ts`; the writes are
`use-update-customer.ts` and `use-update-customer-status.ts` in `features/customers/`. The header's
`ui/CustomerDetailHeaderActions.tsx` renders the edit link plus the action menu, and its two dialogs
(`CustomerStatusDialog`, the reused `ArchiveCustomerDialog`) are **non-navigable modals** whose open flag
is local `useState` — the AIS-173 exception, applied consistently to both items.

Two deviations from the wave plan are deliberate and recorded here: the submit body carries **every**
editable field plus `updatedAt` (not only the changed ones — the form shows the whole record, and the
server's audit writer keeps only the keys that changed), and the **tags chip bar belongs to a follow-up
ticket** (`createTag` / `detachTag` wiring is untouched; `attachTag` stays unused until a tag catalogue
read exists).

---

## 6. The state-plan row (goes into `UI-Architecture.md` §5)

| Page | Server state | Page UI state | Form state | Notes |
| --- | --- | --- | --- | --- |
| `pages/customers` (AIS-17, `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`) | `useApiList`/`useApiDetail`/`useApiMutation` in `features/customers`; query keys from `createEntityQueryKeys<CustomerListQuery>('customers')`; hooks expose `errorMessage` + `errorSurface` | **one page store**: `customers-wizard.store.ts` (draft + step mirror, `reset`), created per mount by the wizard's provider; the list, the detail and the edit get **no** store — their state is the URL (`page`/`limit`/`sort`/`order`/`q`/the three filters (type, status, source), `?tab=`, `?step=`); the **contacts and users tabs have no URL list state at all** (`D-W3`) | `useAppForm` + the shared schemas (`createCustomerSchema` per step, `updateCustomerSchema` with `updatedAt`); contact/user overlays and the note form use `useAppForm` too | First page with a page-local store → `zustand` installed here (§7 row flips). Overlay open state is the URL; the archive confirmation is the documented `useState` exception (AIS-173) |

---

## 7. Exclusions — what these screens deliberately do not show

| Mockup / expected element | Status | Owner |
| --- | --- | --- |
| Számlázási adatok, számlázási verziók | **not in this increment** — no billing data is stored (AIS-16 `D4`) | — |
| IBAN / bankszámla | **never stored** (AIS-16 `D4`) | — |
| Havi díj, modulok, előfizetések, usage | out of scope; no module/fee column in the list (AIS-17 `D1`) | AIS-176 |
| `note` field on the customer | there is no such field: every note is an `activity` with `type = 'note'` (AIS-16 `D9`) | — |
| Egyedi `timezone` / `locale` fields | not part of the contract (AIS-16 `D7`); display locale is the UI's | later decision |
| Anonymisation UI | the `anonymized` **status** is displayable, the anonymisation action is not part of these screens | not scheduled |
| Customer-facing (web) screens | different app | AIS-15 scope split |

A ticket that adds any of these rows changes the contract first (AIS-16 family), then this file.

---

## 8. Decision record

### 8.1 Inherited from AIS-17 (closed, copied verbatim)

| # | Decision |
| --- | --- |
| D1 | List columns: ügyfélszám, név (vagy rövid név), típus, adószám, státusz, elsődleges kapcsolattartó, utolsó aktivitás + hiányos adat jelzés. **Nincs** modul/díj oszlop. |
| D2 | Kereső: szerveroldali `q` (név, adószám, ügyfélszám). Aktuális oldalon szűrés félrevezető a `total` miatt. |
| D3 | Sor-akciók: `DropdownMenu` a sor végén (megnyitás, szerkesztés, archiválás soft delete-tel, megerősítéssel). |
| D4 | „Új cég” gomb a fejlécben **és** az `EmptyState`-ben, mindkettő ugyanarra a varázslóra mutat. |
| D5 | Két route: `/customers/:id?tab=…` és `/customers/:id/edit` — a felületnek saját címe van. |
| D6 | Az adatlap adatforrása `useApiDetail` az `id`-vel az URL-ből, nem a lista cache-éből. |

### 8.2 Resolved here

| # | Question | Decision |
| --- | --- | --- |
| **D7** | Which ticket closes the two AIS-174 gaps (search/filter UI, per-row action)? | **AIS-19, this page.** The contract exposes `q` + three filters (`type`, `status`, `source`), all of them implemented here; shipping half a list would create two implementations. `New-Admin-Page.md` §2 records the ownership. |
| **D8** | `EmptyState` with a CTA contradicts AIS-174 ("two competing create affordances"). | **Documented exception for `/customers`**, because AIS-17 `D4` requires the CTA. Recorded in `New-Admin-Page.md` §3; every other page keeps the rule. |
| **D9** | The list needs a primary contact the row contract does not carry. | **`customers` list projection gains `primaryContactName`** (derived: `contacts` where `roles` contains `primary`), documented beside `lastActivityAt` / `hasMissingData` as derived-not-stored. Owned by AIS-178. Fallback if rejected: drop column 6 and keep the data on the overview tab only. |
| **D10** | `status` → badge variant, 7 statuses into 5 variants. | `active`→`success`, `trial`→`info`, `registered`→`info`, `prospect`→`neutral`, `suspended`→`warning`, `churned`→`danger`, `anonymized`→`neutral` + label „Anonimizált”. Lives in `entities/customer/customer.mapper.ts`, table-tested. |
| **D11** | Wizard state. | **Page-local Zustand store** for the draft (the step lives in the URL). `zustand` installed by AIS-19, `UI-Architecture.md` §7 row flipped in the same change. Contract in §4.2. |
| **D12** | How is the „Cégadatok” tab grouped? | `Card` per group + `DescriptionList` (`columns: 2`). `FormSection` is a `<fieldset>` for controls; the tab is read-only. |
| **D13** | Where does this contract live? | This file — a living spec, linked from `UI-Architecture.md` §5 and from the feature row of `Functional-Specification.md`. |
| **D14** | Detail and edit: overlay or page? | **Pages**, declared as **sibling** registry entries (not children of the list), because they replace the list instead of floating above it; the contact/user surfaces remain overlays and stay children of the detail. Breadcrumb parent is the list, exactly as `api-keys` does for its edit overlay. |
| **D15** | Where does the status change live? | A `DropdownMenu` action on the detail header writes through `PATCH /:id/status`; it is **not** a field of the edit form (the contract has a separate operation for it, and `statusChangedAt` is service-owned). |
| **D16** | Tab strip: new primitive or page part? | **Page part** (`pages/customers/ui/CustomerTabs.tsx`) until a second page needs tabs; promoting it is a separate ticket, so `packages/ui` stays untouched here. |

---

## 9. Test matrix per view

Each successor ticket copies its own row into its DoD. Tests never hit the network: the service
layer is mocked, doubles live in `apps/admin/src/test/mocks/`.

| View | Mandatory coverage |
| --- | --- |
| List | column mapping incl. `shortName ?? legalName` and the `null` renderers; `status` → badge variant (all 7); every filter writes the URL once; sort writes `sort`+`order` together and resets `page`; loading / empty / empty-with-filter / error / success; row menu actions render; archive confirmation opens, confirms, cancels; retry calls `refetch` |
| Detail | tab parsing (valid, missing, invalid → `overview`); tab switch writes the URL once; `404` copy; per-tab loading/empty/error; contacts "belépő" marker; audit row expands to pretty JSON; `StatusBadge` mapping reused, not re-implemented |
| Wizard | `nextStep`/`previousStep` boundaries; `canLeaveStep` per step (required fields, tax-number format); draft survives a step change; `reset` clears; `?step=` invalid → `1`; submit success → navigation + toast + invalidation; `409` routing; cancel closes and resets |
| Edit | `updatedAt` is sent; `STALE_WRITE` keeps the window open and re-reads; field-level `409` lands on the field; read-only fields are absent from the DOM as inputs |
| Store | init → `setDraft` → `setStep` → `reset`; selectors return stable slices; no global leakage (one instance per mount) |
| Shared | `use-tab-param.logic` all branches; `entities/customer/customer.mapper` fallbacks and label tables |

---

## 10. File map per ticket

Names are the contract; a ticket that needs a different name changes this file first.

```text
packages/shared/src/contract/customers/          AIS-178: customers.contract.ts (+ registry + list projection D9)
packages/api-client/src/customers/               AIS-178: customers.service.ts, .interface.ts, .const.ts, .path.ts
apps/admin/src/features/customers/               AIS-19 ✅: use-customers-list.ts, use-archive-customer.ts,
                                                 customers.const.ts, customers.logic.ts, customers.interface.ts
                                                 AIS-20 ✅: use-customer-detail.ts
                                                 AIS-21 ✅: use-update-customer.ts, use-update-customer-status.ts
                                                 (a use-customer-tags.ts az AIS-193 ticketé)
                                                 AIS-179 ✅: use-customer-contacts.ts, use-customer-users.ts
                                                 AIS-181: use-customer-activities.ts, use-customer-audit-logs.ts
                                                 AIS-182: use-create-customer.ts
                                                 shared: customers.const.ts (query keys via
                                                 createEntityQueryKeys), customers.logic.ts,
                                                 customers.interface.ts
apps/admin/src/features/api/use-tab-param.ts     AIS-19 ✅ **created** it (first consumer `?step=`, with
                                                 .logic.ts + tests); AIS-20 reuses it for `?tab=`
apps/admin/src/entities/customer/                AIS-19: customer.interface.ts, customer.mapper.ts,
                                                 customer.const.ts (labels, status variants), components/
apps/admin/src/pages/customers/                  AIS-19 ✅ / AIS-20 ✅ / AIS-21 ✅ / AIS-179 ✅ / AIS-181:
                                                 CustomersPage.tsx, CustomerCreatePage.tsx, CustomerDetailPage.tsx,
                                                 CustomerEditPage.tsx, customer-edit.logic.ts, customers.const.ts,
                                                 customers.interface.ts, customers.logic.ts,
                                                 customers-wizard.store.ts (+ provider), customers-wizard.logic.ts,
                                                 customer-contact.logic.ts, customer-user.logic.ts,
                                                 ui/* (AIS-21 ✅: CustomerEditForm, CustomerDetailHeaderActions,
                                                 CustomerStatusDialog; AIS-179 ✅: CustomerContactsTab,
                                                 CustomerUsersTab, CustomerContactForm, CustomerUserInviteForm,
                                                 CustomerUserEditForm, ContactCreateDialog, ContactEditDialog,
                                                 CustomerUserInviteDialog, CustomerUserEditDialog,
                                                 ContactArchiveDialog, CustomerUserRevokeDialog)
apps/admin/src/app/app.const.ts                  AIS-19 ✅: APP_ROUTE_CUSTOMERS_PATH, APP_CUSTOMERS_LABEL
apps/admin/src/app/router/route-registry.tsx     AIS-19 ✅ (`/customers`, `/customers/new`) —
                                                 AIS-20 ✅: the detail entry (sibling, resolved crumb),
                                                 AIS-21 ✅: the edit entry (sibling, resolved crumb),
                                                 AIS-179 ✅: the four overlay children of the detail entry
docs/Specs/UI-Architecture.md §5                 AIS-19 ✅: the row of §6 above, `zustand` row flipped
```

**Delivered by AIS-19 (2026-11-25), verified against the tree:** `entities/customer/*` (interface,
const, mapper, `components/CustomerStatusBadge.tsx`), `pages/customers/*` (`CustomersPage`,
`CustomerCreatePage`, `customers.const.ts`, `customers.interface.ts`, `customers.logic.ts`,
`customers-wizard.store.ts` + provider/interface/errors, `ui/CustomersFilters`, `ui/CustomersTable`,
`ui/ArchiveCustomerDialog`, `ui/CustomerWizardStepper`), the route entries and the MSW handlers in
`apps/admin/src/test/mocks/handlers/customers.handlers.ts`. Still open on this contract: the edit form
and the tags chip bar (AIS-21), the two overlay tabs (AIS-179), the activity/audit tabs (AIS-181) and
the wizard's steps 2–4 with the submit (AIS-182).

**Delivered by AIS-20 (2026-11-25), verified against the tree:** `features/customers/use-customer-detail.ts`,
the entity additions (`CustomerDetailViewModel`/`CustomerDetailGroup` in `customer.interface.ts`, the
`CUSTOMER_DETAIL_*` label tables in `customer.const.ts`, `toCustomerDetailViewModel` in
`customer.mapper.ts`), `pages/customers/CustomerDetailPage.tsx`, `customers.const.ts` + `customers.interface.ts`
(the tab contract, `CustomerTab`, `CustomerDetailState`), the pure `toCustomerDetailState` in
`customers.logic.ts`, `ui/CustomerTabs.tsx`, `ui/CustomerOverviewTab.tsx`, `ui/CustomerDataTab.tsx`,
`ui/customer-tab-panels.tsx`, the detail route entry and the detail MSW handlers (200 / 404 / 500).
Two decisions of this ticket are recorded here rather than in a rule file: **the `Szerkesztés` link and
the status/archive header menu stay in AIS-21** (they would point at a route that does not exist yet),
and **the page folder stays flat** (`pages/customers/`, no `customer/` subfolder), superseding the
`customer/…` paths of the wave plan for AIS-179 / AIS-181 as well.

**Delivered by AIS-179 (2026-11-25), verified against the tree:** `features/customers/use-customer-contacts.ts`,
`features/customers/use-customer-users.ts`, the entity additions (`ContactRoleBadge`,
`CustomerContactViewModel(s)`, `CustomerUserViewModel(s)` in `customer.interface.ts`; the
`CONTACT_*` / `CUSTOMER_USER_*` label and badge tables in `customer.const.ts`;
`toCustomerContact(ViewModel|ViewModels)` / `toCustomerUser(ViewModel|ViewModels)` in `customer.mapper.ts`;
the extended `toCustomerDetailViewModel` now carrying `id`, `contacts` and `customerUsers`),
`pages/customers/customer-contact.logic.ts`, `pages/customers/customer-user.logic.ts`, the ten new
`ui/` components listed in the file map above, the four route children, the contact and login-user MSW
handlers and the `CUSTOMER_CONTACT_ROLE_FIELDS` / `*_FIELD_PATHS` / `*_DEFAULT_PATH_BY_CODE` copy tables.
Three decisions are recorded here rather than in a rule file: **the detail view model owns the contact
and user lists** (so a tab stays markup and no tab fetches), **the roles are three booleans in the form**
(converted by `toContactRoles()`, no `useFieldArray`), and **the revoke action exists only on an
`invited` row** (`D8`), because the API revokes pending invitations only.

**Delivered by AIS-21 (2026-11-25), verified against the tree:** `pages/customers/customer-edit.logic.ts`
(derived edit schema, status schema, record → values, values → payload, country options, read-only
summary), `CustomerEditPage.tsx`, `ui/CustomerEditForm.tsx`, `ui/CustomerDetailHeaderActions.tsx`,
`ui/CustomerStatusDialog.tsx`, the `CUSTOMER_EDIT_*` / `CUSTOMER_DETAIL_ACTION*` / `CUSTOMERS_STATUS_*`
copy in `customers.const.ts`, the extended `customers.interface.ts`, `toCustomerEditRoute` rebuilt on
`CUSTOMER_EDIT_ROUTE_PATH`, the edit route entry and the write MSW handlers (200, `422`, `409`
tax-number conflict, `409 STALE_WRITE`, `500`, plus the status route). The ticket's DoD is satisfied:
`useAppForm` only, field errors from `details[].path`, the stale write as a page-level notice with a
reload action, a success toast plus invalidation, and the panel/state row in `UI-Architecture.md` §5.

---

## 11. Verification

```bash
pnpm quality            # layers + dead code + tokens + field errors + docs
pnpm test:quality       # the gates' own fixtures
pnpm -r lint && pnpm typecheck && pnpm -r build && pnpm test
```

The documentation side of this file is validated by `pnpm quality:docs`: every relative link must
resolve (R1), every `§N` next to a document link must name an existing section (R2), and this file
must keep its `**Utolsó frissítés:** YYYY-MM-DD` line (R3).
