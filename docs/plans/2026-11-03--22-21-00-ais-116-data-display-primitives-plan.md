# AIS-116 — data-display primitívek **és** a teljes api-keys oldal

**Állapot:** jóváhagyásra váró terv
**Ticket:** AIS-116 (az AIS-104 sub-taskja) — `packages/ui: data-display primitívek`
**Hatókör (döntés):** a hét primitív **plusz** az api-keys oldal átállítása rájuk — a lap/lapméret/rendezés az URL-ben, működő lapozóval. **Nincs follow-up ticket**: a primitívek első fogyasztója ugyanebben a ticketben bizonyítja az API-t.
**Előfeltételek:** AIS-106/107 (lista-szerződés + `meta.pagination`), AIS-114 (`useApiList`), AIS-119 (`useListParams`), AIS-120 (MSW harness) — **mind kész**
**Nincs a hatókörben:** AIS-117 (overlay, Radix), edit/delete UI, szűrő (`q`) UI, `packages/ui` új dependency

---

## 1. A ticket és a valóság

| Ticket pont | Mai valóság | Teendő |
| --- | --- | --- |
| „Először döntés: Út A (`Table` bővítése) vs Út B (`@tanstack/react-table`)” | hat natív `Table*` komponens, szerveroldali lapozás/rendezés (AIS-107), max `limit = 100` | **§2 — Út A** |
| „`Pagination` … a `meta.pagination`-t fogyassza” | `{ page, limit, total, totalPages }` ([`envelope.interface.ts:14`](packages/shared/src/contract/envelope.interface.ts:14)); a kliens `ApiResult<TRows>['meta']`-ként látja | **§4** |
| „`StatusBadge`: domain státusz → `Badge` variáns” | `badgeVariants` a vizuális szótár; a `status → variant` mapping a `.roo` szabály szerint `entities/`-ben él | **§5** |
| DoD: „minden primitívre loading/empty/error/success teszt” | error állapot nem primitív-szintű: `toErrorSurface` dönt, a `PageErrorState` renderel | **újraértelmezve**: a primitívek loading/empty/success **slotjait** teszteljük |
| „a lapozó vezérlők az AIS-116-tal jönnek” (AIS-119, `ApiKeysPage` komment) | az adatáramlás **kész**: a page már `useListParams` + `useApiKeysQuery(params)`-t használ, csak a `meta`-t nem használja | **§7** — a teljes oldal ebbe a ticketbe kerül |
| ticket szöveghibák | „Párhuzamosítható az AIS-116-tal (overlay)” → **AIS-117**; a Badge/Table döntés kétszer szerepel a DoD-ban | Jira javítás a kód előtt |

---

## 2. Döntés: Út A — a meglévő `Table*` bővítése

| Szempont | Út A (bővítés) | Út B (`@tanstack/react-table`) |
| --- | --- | --- |
| Rendezés | szerveroldali (`sort`/`order` a query-szerződésben) | kliensoldali motor, kihasználatlan |
| Virtualizálás | nem kell (max 100 sor) | felesleges komplexitás |
| Táblázat-implementációk | **egy** | kettő + migráció |
| Új dependency | nincs | igen |

A `Table*` komponensek változatlanok; a `DataTable` komponálja őket. A `packages/ui/package.json` **nem** változik.

---

## 3. Fájlok

```text
packages/ui/src/components/           skeleton/ spinner/ empty-state/ description-list/
                                     status-badge/ pagination/ data-table/
packages/ui/test/                     ugyanezek *.test.tsx, valamint pagination.logic.test.ts
apps/admin/src/pages/api-keys/        ApiKeysPage.tsx, api-keys.interface.ts, api-keys.const.ts,
                                     api-keys.logic.ts (+ api-keys.logic.test.ts),
                                     ui/ApiKeysTable.tsx (+ .test.tsx), ApiKeysPage.test.tsx (új)
apps/admin/src/features/api/          use-list-params.ts, use-list-params.logic.ts (+ teszt)
```

---

## 4. `Pagination`

```ts
export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginationProps {
  readonly meta: PaginationMeta;
  readonly onPageChange: (page: number) => void;
  readonly onLimitChange?: (limit: number) => void;
  readonly limitOptions?: readonly number[];
  readonly ariaLabel?: string;
}
```

