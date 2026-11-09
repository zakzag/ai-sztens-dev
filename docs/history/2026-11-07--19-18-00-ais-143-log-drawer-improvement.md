# AIS-143 — log drawer: resize + lenyitható részletek + JSON kibontás (story lezárás)

**Dátum:** 2026-11-07 19:18 (Europe/Budapest)
**Ticket:** [AIS-143](https://zakzag.atlassian.net/browse/AIS-143) · **Lezáró subtask:** AIS-154
**Story terv:** [`docs/plans/2026-11-07--19-18-00-ais-143-log-drawer-resize-and-details-plan.md`](../plans/2026-11-07--19-18-00-ais-143-log-drawer-resize-and-details-plan.md)

## Mit szállított a story

| Subtask | Eredmény                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AIS-150 | a panel szélessége egérrel húzható (320–720 px, default 416), billentyűzettel is (`role="separator"`, `←/→`, `Shift`, `Home`/`End`, dupla klikk reset), `localStorage`-ban perzisztálva; a hover-resize hiba javítva (a szélesség a húzás deltájából számol) |
| AIS-151 | `NotificationEntry.details[]` (`{label, value, mono?}`): redakció, mezőszám- és hossz-limitek, `sessionStorage` guard bővítése `v1` alatt                                                                                                                    |
| AIS-152 | `HttpEvent` négy új mezője (`requestId`, `query`, maszkolt `bodyPreview`, `responseMeta`) + admin `details` mapping (operation címke, `issues[]` soronként)                                                                                                  |
| AIS-153 | a `LogEntryRow` kinyitható: `aria-expanded`/`aria-controls`, `dl`/`dt`/`dd` régió, `hidden` csukva, copy `requestId` / `JSON` gomb, multi-open                                                                                                               |
| AIS-163 | a JSON mezőértékek kibonthatók indentált pretty JSON-ra (`toPrettyJson`, mezőnkénti toggle)                                                                                                                                                                  |

## Fájlonkénti összefoglaló

| Fájl                                                                                                                                                                  | Változás                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/ui/src/components/log-drawer/LogDrawer.tsx`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:85)                                                 | resize separator (pointer capture, billentyűzet), width CSS-változó; a sorok prop-változása nélkül                                                           |
| [`…/LogEntryRow.tsx`](../../packages/ui/src/components/log-drawer/LogEntryRow.tsx:70)                                                                                 | fejléc-`<button>`, részletek-régió, copy gombok, JSON toggle; minden állapot komponens-lokális                                                               |
| [`…/log-drawer.interface.ts`](../../packages/ui/src/components/log-drawer/log-drawer.interface.ts:31)                                                                 | `LogDetailField`, `LogEntryItem.details`, `LogEntryCopyTarget/Flags`, `LogEntryJson`, `LogDrawerSizeRange`, `LogDrawerDragAnchor`                            |
| [`…/log-drawer.const.ts`](../../packages/ui/src/components/log-drawer/log-drawer.const.ts:1)                                                                          | width korlátok/lépések, separator label, entry detail/copy/JSON labellek + id suffixek                                                                       |
| [`…/log-drawer.logic.ts`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:1)                                                                          | `clampDrawerWidth`, `toWidthFromDrag`, `toWidthFromKey`, `toWidthStyle`, `toLogDrawerHandleLabel`, `toEntryToggleLabel`, `toEntryJson`, `findRequestIdField` |
| [`…/log-drawer.variants.ts`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:1)                                                                    | panel/handle/separator/row/toggle/chevron/details/detail-field/JSON recipe-ek (token-only)                                                                   |
| [`packages/ui/src/lib/copy-text.ts`](../../packages/ui/src/lib/copy-text.ts:1)                                                                                        | guarded `navigator.clipboard`, csendes degradáció                                                                                                            |
| [`packages/ui/src/lib/json.logic.ts`](../../packages/ui/src/lib/json.logic.ts:1)                                                                                      | `toPrettyJson`, `isJsonDetailValue` (csak object/array, soha nem dob)                                                                                        |
| [`packages/notifications/src/core/notification.{interface,const,logic,store,storage.logic}.ts`](../../packages/notifications/src/core/notification.logic.ts:1)        | `details` adatmodell, `toDetailFields`/`clampDetailFields`, redakció, limitek, storage guard                                                                 |
| [`packages/notifications/src/react/{use-notifications,log-drawer-width.storage,NotificationHost}.tsx`](../../packages/notifications/src/react/use-notifications.ts:1) | `width` + perzisztencia a controllerben, host propok                                                                                                         |
| [`packages/api-client/src/http-client.ts`](../../packages/api-client/src/http-client.ts:1)                                                                            | `HttpEvent` négy új mezője + emit                                                                                                                            |
| [`apps/admin/src/app/notifications/*`](../../apps/admin/src/app/notifications/notification-events.logic.ts:1)                                                         | `details` mapping, `operation` fallback, konstansok                                                                                                          |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1)                                                                                              | primitív sorok, §5 state plan, §7 „nincs új dependency” bekezdés                                                                                             |
| [`docs/Specs/API-Convention.md`](../../docs/Specs/API-Convention.md:333)                                                                                              | 4. (log drawer) tier részletes táblázata                                                                                                                     |

## Döntések (a story szintjén)

| Döntés                                                                      | Miért                                                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Query string **whitelist nélkül** a logban                                  | diagnosztikai érték; a token/`Authorization` soha nem kerül az eseménybe, a redakció a store egyetlen belépőjén fut |
| Request body **csak maszkolt, csonkolt prefix**                             | a teljes body privacy- és kvóta-kockázat; a prefix elég a diagnózishoz                                              |
| **Nincs** korrelációs id a HTTP sor és a query/mutation hiba sor között     | a `requestId` mindkettőben ott van, ez a gyakorlati kapocs; a közös id külön ticket                                 |
| **Nincs** build info a panel fejlécében                                     | külön, kis ticket                                                                                                   |
| A JSON kibontás **csak megjelenítés**                                       | a tárolt `details`, a `detail` egysoros és a copy-JSON payload marad a valóság                                      |
| Se szélesség, se sor-nyitottság, se JSON-kibontás nem kerül store-ba/URL-be | state-döntési sor: URL → Query → store → `useState`; mindhárom egy komponens saját interakciója                     |

## Regresszió (AIS-154)

| Parancs          | Eredmény                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm test`      | **2229 teszt zöld** — shared 335, api-client 222, notifications 270, ui 479, admin 490, api 433    |
| `pnpm typecheck` | 7/7 workspace tiszta                                                                               |
| `pnpm lint`      | `apps/web`, `apps/api`, `apps/admin` tiszta (nincs ESLint a `packages/ui`-ban)                     |
| `pnpm build`     | 7/7 workspace buildelt (shared, ui, api-client, notifications, web, api, admin)                    |
| `pnpm quality`   | layers 112 modul / 180 dependency, dead-code (knip), palette, field-errors, docs — **0 violation** |

## Manuális QA — **NEM futott le**

Az agent nem tud böngészőt vezérelni, ezért a böngészős checklist **nem igazolt**. Az alábbi lépések
végrehajtása és az eredmény rögzítése emberi feladat (a story DoD-ja ezt kéri, D-B döntés):

| #   | Lépés                                                         | Elvárt                                                                            |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `pnpm dev` → admin → log drawer fogantyú húzása               | 320 px alá és 720 px fölé nem megy; húzás közben nincs „utánacsúszás”             |
| 2   | `Home`/`End`/`←`/`→`/`Shift`+nyíl, dupla klikk                | ugrás a korlátokra, illetve vissza a 416 px default-ra                            |
| 3   | reload, majd privát mód / letiltott storage                   | a szélesség visszaáll; letiltott storage mellett csendben default, nincs hiba     |
| 4   | keskeny viewport (`< md`)                                     | full-width panel, fogantyú nélkül                                                 |
| 5   | sikeres `GET /api/api-keys` sor kinyitása                     | metódus, path, query, státusz, válaszidő, `requestId`, válasz-`meta`, `operation` |
| 6   | `POST` (create) kinyitása                                     | a body **csak prefixe**, a titok nem teljes hosszában                             |
| 7   | `422` mezőhiba kinyitása                                      | `issues[]` mezőnként, `code`, `requestId`, `url` a query stringgel                |
| 8   | offline hálózati hiba                                         | „hálózati hiba” + `requestId: null`                                               |
| 9   | szándékosan dobott komponens (DEV)                            | stack látszik; PROD buildben nem                                                  |
| 10  | `queryKey` mező `JSON kibontása` gombja                       | indentált, 2 space-es JSON; újra kattintva csuklik; a `url` mezőn nincs gomb      |
| 11  | copy `requestId`, copy JSON                                   | a vágólapra kerül a várt szöveg / a `toEntryJson` kimenete                        |
| 12  | a log sora ⇄ szerver log                                      | a `requestId` egyezik (pl. `PATCH /api/api-keys/… -> 422 (requestId=…)`)          |
| 13  | szűrő chipek, „Korábbiak betöltése”, „Törlés”, 200+ bejegyzés | változatlanul működik, a panel nem akad                                           |

A 12. pont konkrét `requestId` párosítása (log sora ⇄ szerver log sora) szintén emberi ellenőrzést
igényel, mert futó stack és szerver-log hozzáférés kell hozzá; a repóban erre nincs e2e harness.

## Nyitott pontok

- Manuális QA (fenti tábla) — emberi végrehajtás.
- A `requestId` ⇄ szerver log egyeztetés konkrét példája a QA során kerül a jegyzetbe.
- AIS-153 / AIS-163 „In Review” státuszban; a story lezárása ezek review-ja után lehetséges.
