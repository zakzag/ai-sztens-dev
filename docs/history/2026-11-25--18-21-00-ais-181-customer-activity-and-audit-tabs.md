# AIS-181 — cég adatlap: *Tevékenység* és *Napló* fülek

**Dátum:** 2026-11-25
**Ticket:** [AIS-181](https://zakzag.atlassian.net/browse/AIS-181) (parent: AIS-15)
**Terv:** [`2026-11-25--17-38-00-ais-181-customer-activity-and-audit-tabs-plan.md`](../plans/2026-11-25--17-38-00-ais-181-customer-activity-and-audit-tabs-plan.md:1)
**Milestone:** [`2026-11-25--18-21-00-url-param-preservation-and-audit-rows.milestone.md`](../milestones/2026-11-25--18-21-00-url-param-preservation-and-audit-rows.milestone.md:1)

---

## Mit szállítottunk

A cég adatlap két hátralévő fülét, valamint két általános URL-hook javítást, amit a ticket tett
először láthatóvá.

### Tevékenység fül

- Időrendi feed (`Card` soronként): típus `Badge`, szerző neve + szerzőfajta, időpont, szöveg.
- „Megjegyzés hozzáadása” űrlap (`useAppForm`, `Select` a négy írható típusra + `Textarea`); a
  form **minden** állapotban renderel, üres feednél is.
- Szerkesztés **inline** a sorban (nincs új route), törlés `ConfirmDialog`-tal, helyi `useState`
  targettel (AIS-173 kivétel). Mindkettő **csak** `authorType === 'operator'` soron jelenik meg
  (`D-W4`).
- Lapozás az URL-ben (`activityListQuerySchema`).

### Napló fül

- **Csak olvasható** sorok: művelet badge, szerző mint mondat, `szerzőfajta · tábla · rekordId`
  egysoros detail, időpont; a kibontható régió a **before → after** diff.
- A sorokat a meglévő `LogEntryRow` rendereli; a badge szövege az új, opcionális `levelLabel` prop
  (művelet neve), a glyph/`data-level` továbbra is a súlyosság.
- Négy szűrő az URL-ben: `tableName`, `operation`, szerző (a látható sorokból származtatott
  `actorId`-készlet), `from`/`to` (`DatePicker`; a felső korlát a **következő nap** kezdete, mert a
  szerződés `to`-ja inkluzív).
- A fül modulgráfja **nem importál mutációt**, és explicit „csak olvasható” figyelmeztetést mutat.

### URL-hook javítások (a ticketen túl, de nélküle nem működne)

- `useListParams` mostantól **megtartja az idegen query paramétereket**: csak a saját (séma szerinti)
  kulcsait cseréli. Korábban minden lapozó-kattintás eldobta a `?tab=`-ot.
- A tulajdonolt kulcsnevek a **séma shape-jéből** jönnek, nem a parsolt defaultokból — különben a
  `default()` nélküli szűrők (`type`, `status`, `source`, `q`) bennmaradnának a URL-ben egy reset után
  (ezt a meglévő `CustomersPage` teszt fogta meg).
- `useTabParam` opcionális `clearParams`-ot kapott: a fülváltás **ugyanabban az egy írásban** törli a
  lapozó kulcsokat, mert a két lapozott fül osztozik a `page`/`limit` kulcsokon.

### `packages/ui`

- `LogEntryRow`: új, opcionális `levelLabel` prop (default: a beépített súlyossági szó). Nincs új
  komponens, nincs verziótörő változás.

---

## Változott fájlok

| Fájl | Változás |
| --- | --- |
| `apps/admin/src/features/api/use-list-params.logic.ts` | `mergeListParams`, `toOwnedListParamNames` + dokumentáció |
| `apps/admin/src/features/api/use-list-params.ts` | a write a meglévő search paraméterekbe merge-el |
| `apps/admin/src/features/api/use-tab-param.{ts,logic.ts,interface.ts}` | `clearParams` + `applyTabWrite` + `TabWriteOptions` |
| `apps/admin/src/features/customers/customers.const.ts` | gyerek query key-ek, üzenetek, `CUSTOMER_ACTIVITY_FIELD_PATHS` |
| `apps/admin/src/features/customers/customers.interface.ts` | feed/ledger hook- és form-típusok |
| `apps/admin/src/features/customers/use-customer-activities.ts` | **új** — feed olvasás + három write |
| `apps/admin/src/features/customers/use-customer-audit-logs.ts` | **új** — kizárólag olvasás |
| `apps/admin/src/entities/customer/customer.interface.ts` | aktivitás/napló view modellek, diff mező, actor opció |
| `apps/admin/src/entities/customer/customer.const.ts` | típus-/művelet-/tábla-/szerzőfajta-címkék, szint- és variáns-táblák, diff mezőcímkék |
| `apps/admin/src/entities/customer/customer-activity.mapper.ts` | **új** — típus→label/variant, `canEdit`, token |
| `apps/admin/src/entities/customer/customer-audit-log.mapper.ts` | **új** — diff builder, opciók, view model |
| `apps/admin/src/pages/customers/customer-activity.logic.ts` | **új** — form sémák, input builderek, típus-opciók |
| `apps/admin/src/pages/customers/customer-audit-log.logic.ts` | **új** — szűrő-opciók, érték-szűkítők, nap→instant, `LogEntryItem` vetítés |
| `apps/admin/src/pages/customers/customers.const.ts` | a két fül copy-ja, field id-k, `CUSTOMER_TAB_LIST_PARAM_NAMES` |
| `apps/admin/src/pages/customers/customers.interface.ts` | a két fül komponens-propsai |
| `apps/admin/src/pages/customers/ui/CustomerActivityTab.tsx` | **új** — feed + állapotok + lapozó + helyi UI state |
| `apps/admin/src/pages/customers/ui/CustomerActivityForm.tsx` | **új** — jegyzetíró űrlap |
| `apps/admin/src/pages/customers/ui/CustomerActivityFeedItem.tsx` | **új** — sor + akciók (`D-W4`) |
| `apps/admin/src/pages/customers/ui/CustomerActivityEditForm.tsx` | **új** — inline szerkesztő |
| `apps/admin/src/pages/customers/ui/CustomerActivityDeleteDialog.tsx` | **új** — soft delete megerősítés |
| `apps/admin/src/pages/customers/ui/CustomerAuditTab.tsx` | **új** — szűrők + olvasó lista + lapozó |
| `apps/admin/src/pages/customers/ui/CustomerAuditFilters.tsx` | **új** — négy szűrő |
| `apps/admin/src/pages/customers/ui/CustomerAuditLogList.tsx` | **új** — `LogEntryRow` lista |
| `apps/admin/src/pages/customers/ui/customer-tab-panels.tsx` | a két placeholder helyére a két új fül |
| `apps/admin/src/pages/customers/CustomerDetailPage.tsx` | `clearParams` átadása a `useTabParam`-nak |
| `apps/admin/src/test/mocks/handlers/customers.handlers.ts` | activities/audit-logs GET, aktivitás POST/PATCH/DELETE handlerek, default set bővítés |
| `packages/ui/src/components/log-drawer/LogEntryRow.tsx` | `levelLabel` prop használata |
| `packages/ui/src/components/log-drawer/log-drawer.interface.ts` | `levelLabel` prop + dokumentáció |
| `docs/Specs/Customers-Admin-Screens.md` | §3.2 / §3.3 / §10 frissítés, fejléc |
| `docs/Specs/UI-Architecture.md` | §4 `levelLabel`, §5 állapotterv + a két URL-szabály, fejléc |

**Nem változott:** `apps/api`, `packages/shared`, `packages/api-client` — a backend (AIS-177/178) és a
kliens-szolgáltatások már készen álltak; nincs migráció, nincs új függőség, nincs új route.

---

## Tesztek

Új vagy bővített tesztfájlok (mind zöld):

- `features/api/use-list-params.logic.test.ts` (`mergeListParams`, `toOwnedListParamNames`)
- `features/api/use-list-params.test.tsx` (`?tab=` túléli a lapozást és a filter-resetet)
- `features/api/use-tab-param.{logic,}.test.*` (`applyTabWrite`, `clearParams`)
- `entities/customer/customer-activity.mapper.test.ts`, `customer-audit-log.mapper.test.ts`
- `pages/customers/customer-activity.logic.test.ts`, `customer-audit-log.logic.test.ts`
- `features/customers/use-customer-activities.test.tsx`, `use-customer-audit-logs.test.tsx`
- `pages/customers/ui/CustomerActivityTab.test.tsx`, `CustomerAuditTab.test.tsx`
- `pages/customers/CustomerDetailPage.test.tsx` (két új fül + tabváltás törli a lapozást)
- `packages/ui/test/log-entry-row.test.tsx` (`levelLabel` felülírja a súlyossági szót)

---

## Hogyan ellenőrizhető

```bash
pnpm --filter @callback/admin test
pnpm --filter @callback/ui test
pnpm quality
pnpm typecheck
```

Kézi ellenőrzés (helyi stack): `/customers/:id?tab=activity` → lapozás után is `tab=activity` marad;
jegyzet írása után a feed **és** a fejléc „utolsó aktivitás” frissül; `system` soron nincs
szerkesztés/törlés; `?tab=audit` → szűrők az URL-ben, sor kibontása mutatja a `before → after` párokat,
a naplón nincs írási művelet; `?tab=activity&page=3` → `Napló` fülre váltva a `page` eltűnik.

---

## Ismert korlátok / follow-up

- A szerver **nem** ellenőrzi az aktivitás szerzőjét (nincs admin hitelesítés az AIS-73/74 előtt), ezért
  a „saját bejegyzés” szabály kliensoldali (`D-W4`) — ez tudatos, dokumentált állapot.
- A napló szerző-szűrője a **látható sorokból** származik (nincs operátor-névjegyzék endpoint), ezért
  egy adott oldalon nem szereplő szerző nem választható.
- A `metadata` mező nem jelenik meg a feedben (a ticket sorszintű tartalma nem kéri).