- **D1:** a `packages/ui` **nem** függ a `@callback/shared`-től — a négy mező strukturális, így a `meta.pagination` közvetlenül átadható; az egyezést a fogyasztó fordítója kényszeríti ki (4 mezőért nem kötjük a UI-t a szerződéshez).
- `pagination.logic.ts` tiszta függvények: `toVisiblePages(meta, maxButtons)`, `toRangeLabel(meta)` (`1–20 / 137`), `clampLimit(limit, options)`; `pagination.const.ts`-ben `PAGINATION_DEFAULT_MAX_BUTTONS = 7`.
- Markup: `<nav aria-label>`, az aktuális oldal `aria-current="page"`, előző/következő `aria-label`-lel, limit `<select>` `<label>`-lel.
- Stílus: `rounded-control border border-hairline border-border-hairline bg-surface-raised shadow-neu-raised`; aktív oldal `shadow-neu-pressed bg-tertiary`; fókusz `focus-visible:border-border-focus focus-visible:shadow-focus-ring`.

## 5. `DataTable` és `StatusBadge`

```ts
export interface DataTableColumn<TRow> {
  readonly id: string;
  readonly header: ReactNode;
  readonly cell: (row: TRow) => ReactNode;
  readonly sortable?: boolean;
  readonly align?: 'start' | 'end';
}

export interface DataTableSort {
  readonly columnId: string;
  readonly order: 'asc' | 'desc';
}

export interface DataTableProps<TRow> {
  readonly rows: readonly TRow[];
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly rowKey: (row: TRow) => string;
  readonly sort?: DataTableSort | null;
  readonly onSortChange?: (sort: DataTableSort) => void;
  readonly isLoading?: boolean;
  readonly loadingRowCount?: number;
  readonly empty?: ReactNode;
  readonly caption?: string;
  readonly rowActions?: (row: TRow) => ReactNode;
}
```

- **D2:** a `DataTable` **nem rendez helyben** — csak jelzi a szándékot (`onSortChange`), mert az igazság a szerveren és az URL-ben van. A `sortable` fejléc `<button>` a `<th>`-ben, a `<th>` `aria-sort="ascending" | "descending" | "none"`.
- A `rowActions` az utolsó cella slotja (a sor adatát kapja), nem külön prop-tömb.
- `isLoading` → `loadingRowCount` (alap 5) skeleton sor, fejléc megmarad; üres lista (`!isLoading`) → `empty` slot, alapból `EmptyState`.
- `StatusBadge` props: `{ status: string; label: ReactNode; variant: BadgeVariants['variant'] }` → `<Badge variant={variant} data-status={status}>`. Nincs új szín; a `status → variant` mapping az admin `entities/api-key/api-key.mapper.ts`-ben marad.

## 6. `Skeleton`, `Spinner`, `EmptyState`, `DescriptionList`

| Primitív | API | Döntés |
| --- | --- | --- |
| `Skeleton` | `{ shape?: 'line' \| 'field' \| 'row'; lines?: number; className? }` | **Statikus** (D3): `bg-surface-sunken` + `border-hairline` + `shadow-neu-inset`; nincs pulse, mert a `theme.css`-ben nincs hozzá motion-token. `aria-hidden` |
| `Spinner` | `{ size?: 'sm' \| 'md'; label?: string }` | `role="status"`, a `label` `sr-only` szövegként |
| `EmptyState` | `{ title: string; description?: string; action?: { label: string; onAction: () => void } }` | gyökér `role="status" aria-label={title}`; a CTA `aria-label`-je `` `${action.label} — ${title}` ``; CTA nélkül is működik |
| `DescriptionList` | `{ items: readonly { label: string; value: ReactNode }[]; isLoading?: boolean; empty?: ReactNode; columns?: 1 \| 2 }` | szemantikus `<dl>/<dt>/<dd>`; `isLoading` → skeleton sorok; üres → `empty` slot |

## 7. A teljes api-keys oldal (a ticket második fele)

### 7.1 Mi van készen, mi hiányzik

