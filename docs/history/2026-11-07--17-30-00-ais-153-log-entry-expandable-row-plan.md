# AIS-153 — lenyitható log sor: terv

**Dátum:** 2026-11-07 17:30 (Europe/Budapest)
**Ticket:** [AIS-153](https://zakzag.atlassian.net/browse/AIS-153) · **Parent:** AIS-143
**Típus:** csak tervezés — kód még nem készült ebben a sessionben.

## Mi történt

- A ticket (subtask) átolvasása után a meglévő `packages/ui` log-drawer primitíva
  feltérképezése: [`log-drawer.interface.ts`](../../packages/ui/src/components/log-drawer/log-drawer.interface.ts:31),
  [`log-drawer.const.ts`](../../packages/ui/src/components/log-drawer/log-drawer.const.ts:1),
  [`log-drawer.logic.ts`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:1),
  [`log-drawer.variants.ts`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:134),
  [`LogEntryRow.tsx`](../../packages/ui/src/components/log-drawer/LogEntryRow.tsx:22),
  [`LogDrawer.tsx`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:85).
- Ellenőrizve, hogy az AIS-151 már szállította a `NotificationEntry.details` mezőt, és hogy a
  [`NotificationHost`](../../packages/notifications/src/react/NotificationHost.tsx:43) az `entries` listát
  **változtatás nélkül** adja tovább a `LogDrawer`-nek — így a `details` strukturálisan átfolyik, a
  `packages/ui` nem importálja a `@callback/notifications`-t, és nem kell semmilyen mapping.
- A terv elkészült: [`docs/plans/2026-11-07--17-18-00-ais-153-log-entry-expandable-row-plan.md`](../plans/2026-11-07--17-18-00-ais-153-log-entry-expandable-row-plan.md).

## Döntések a ticket-en felül

| #  | Döntés                                                                                                                                                    |
| -- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0 | A copy-visszajelzés **gombonként független**: a `requestId` és a `JSON` gomb külön időzítővel vált `Kimásolva`-ra, egymást nem írják felül.                 |
| A1 | A chevron saját, kis cva recipe-et kap (`logEntryChevronVariants`), mert a cva nem tud gyerek-elemet stilizálni — így 3 helyett 4 új recipe lesz, token-only. |
| A2 | Az üres régió szövege `id`-vel ellátott `<p>`, amire a régió `aria-describedby`-jal hivatkozik (ezért kell a `LOG_ENTRY_DETAILS_EMPTY_ID_SUFFIX`).            |

## Állapot

- Git: `634ac27` — `AIS-153: docs(ui): add expandable log row plan` (`main`).
- Jira: `To Do` → **In Progress**, komment a committal és a hatókörrel (comment id `10770`).
- Következő lépés: a 13 lépéses implementációs todo lista végrehajtása (adatmodell → konstansok → logika →
  recipe-ek → `copyText` → mock-ok → `LogEntryRow` → tesztek → exportok → docs → ellenőrzés).

## Nem része ennek a lépésnek

- `LogDrawer` prop-változás, emelt állapot, store, URL-állapot.
- `HttpEvent` → `details` mapping (AIS-152) és toast-megjelenítés.
