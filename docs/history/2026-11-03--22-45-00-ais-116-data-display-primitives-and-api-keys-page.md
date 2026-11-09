# AIS-116 — data-display primitívek + a teljes api-keys oldal

**Dátum:** 2026-11-03 22:45 (Europe/Budapest)
**Ticket:** AIS-116 (az AIS-104 sub-taskja) — `packages/ui: data-display primitívek`
**Terv:** [`2026-11-03--22-21-00-ais-116-data-display-primitives-plan.md`](../plans/2026-11-03--22-21-00-ais-116-data-display-primitives-plan.md:1)

## Kiinduló helyzet

A `packages/ui` csak a hat natív `Table*` komponenst, `Badge`-et, `Alert`-et és `Banner`-t adta. Az
`api-keys` oldal kézzel írta a táblázatot, a betöltés/üres állapotot egy-egy `<p>`-vel oldotta meg, a
`meta.pagination`-t pedig egyáltalán nem használta: a lapozó kontrollok „az AIS-116-tal jönnek”
kommenttel vártak. Az adatáramlás viszont kész volt (AIS-114 `useApiList` + `useListParams`), csak a
fogadó UI hiányzott.

## Változások

### Hét új primitív (`packages/ui`)

| Primitive | Fájlok | Lényeg |
| --- | --- | --- |
| `Skeleton` | `components/skeleton/{Skeleton.tsx,skeleton.interface.ts,skeleton.variants.ts}` | `shape`: `line`/`field`/`row`, `lines`; **statikus** (D3), `aria-hidden` |
| `Spinner` | `components/spinner/{Spinner.tsx,spinner.interface.ts,spinner.variants.ts,spinner.const.ts}` | `role="status"`, `sr-only` label, gyűrű border-tokenekből |
| `EmptyState` | `components/empty-state/{EmptyState.tsx,empty-state.interface.ts}` | `role="status" aria-label={title}`, opcionális CTA (`aria-label` = `label — title`) |
| `DescriptionList` | `components/description-list/{DescriptionList.tsx,description-list.interface.ts,description-list.const.ts}` | valódi `<dl>/<dt>/<dd>`, `isLoading` → skeleton, `columns` 1/2 |
| `StatusBadge` | `components/status-badge/{StatusBadge.tsx,status-badge.interface.ts}` | `Badge` + `data-status`; **nincs új szín** |
| `Pagination` | `components/pagination/{Pagination.tsx,PaginationPages.tsx,PaginationLimitSelector.tsx,pagination.interface.ts,pagination.const.ts,pagination.logic.ts}` | `meta` + `onPageChange`/`onLimitChange`; `aria-current`, címkézett prev/next, lapméret `<select>` |
| `DataTable` | `components/data-table/{DataTable.tsx,DataTableHead.tsx,DataTableLoadingRows.tsx,data-table.interface.ts,data-table.const.ts,data-table.logic.ts}` | a hat `Table*` komponálása; `aria-sort`, `rowActions`, `caption`, loading/empty slotok |

`packages/ui/src/index.ts` explicit exportokkal bővült (a `PAGINATION_*_LABEL` konstansokkal együtt,
hogy a page-teszt ugyanazt a szöveget asserts-olja, amit a komponens renderel).
`packages/ui/package.json` **nem** változott — nincs új dependency (lásd milestone).

Tesztek: `packages/ui/test/` +9 fájl (`skeleton`, `spinner`, `empty-state`, `description-list`,
`status-badge`, `pagination`, `pagination.logic`, `data-table`, `data-table.logic`), 18 → 18 fájl /
152 teszt zöld.

### `apps/admin` — a teljes api-keys oldal

| Fájl | Változás |
| --- | --- |
| `features/api/use-list-params.logic.ts` | **új** `applyListParamsPatch` (több mező egy lépésben + page reset) és `applyPatchDefaults` (érvénytelen patch → séma-default) |
| `features/api/use-list-params.interface.ts` | `setParams(patch: Partial<TParams>)` a visszatérési típusban |
| `features/api/use-list-params.ts` | `setParams` implementáció + egyetlen `writeParams` író; **hibajavítás**: a URL-építő a *séma* defaultjaihoz hasonlít (korábban a jelölthöz, ezért `sort`/`order`/`limit` soha nem került az URL-be) |
| `pages/api-keys/api-keys.logic.ts` | `isApiKeySortable` (a shared allow-listből), `toTableSort` (URL → tábla), `toSortParams` (tábla → URL patch) |
| `pages/api-keys/api-keys.const.ts` | `API_KEYS_LIMIT_OPTIONS` = `[20, 50, 100]` a shared konstansokból |
| `pages/api-keys/api-keys.interface.ts` | `ApiKeysTableProps`: `sort`, `onSortChange`, `pagination` slot |
| `pages/api-keys/ui/ApiKeysTable.tsx` | `DataTable` + `EmptyState` + `sr-only` loading announcement; oszlopdefiníciók a contract allow-listjére kötve |
| `pages/api-keys/ApiKeysPage.tsx` | `meta.pagination` → `Pagination`, `setParams(toSortParams(...))` a fejléc-kattintásra, `setParam` a lap/lapméretre |

Tesztek: `use-list-params.{logic,}` tesztek bővítve, `ApiKeysTable.test.tsx` átírva, **új**
`ApiKeysPage.test.tsx` (MSW-vel: sorok, deep link `?page=2`, következő oldal → URL + kérés,
rendezés → `sort`+`order` egy írásban + page reset, üres lista → `EmptyState`, `500` →
`PageErrorState`). Admin suite: 29 fájl / 264 teszt zöld.

## Döntések

- **Út A** — a meglévő `Table*` bővítése `DataTable`-lel; a `@tanstack/react-table` elutasítva, mert a
  rendezés és a lapozás szerveroldali, a lapméret max. 100 sor (kliensmotor + virtualizálás halott kód).
- **D1** — a `Pagination` meta-típusa strukturális, így a `packages/ui` nem függ a `@callback/shared`-től.
- **D2** — a `DataTable` nem rendez helyben, csak jelez; az igazság a szerveren és az URL-ben van.
- **D3** — a `Skeleton` animáció nélküli: a `theme.css`-ben nincs hozzá motion-token.
- **D4** — `setParams(patch)` egyetlen `setSearchParams` hívásért: két `setParam` felülírná egymást.

## Dokumentáció

- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) §4 (hét primitív sora), §5 (az
  api-keys lap/lapméret/rendezés az URL-ben + pager a `meta.pagination`-ból), §7 (nincs új dependency).
- [`docs/Specs/Admin-Data-Flow.md`](../Specs/Admin-Data-Flow.md:1) §3.6 — a lista-recept egy helyen.
- [`docs/milestones/2026-11-03--22-45-00-ais-116-data-display-primitives.milestone.md`](../milestones/2026-11-03--22-45-00-ais-116-data-display-primitives.milestone.md:1)

## Ellenőrzés

```powershell
pnpm --filter @callback/ui test        # 18 fájl / 152 teszt
pnpm --filter @callback/ui build
pnpm --filter @callback/admin test     # 29 fájl / 264 teszt
pnpm --filter @callback/admin build
pnpm quality                           # layers + knip + 0 paletta + 0 field-error violation
```

## Nyitott pont

- A `setParams` egyetlen URL-írását a page/logic tesztek **tartalmilag** bizonyítják (két mező egy
  URL-állapotban); közvetlen `setSearchParams`-hívásszámláló nincs bevezetve, mert az a router-modul
  mockolását igényelné — a viselkedés (mindkét mező megjelenik, nincs `page`) ettől függetlenül
  regressziót fog.