| Fájl | Ma | Kiegészítés |
| --- | --- | --- |
| [`ApiKeysPage.tsx:37`](apps/admin/src/pages/api-keys/ApiKeysPage.tsx:37) | `useListParams` + `useApiKeysQuery(params)`; a `meta`-t **nem** használja, `setParam`-ot nem ad tovább | `meta`, `setParams`, `sort` átadása; `<Pagination>` a tábla footerében |
| [`ApiKeysTable.tsx:32`](apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:32) | kézi `Table*`, üres/betöltő `<p>` | `DataTable` + `EmptyState` + `Skeleton`, `pagination` slot |
| [`use-api-keys.ts:40`](apps/admin/src/features/api-keys/use-api-keys.ts:40) | kész (a `meta` már benne van a visszatérésben) | **nincs változás** |
| [`use-list-params.ts:52`](apps/admin/src/features/api/use-list-params.ts:52) | csak egy-mezős `setParam` | **`setParams(patch)` hozzáadása — lásd D4** |

### 7.2 D4 — miért kell `setParams(patch)` a `useListParams`-ba

A fejléc-kattintás **két** mezőt ír egyszerre (`sort` + `order`). A mai `setParam` a *aktuális* `params`-ból építi a következő URL-t és azonnal `setSearchParams`-t hív, ezért két egymás utáni hívásnál a második **felülírja** az elsőt (és két history-bejegyzést is csinál).

- Új tiszta függvény a [`use-list-params.logic.ts`](apps/admin/src/features/api/use-list-params.logic.ts:1)-ben: `applyListParamsPatch(params, patch, pageField)` — egy patch → egy `applyPageReset` → egy `setSearchParams`.
- A hook `setParams(patch: Partial<TParams>)`-ot kap; a `setParam` marad (page/limit egy-mezős esetre).
- Ez **AIS-119 kódját érinti** (ami In Review): a Jirában kommentelni kell, a `use-list-params` tesztek bővülnek (patch → egy URL-írás, page reset, invalid érték eldobása).

### 7.3 Rendezés és lapozás leképezése

| Irány | Szabály |
| --- | --- |
| URL → tábla | `toTableSort(params)` tiszta függvény a `pages/api-keys/api-keys.logic.ts`-ben: `{ columnId: params.sort, order: params.order }` |
| tábla → URL | `onSortChange(next)` → `setParams({ sort: next.columnId as ApiKeySortField, order: next.order })` — az oldalszám automatikusan 1-re áll (`applyPageReset`) |
| lapozó | `onPageChange(page)` → `setParam('page', page)`; `onLimitChange(limit)` → `setParam('limit', limit)` |
| látható oszlopok | `name`, `identifier`, `description`, `expiresAt`; **rendezhető**: `name`, `identifier`, `expiresAt` (a `API_KEY_SORT_FIELDS` allow-listből; a `description` nem szerepel benne) |
| lapméret-opciók | a page adja át: `[LIST_QUERY_DEFAULT_LIMIT, 50, LIST_QUERY_MAX_LIMIT]` (20 / 50 / 100) — a `ui` nem importálhatja a sharedet |

### 7.4 Props-változás

```ts
export interface ApiKeysTableProps {
  readonly apiKeys: ApiKeyViewModels;
  readonly isLoading: boolean;
  readonly sort: DataTableSort;
  readonly onSortChange: (sort: DataTableSort) => void;
  /** A page adja: a pager csak akkor jelenik meg, ha van meta. */
  readonly pagination?: ReactNode;
}
```

Állapotok: loading → skeleton sorok (fejléc marad); üres → `EmptyState` a `API_KEYS_EMPTY_MESSAGE`-dzsel; hiba → változatlanul a page `PageErrorState`-je (a tábla nem kap error propot); siker → `DataTable` + `Pagination`, ha `meta !== null`.

## 8. Tesztek

### 8.1 `packages/ui/test/`

| Fájl | Esetek |
| --- | --- |
| `skeleton.test.tsx` | három alak; `lines` darabszám; `aria-hidden` |
| `spinner.test.tsx` | `role="status"`; `label` elérhető; alap label |
| `empty-state.test.tsx` | cím/leírás; CTA callback; a CTA `aria-label`-je tartalmazza a címet; CTA nélkül nincs gomb; `role="status"` |
| `description-list.test.tsx` | `dl/dt/dd`; `isLoading` → skeleton, nem `dd`; üres → `empty`; `columns=2` |
| `status-badge.test.tsx` | variáns-osztály; `data-status`; label |
| `pagination.test.tsx` | `aria-current`; első/utolsó lapon letiltott prev/next; `onPageChange` száma; limit-választó; `nav` `aria-label` |
| `pagination.logic.test.ts` | `toVisiblePages` határesetek (0/1/3/10 lap, páros-páratlan `maxButtons`); `toRangeLabel` (`total = 0`); `clampLimit` |
| `data-table.test.tsx` | fejléc + sorok; `aria-sort`; kattintás → `onSortChange` toggléval; nem rendezhető fejléc nem gomb; `isLoading` → skeleton, nincs empty; üres → empty slot; `rowActions`; `caption` |

