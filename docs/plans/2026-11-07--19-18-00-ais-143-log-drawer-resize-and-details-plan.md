# AIS-143 — Log drawer: átméretezhető panel + lenyitható bejegyzés-részletek (story terv)

**Ticket:** [AIS-143](https://zakzag.atlassian.net/browse/AIS-143)
**Állapot:** implementálva, lezárás alatt (AIS-154)
**Ez a dokumentum** a story-szintű ernyőterv: a hatókört, a döntéseket és a subtask-bontást rögzíti.
A részletes, fájlszintű tervek a subtaskokhoz tartozó plan dokumentumok (lásd a táblát lentebb); ez a
fájl a lezáró ticket (AIS-154) alatt készült el, hogy a story egy helyen is olvasható legyen.

## Cél

1. a log drawer panel **szélessége egérrel és billentyűzettel** állítható legyen, korlátokkal és
   perzisztált értékkel;
2. **minden bejegyzés kinyitható** legyen, a részletei strukturált kulcs–érték listában
   (API kérés / hiba / runtime), a request body csak a csonkolt **prefixével**, a query string teljesen;
3. a **JSON-t tartalmazó mezőértékek** (AIS-163, menet közben felvett igény) maradjanak egysoros
   stringként, de legyenek kibonthatók indentált, pretty JSON-ra.

## Subtask-bontás

| Ticket  | Hatókör                                                                                                                                | Plan                                                                                                                                                                                                                                               | Állapot   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| AIS-150 | `packages/ui` + `packages/notifications/react`: átméretezhető panel (320–720 px, default 416, `localStorage`, hover-resize fix)        | [`2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md`](2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md) + [`…15-05-00-log-drawer-hover-resize-fix-plan.md`](2026-11-07--15-05-00-log-drawer-hover-resize-fix-plan.md) | Done      |
| AIS-151 | `packages/notifications/core`: `details` mező, redakció, limitek, `sessionStorage` guard                                               | [`2026-11-07--15-29-00-ais-151-notification-detail-fields-plan.md`](2026-11-07--15-29-00-ais-151-notification-detail-fields-plan.md)                                                                                                               | Done      |
| AIS-152 | `packages/api-client` + `apps/admin`: `HttpEvent` bővítés (`requestId`, `query`, `bodyPreview`, `responseMeta`) és a `details` mapping | [`2026-11-07--15-25-00-ais-152-http-event-details-plan.md`](2026-11-07--15-25-00-ais-152-http-event-details-plan.md)                                                                                                                               | Done      |
| AIS-153 | `packages/ui`: lenyitható log sor (`aria-expanded`, `dl`/`dt`/`dd`, copy gombok)                                                       | [`2026-11-07--17-18-00-ais-153-log-entry-expandable-row-plan.md`](2026-11-07--17-18-00-ais-153-log-entry-expandable-row-plan.md)                                                                                                                   | In Review |
| AIS-163 | `packages/ui`: JSON mezőértékek kibontása pretty JSON-ra                                                                               | [`2026-11-07--18-03-00-ais-163-json-detail-expand-plan.md`](2026-11-07--18-03-00-ais-163-json-detail-expand-plan.md)                                                                                                                               | In Review |
| AIS-154 | lezárás: spec-konzisztencia, history, milestone, teljes regresszió, manuális QA                                                        | ez a fájl                                                                                                                                                                                                                                          | In Review |

## Kulcsdöntések

| #      | Döntés                                                                                                                                                | Hol van részletezve |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D1–D2  | resize egérrel **és** billentyűzettel (`role="separator"`, `aria-valuenow/min/max`, `←/→`, `Home`/`End`, dupla klikk reset)                           | AIS-150 plan        |
| D3–D4  | a szélesség a `useLogDrawer` controllerben él, `localStorage`-ban (`aisztens.logdrawer.width.v1`), injektált `StorageLike`-lal, csendes degradációval | AIS-150 plan        |
| D5–D6  | `md` alatt full-width; húzás közben nincs transform-animáció                                                                                          | AIS-150 plan        |
| D7–D8  | bármennyi sor nyitható, alapból minden csukva; saját `button` + `aria-controls` régió, nem `<details>`                                                | AIS-153 plan        |
| D9–D12 | `detail` marad egysoros; új `details[]` (`{label, value, mono?}`); guard bővítése `v1` alatt; limitek konstansból                                     | AIS-151 plan        |
| D13    | `HttpEvent` bővül (`requestId`, `query`, `bodyPreview`, `responseMeta`) — a query string **whitelist nélkül**, a body csak maszkolt prefix            | AIS-152 plan        |
| D14    | nincs korrelációs id a HTTP sor és a query/mutation hiba sor között (a `requestId` a gyakorlati kapocs)                                               | AIS-152 plan        |
| D15    | build info (verzió/commit) nem része a storynak                                                                                                       | AIS-143 leírás      |
| D16    | JSON-detektálás **tartalom-alapú** (`JSON.parse` + csak object/array); a pretty print csak megjelenítés                                               | AIS-163 plan        |

## Rétegek és érintett fájlok

| Réteg                    | Fájlok                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui`            | `components/log-drawer/*` (`LogDrawer.tsx`, `LogEntryRow.tsx`, interface/const/logic/variants), `lib/copy-text.ts`, `lib/json.{const,logic}.ts`, `index.ts` |
| `packages/notifications` | `core/*` (`details` normalizálás, redakció, storage guard), `react/*` (`useLogDrawer` width + storage, `NotificationHost`)                                  |
| `packages/api-client`    | `http-client.ts` / `http-client.interface.ts` (`HttpEvent` mezők + emit)                                                                                    |
| `apps/admin`             | `app/notifications/*` (details mapping, `operation` címke, konstansok)                                                                                      |
| docs                     | `docs/Specs/UI-Architecture.md`, `docs/Specs/API-Convention.md`, `docs/plans/`, `docs/history/`, `docs/milestones/`                                         |

## Lépések (függőségi sorrend)

1. AIS-151 (core adatmodell) → 2. AIS-152 (transport + admin mapping) → 3. AIS-150 (resize, független) →
2. AIS-153 (lenyitható sor) → 5. AIS-163 (JSON kibontás) → 6. AIS-154 (lezárás).
   A UI-oldal (4–5) az adatmodell (1) után indítható, a transport (2) nélkül is fejleszthető.

## Kockázatok és mitigáció

| Kockázat                                                                     | Mitigáció                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A meglévő drawer-tesztek (44 eset) törnek a sor szerkezetének átalakításától | A csukott sor külseje változatlan; a meglévő esetek regressziós kapu, a szükséges assert-eket egy helyen igazítottuk                                       |
| `sessionStorage` kvóta a `details` + stack + body-prefix mellett             | `NOTIFICATION_DETAIL_*` limitek + mezőszám-cap; a guard all-or-nothing marad, a régi payload betölthető                                                    |
| Privacy: body/query a logban                                                 | csak maszkolt, csonkolt body-prefix; a query whitelist nélkül, de a token/`Authorization` soha nem kerül az eseménybe; redakció a store egyetlen belépőjén |
| A hover-resize „utánacsúszás” hibája                                         | a szélesség a húzás deltájából számol, a gesztus `pointerId`-hoz kötött (külön javítás + teszt)                                                            |
| JSON-mezők olvashatatlanok a régióban                                        | AIS-163 kibontható pretty JSON, korlátozott magassággal                                                                                                    |

## Nem része

Korrelációs id (D14), build info (D15), szöveges kereső/szűrő a logban, „open all / close all”,
virtuális lista, teljes request/response body, `apps/web` bekötése, önálló `JsonValue` primitíva.

## Ellenőrzés (AIS-154)

```bash
pnpm test        # shared 335, api-client 222, notifications 270, ui 479, admin 490, api 433
pnpm typecheck   # 7/7 workspace
pnpm lint        # web, api, admin — tiszta
pnpm build       # 7/7 workspace
pnpm quality     # layers, dead-code, palette, field-errors, docs — 0 violation
```

A manuális QA checklist (drawer húzás, reload, 422/offline/runtime bejegyzés, copy, `requestId`
egyeztetés a szerver loggal) a `docs/history/` bejegyzésben, szövegesen rögzítve (D-B) — böngészős
lépések, ezért emberi végrehajtást igényelnek.
