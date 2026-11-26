# AIS-130 — Page-state szabály lezárása (URL + TanStack Query alap, Zustand csak tranziens UI-ra)

**Dátum:** 2026-11-04 19:30 (Europe/Budapest)
**Ticket:** [AIS-130](https://zakzag.atlassian.net/browse/AIS-130) · parent AIS-129 · status: To Do
**Scope:** dokumentáció + szabály, **nulla új dependency**, nulla termékkód.
**Érintett fájlok:** [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1), [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1), `docs/history/`, `docs/milestones/`.

---

## 1. Kiinduló helyzet (mért)

| Tény                                                                                       | Bizonyíték                                                                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| §6 **kötelezően** ír elő page-local Zustand store-t                                        | [`react.coding-standards.md:13`](../../.roo/rules/react.coding-standards.md:13), §6 `:139`–`:176`    |
| §5 szerint a `zustand` **nincs telepítve** (planned)                                       | [`UI-Architecture.md:395`](../../docs/Specs/UI-Architecture.md:395), §7 táblázat `:461`             |
| `zustand` valóban nincs egyetlen `package.json`-ban sem                                     | [`apps/admin/package.json`](../../apps/admin/package.json:20)                                        |
| **Nincs** egyetlen `*.store.ts` a `pages/` alatt                                            | `apps/admin/src/pages/**` fájllista                                                                 |
| A lista-állapot ma **már** az URL-ben él                                                   | [`use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:1) (AIS-119)            |
| §5 state-plan táblázat **már** 4 sort tartalmaz (`api-keys`, `LoginPage`, `PlaceholderPage`, `/calls`) | [`UI-Architecture.md:377`](../../docs/Specs/UI-Architecture.md:377)                        |

→ A DoD 3. pontja („minden oldal sora megvan”) **már teljesül**, ezt a plan csak ellenőrzi és rögzíti.

## 2. Döntés (D1) — `zustand` nem kerül telepítésre

Három lehetőség volt:

| Opció                                                                             | Eredmény                                                                 | Verdikt |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| A — nincs telepítés, a szabály feltételes, a factory referencia-minta            | nincs használatlan dep, nincs knip-kivétel, nincs új teszt               | **ez**  |
| B — telepítés most, egyelőre kihasználatlan `api-keys.store.ts` + knip-kivétel     | a `quality:dead-code` kivételt igényel, holt kód a repóban               | elvetve |
| C — telepítés + átállítunk egy mai `useState`-et store-ra                          | termékkód-változás olyan oldalon, aminek nincs rá szüksége (scope creep) | elvetve |

**Kiváltja:** AIS-129 referencia-szeletének első olyan oldala, amelynek **tényleg** tranziens
UI-állapota van (nyitott drawer, kijelölt sor, oszlopszűrő). Az a ticket telepíti a `zustand`-ot,
felveszi a `§7` táblába `installed`-ra és megírja a store-tesztet.

**Következmény a §6-ra:** a store nem tiltott, hanem **feltételes** — a döntési sorrend
URL → TanStack Query → page-local store, és a store csak akkor, ha az első kettő bizonyítottan nem elég.

## 3. Változtatások

### 3.1 [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1) — a szabály

| Hely     | Mai szöveg                                                       | Új szöveg                                                                                                            |
| -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `:4`     | Stack felsorolásban `Zustand`                                    | `Zustand (csak indokolt tranziens UI-állapotra, lásd §6)`                                                             |
| `:13`    | §0.3 „page UI state → that page's Zustand store”                  | „**list/search state → URL**, page UI state → page-local Zustand store **only when** neither URL nor Query can own it” |
| `:14`    | §0.4 „Its store lives inside the folder”                          | „**If** the page has a store, it lives inside the folder and is never imported by another page”                        |
| `:31`    | `pages/<page>/<page>.store.ts` sor                              | `(optional) <page>.store.ts  page-scoped store factory — only for transient UI state (§6)`                              |
| `:90`    | §3 Store név-konvenció                                          | `(optional)` jelölés + „requires an explicit §6 justification”                                                        |
| `:139`–`176` | §6 „three buckets” + kötelező store factory                   | **§6 újraírva**: döntési létra, bucket-táblázat (URL sorral), 3 kérdéses döntési teszt, factory minta `reference only — zustand not installed` jelöléssel |
| `:291`   | §12/4. „If the page has UI state, add `<page>.store.ts`”          | „Only if the state is **transient** and neither URL- nor server-owned; otherwise add no store”                          |
| `:295`   | §12/8. „Add tests (logic, store, hook)”                           | „Add tests (logic, hook and — **if present** — store)”                                                                 |
| `:305`   | §13 DoD „page state in the page store”                            | „list state in the URL, transient page state in the page store (if any)”                                              |

#### 3.1.1 A §6 teljes új szövege (szó szerint, angolul)

Ez a blokk **egy az egyben** kerül a [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) `## 6.` fejlécétől a `## 7. Styling`-ig, a mai §6 (`:139`–`:176`) helyére.

````markdown
## 6. State: URL first, then Query, then — maybe — a store

Four buckets. The order **is** the rule: always try the earlier bucket first, and move down only when
the previous one provably cannot hold the state.

| # | Bucket                  | Owner                                                     | Examples                                                        | Never inside                          |
| - | ----------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| 1 | List / navigation state | the **URL** — `useSearchParams` behind one typed hook (§6.2) | filter, sort, page, page size, active tab, linkable selected id | secrets, server payloads, form values |
| 2 | Server state            | TanStack Query cache                                      | request lists, call details, mutation results                   | a copy in a store or in `useState`    |
| 3 | Transient page UI       | page-local store factory — Zustand (§6.3)                  | open drawer, selected row, column filters, bulk selection       | server data, derived server data      |
| 4 | Local component state   | `useState` in the component that owns the interaction      | open menu of one dropdown, a search field's own text            | state a sibling or the page needs     |

### 6.1 The decision test

Ask in this order and stop at the first **yes**:

1. Must the state survive a reload, a copied link, or the back button? → **the URL**.
2. Does the value originate on the server? → **TanStack Query** (never copy it out).
3. Do two or more parts of the page share it, and may it be lost on navigation? → **page-local store**.

If all three are **no**, the state is local: `useState` in the component that owns the interaction.
Most pages therefore end up with **no store at all** — "no store" is a decision, not an omission, and
it is recorded in the state plan of [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:368) §5.

### 6.2 The URL bucket

- List state is parsed and written by **one** hook
  ([`features/api/use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:1)) using
  the resource's shared list-query schema. A component never reads `searchParams` itself, and list
  state never enters a store.
- One user interaction = **one** URL write (`setParams(patch)`). Two writes rebuild the URL from the
  same pre-render value, so the first change is lost and two history entries appear.
- Schema defaults are omitted from the URL; an invalid parameter falls back to the default instead of
  throwing.

### 6.3 The store bucket

- Store factory pattern (below), **one instance per mounted page**, so navigation resets it.
- The page folder owns `<Page>StoreProvider` + the selector hook `use<Page>Store<T>(selector)`; no
  store export leaves that folder and no page imports another page's store.
- Components subscribe with selectors, never with the whole store.
- `persist` is allowed only with an explicit `partialize` whitelist, documented in the state plan.
- The only global store is `useSessionStore` (token, role) in `app/`.
- A store that mirrors URL state or Query state is a defect, not a convenience (§6.1, steps 1–2).

### 6.4 `zustand` is not installed yet (AIS-130)

The factory below is the **reference pattern**, not a required file. `zustand` is in **no**
`package.json` today, because no page has genuine transient UI state yet. The page that first needs
one adds the dependency in the **same** change, switches the `zustand` row of
[`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:442) §7 to `installed`, and ships
the store tests (init → patch → selector). Until then **no** `<page>.store.ts` is created — an unused
store would also fail the dead-code gate (`pnpm quality:dead-code`).

```ts
import { createStore } from 'zustand/vanilla';

export interface DashboardState {
  readonly filters: CallbackRequestsFilters;
}
export interface DashboardActions {
  setFilters: (patch: Partial<CallbackRequestsFilters>) => void;
}
export type DashboardStore = DashboardState & DashboardActions;

export function createDashboardStore(init?: Partial<DashboardState>) {
  return createStore<DashboardStore>()((set) => ({
    filters: { ...DEFAULT_FILTERS, ...init?.filters },
    setFilters: (patch) =>
      set((state) => ({ filters: { ...state.filters, ...patch } })),
  }));
}
```

The provider and the selector hook stay in the page folder:

```ts
// pages/dashboard/dashboard-store.provider.tsx — the only place an instance is created
export function DashboardStoreProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createDashboardStore());
  return (
    <DashboardStoreContext.Provider value={store}>
      {children}
    </DashboardStoreContext.Provider>
  );
}

export function useDashboardStore<T>(selector: (state: DashboardStore) => T): T {
  const store = useContext(DashboardStoreContext);
  if (store === null) throw new MissingStoreProviderError('DashboardStore');
  return useStore(store, selector);
}
```
````

Két apró kiegészítés a fenti blokkhoz képest (a mai §6-ból **megőrizve**, nem új szabály): a
bucket-táblázat után egy sor — **Form state is a separate bucket and always react-hook-form** —,
valamint a §6.4 után egy **§6.5 The server-state bucket** szakasz a három mai bullet-tel (query
kulcsok `*.const.ts`-ben, invalidálás a query clienten át, szerver adat nem másolható store-ba).

A minta `MissingStoreProviderError`-ja **szemléltetés**: a custom error osztály a store-t először
használó oldallal jön létre (`.interface.ts`-ben deklarálva, a `ts.coding-standards.md` „custom error
classes” szabálya szerint), a szabály csak a mintát mutatja.

### 3.2 [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1) — a doksi

| Hely                      | Változás                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| fejléc `:3`               | `**Utolsó frissítés:** 2026-11-04` + AIS-130 bejegyzés a dátum-sorban                                                                |
| új bekezdés `:25` után    | `**AIS-130 (2026-11-04):**` blokk — a §6 döntési létra **idézete** (nem fordítása), a `zustand`-döntés és a kiváltó ticket neve      |
| §5 nyitány `:368`–`373`   | a „három bucket” mondat helyett: URL → Query → store, a §6-ra hivatkozva (a szabály nyer)                                            |
| §5 `:390`–`396`           | a mai „`zustand` therefore stays uninstalled…” bekezdés **megmarad**, de a döntés helyeként az AIS-130-ra mutat, és a kiváltó feltételt nevezi meg |
| §5 záró bekezdés `:382`   | „If a page needs page-wide UI state…” → „**If** a transient UI state exists that is neither URL- nor server-owned…”                  |
| §6/1. lépés `:419`–`421`  | a store-ra vonatkozó félmondat a §6 döntési létrára hivatkozik                                                                       |
| §7 `:461`                 | `zustand` sor: `planned` **marad**, `State` oszlop: „decision closed in **AIS-130** — no page needs transient UI state yet; install it with the first such page (parent story AIS-129)” |
| §7 `:465`                 | a „Rows marked _planned_ must not be read as available.” mondat kiegészítése: a planned sor döntés-helye az AIS-130                         |

**Nem változik:** §1–§4, §8, §9 (a gate-ek érintetlenek — a szabályváltozás nem hoz új gépi szabályt),
a state-plan táblázat sorai (már teljesek).

### 3.3 Nem érintett (szándékosan)

- `apps/admin/**` termékkód, `packages/**`, `knip.json`, `.dependency-cruiser*`, CI workflow — **nincs** változás.
- `docs/Specs/Admin-Data-Flow.md` — már URL-first; a §25 sorban hivatkozott §-számokat nem írjuk át.

## 4. DoD leképezés

| Ticket DoD                                                       | Teljesül                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| §6 és §5 nem mond ellent                                         | 3.1 + 3.2 (a §5 a §6-ot idézi, nem fordítja)                          |
| `zustand` telepítéséről explicit döntés, §7 tükrözi               | **D1**: nem telepítjük; §7 sor `planned` + AIS-130 hivatkozás          |
| §5 state-plan táblában minden oldal sora megvan                  | **már megvan** (4 sor) — ellenőrzés + rögzítés a history-ban          |
| `UI-Architecture.md` fejléc-dátum frissült                        | 3.2 első sora                                                         |
| Teszt: ha nincs store-példa, nincs új kód                        | nincs új teszt; a store-teszt az AIS-129 store-jával együtt jön       |

## 5. Ellenőrzés (implementáció után futtatandó)

```bash
git diff --name-only                 # csak 4 fájl: 2 szabály/specs + history + milestone
pnpm quality                         # a gate-ek zöldek (nem érintettük őket)
grep -n "zustand" .roo/rules/react.coding-standards.md docs/Specs/UI-Architecture.md
```

Kézi ellenőrzés: a §6 döntési létrát olvasva **egy** új oldal fejlesztője eldönti, hova teszi a
szűrőt / a kijelölt sort / a form hibát — kérdés nélkül.

## 6. Kötelező dokumentumok

| Fájl                                                                         | Tartalom                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `docs/history/2026-11-04--<hh-mm-ss>-ais-130-page-state-rule-closure.md`      | mi változott, melyik sorokban, miért (narratíva)                            |
| `docs/milestones/2026-11-04--<hh-mm-ss>-ais-130-page-state-decision.milestone.md` | a döntés és a kiváltó feltétel — ez a jövőbeli olvasó kontextusa (≤1 oldal) |

Commit: `AIS-130: docs(admin): close the page-state rule with URL first and Zustand last`