### 8.2 `apps/admin`

| Fájl | Esetek |
| --- | --- |
| `use-list-params.logic.test.ts` | `applyListParamsPatch`: két mező egy lépésben, page reset, invalid érték → default |
| `use-list-params.test.tsx` | `setParams` → **egy** `setSearchParams` hívás, az URL tartalmazza mindkét mezőt |
| `pages/api-keys/ui/ApiKeysTable.test.tsx` | átírva: `aria-sort` a rendezett oszlopon; fejléc-kattintás → `onSortChange`; loading → skeleton; üres → `EmptyState`; `pagination` slot renderel |
| `pages/api-keys/ApiKeysPage.test.tsx` (**új**, MSW) | sorok betöltése; `?page=2` deep link → a kérés `page=2`-t visz; következő oldal kattintás → URL **és** kérés változik; rendezhető fejléc → `sort`/`order` az URL-ben, oldalszám 1; üres lista → `EmptyState`; 500 → `PageErrorState` |

## 9. Dokumentáció

| Fájl | Változás |
| --- | --- |
| [`docs/Specs/UI-Architecture.md`](docs/Specs/UI-Architecture.md:1) §4 | hét új primitív sora |
| ugyanott §5 (state plan) | az api-keys sor: page/limit/sort az **URL-ben**, a pager a `meta.pagination`-ból |
| ugyanott §7 | **nincs** új dependency (a döntés látható legyen) |
| ugyanott fejléc | `Utolsó frissítés` bump |
| [`docs/Specs/Admin-Data-Flow.md`](docs/Specs/Admin-Data-Flow.md:1) | a lista-recept: `useListParams → useApiList → DataTable/Pagination` egy bekezdésben |
| `docs/history/` + `docs/milestones/` | bejegyzés (többfájlos, design-döntéses változás) |

## 10. Végrehajtási sorrend

1. `Skeleton`, `Spinner` (+ tesztek).
2. `EmptyState`, `DescriptionList`, `StatusBadge` (+ tesztek).
3. `pagination.logic.ts` + teszt, majd a `Pagination` komponens + teszt.
4. `DataTable` (+ teszt), `packages/ui/src/index.ts` exportok.
5. `use-list-params.logic.ts` `applyListParamsPatch` + teszt; a hook `setParams` + teszt.
6. `pages/api-keys/api-keys.logic.ts` `toTableSort` + teszt; `ApiKeysTable` átállítás; `ApiKeysPage` bekötés + új page teszt.
7. Docs, Jira (AIS-116 szöveg + DoD, AIS-104 DoD, komment az AIS-119-re), history + milestone, In Review.

## 11. Ellenőrzés

```powershell
pnpm --filter @callback/ui test
pnpm --filter @callback/ui build
pnpm --filter @callback/admin test
pnpm --filter @callback/admin build
pnpm quality
pnpm test
```

Elvárt: a `ui` suite +8 fájl, az admin suite a page teszttel bővül (jelenleg 28 fájl / 239 teszt), paletta- és field-error gate `0 violations`, `knip` tiszta.

## 12. Kockázatok

| Kockázat | Mérséklés |
| --- | --- |
| Két egymás utáni `setParam` felülírja egymást (sort + order) | D4: `setParams(patch)` egy URL-írással; teszt bizonyítja, hogy egy `setSearchParams` hívás történik |
| A `useListParams` módosítása egy In Review ticket (AIS-119) kódját érinti | A változás tisztán additív (`setParams` új tag), a meglévő `setParam` viselkedése változatlan; Jira komment az AIS-119-en |
| A page teszt MSW-vel lassú lehet | a meglévő handlerek (`apiKeysListPageTwo`, `apiKeysListEmpty`, `apiKeysListServerError`) már léteznek; nincs új hálózati mock |
| A `DataTable` API túl korán merevedik be | csak a két valós slot (`sort`, `rowActions`) van benne; szűrés/virtualizálás későbbi ticket |
| A skeleton animáció nélkül „töröttnek” tűnik | tudatos döntés (D3); ha kell pulse, az külön token-bővítés |
