# AIS-153 — lenyitható log sor: implementáció

**Dátum:** 2026-11-07 17:36 (Europe/Budapest)
**Ticket:** [AIS-153](https://zakzag.atlassian.net/browse/AIS-153) · **Parent:** AIS-143
**Terv:** [`docs/plans/2026-11-07--17-18-00-ais-153-log-entry-expandable-row-plan.md`](../plans/2026-11-07--17-18-00-ais-153-log-entry-expandable-row-plan.md)

## Mit szállítottunk

A `LogEntryRow` minden sora kinyithatóvá vált: a fejléc kattintásra (és `Enter`/`Space`-szel) nyit egy
`role="region"` részletek-régiót, ami a `details` tömböt `dl`/`dt`/`dd` kulcs–érték listaként mutatja,
plusz két copy gombot (`requestId`, `JSON`). Egyszerre bármennyi sor nyitható, alapból minden csukva.

## Változott fájlok

| Fájl                                                                                                | Változás                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`log-drawer.interface.ts`](../../packages/ui/src/components/log-drawer/log-drawer.interface.ts:31) | `LogDetailField`, `LogEntryItem.details?`, `LogEntryCopyTarget`, `LogEntryCopyFlags`, `LogEntryJson`                                                                |
| [`log-drawer.const.ts`](../../packages/ui/src/components/log-drawer/log-drawer.const.ts:152)        | 12 új `LOG_ENTRY_*` konstans (toggle/region/empty label, id suffixek, copy szövegek, `LOG_ENTRY_COPY_FEEDBACK_MS = 2000`, `LOG_ENTRY_COPY_IDLE`, `requestId` címke) |
| [`log-drawer.logic.ts`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:151)        | `toEntryToggleLabel`, `toEntryJson`, `findRequestIdField` — mind tiszta                                                                                             |
| [`log-drawer.variants.ts`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:152)  | `logEntryToggleVariants`, `logEntryChevronVariants`, `logEntryDetailsVariants`, `logDetailFieldVariants` + típusok, csak token osztályok                            |
| [`lib/copy-text.ts`](../../packages/ui/src/lib/copy-text.ts:1)                                      | új: guarded `navigator.clipboard`, `try/catch`, `Promise<boolean>`                                                                                                  |
| [`LogEntryRow.tsx`](../../packages/ui/src/components/log-drawer/LogEntryRow.tsx:61)                 | lokális `isOpen`, `aria-expanded`/`aria-controls`/`role="region"`, `hidden` csukva, üres állapot, copy sáv gombonkénti visszajelzéssel                              |
| [`index.ts`](../../packages/ui/src/index.ts:294)                                                    | explicit exportok az új típusokra, konstansokra, logikára, `copyText`-re és recipe-ekre                                                                             |
| [`LogDrawer.tsx`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:85)                     | **nem változott** — nincs új prop, nincs emelt állapot                                                                                                              |
| [`test/mocks/log-entries.mock.ts`](../../packages/ui/test/mocks/log-entries.mock.ts:46)             | `buildLogDetailField`, `buildLogDetails`, `LOG_ENTRY_REQUEST_ID_VALUE`                                                                                              |
| [`test/mocks/clipboard.mock.ts`](../../packages/ui/test/mocks/clipboard.mock.ts:1)                  | új: `stubClipboard`, `stubClipboardMissing`                                                                                                                         |
| [`test/log-drawer.logic.test.ts`](../../packages/ui/test/log-drawer.logic.test.ts:161)              | +3 describe: `toEntryToggleLabel`, `toEntryJson`, `findRequestIdField`                                                                                              |
| [`test/log-entry-row.test.tsx`](../../packages/ui/test/log-entry-row.test.tsx:1)                    | 5 → 19 eset (nyitás/zárás, multi-open, üres állapot, mono, copy függetlenség, hibaágak)                                                                             |
| [`test/log-drawer.test.tsx`](../../packages/ui/test/log-drawer.test.tsx:597)                        | +1 eset: két bejegyzés, mindkettő kinyitva                                                                                                                          |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:95)                           | `LogEntryRow` primitíva-sor, §5 „Row expansion" sor, AIS-153 összefoglaló bekezdés                                                                                  |

## Döntések (a ticket D-A…D-F mellett)

| #   | Döntés                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0  | A copy-visszajelzés **gombonként független**: külön `Record<LogEntryCopyTarget, boolean>` flag és külön időzítő jegyzet a `useRef` mapben, így az egyik gomb `Kimásolva` felirata nem írja felül a másikat. |
| A1  | A chevron saját recipe-et kapott (`logEntryChevronVariants`), mert a cva csak a saját elemét tudja variánsolni, gyerek-elemet nem.                                                                          |
| A2  | Az üres régió szövege `id`-vel ellátott `<p>`, amire a régió `aria-describedby`-jal hivatkozik.                                                                                                             |

## Tanulság a tesztelésből

A `hidden` régió **accessible name nélkül** jelenik meg a DOM-ban: az accname algoritmus üres stringet ad
a fán kívüli csomópontra, ezért `getByRole('region', { name, hidden: true })` sosem találja meg a csukott
régiót. A teszt ezért a csukott állapotban `[role="region"]`-t kérdez le, és külön assertálja a
`role`/`aria-label`/`hidden` attribútumokat. Ugyanezért nem használhatunk `findBy*`-ot a fake-timeres
tesztekben: a `waitFor` pollozása valós időzítőre épül.

## Ellenőrzés

- `pnpm --filter @callback/ui test` → **454/454 zöld** (45 fájl), ebből `log-entry-row` 19,
  `log-drawer` 45, `log-drawer.logic` 35.
- `pnpm --filter @callback/ui typecheck` → tiszta.

## Nem része ennek a lépésnek

- `HttpEvent` → `details` mapping (AIS-152) és toast-megjelenítés.
- Store-, URL- vagy globális állapot a sor nyitottságára.
