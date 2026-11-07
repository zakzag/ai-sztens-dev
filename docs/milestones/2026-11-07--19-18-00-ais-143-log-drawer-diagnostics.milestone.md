# Log drawer mint diagnosztikai felület (AIS-143)

**Ticket:** AIS-143 (+ AIS-150, 151, 152, 153, 163, 154) · **Dátum:** 2026-11-07

## 1. Probléma / feature

A jobbról becsúszó log panel szélessége fix volt (`max-w-[26rem]`), a sorok statikusak, és a
rendelkezésre álló diagnosztikai adat nagy része **elveszett**: `requestId`, mezőnkénti `issues[]`,
query string, válasz-`meta`, body-prefix nem jutott el a logba; a hiba `detail` egyetlen összelapított
string volt. A story célja: húzható panel + minden bejegyzés kinyitható, strukturált részletekkel, és
(AIS-163) a JSON-mezők kibontható pretty JSON-nal.

## 2. Bizonyíték / kiindulás

| Tény                                                                                | Következmény                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `LogDrawer` fix `w-full max-w-[26rem]`, nincs fogantyú                              | hosszú értékek olvashatatlanul tördelődtek                     |
| `LogEntryRow` statikus, `LogEntryItem` = `{id, level, message, detail?, createdAt}` | a store többet tudott, mint amit meg tudott jeleníteni         |
| `HttpEvent = {method, path, status, durationMs, outcome}`                           | a `requestId` csak a szerver logban élt                        |
| A hover-resize hiba: a szélesség `window.innerWidth - clientX`-ből számolt          | scrollbar-szélességnyi túllövés + „rácsúszás” a `min`/`max`-ra |
| 200 bejegyzés × részletek a `sessionStorage`-ban                                    | kvóta-kockázat                                                 |

## 3. Root cause / design rationale

| Döntés                                                                         | Miért                                                                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A szélesség a `useLogDrawer` controllerben + `localStorage`, **nem** store/URL | UI-preferencia, ami reloadot túlél; a `packages/ui` presenter marad                                 |
| A húzás deltájából számolt szélesség, `pointerId`-hoz kötött gesztus           | a hover is `pointermove`; a viewport-élhez horgonyzás minden lépésnél túllőtt                       |
| `details[]` a `detail` mellett (nem annak parse-olása)                         | a string-parse törékeny; strukturált mezőből lesz kulcs–érték lista és copy-JSON                    |
| A `details` guard bővítése `v1` alatt (nem verzióemelés)                       | a régi payload továbbra is betölthető; egy hibás elem viszont az egészet eldobja (all-or-nothing)   |
| A query string whitelist nélkül, a body csak maszkolt prefix                   | diagnózis vs. privacy/kvóta egyensúlya; a token soha nem kerül az eseménybe                         |
| Sor-nyitottság és JSON-kibontás komponens-lokális `useState`                   | state-döntési sor 4. szintje: nem linkelhető, nem szerver-adat, nincs második fogyasztó             |
| `<button aria-expanded aria-controls>` + `role="region"`, nem `<details>`      | a `<summary>` nem stílusozható a token-recipe-ekkel, a copy gombok fókuszsorrendje kiszámíthatatlan |
| JSON-detektálás `JSON.parse` + object/array, nem címke-lista                   | új JSON-mező nem felejthető el; primitív (`42`, `true`) nem kap lenyitót                            |

## 4. Megoldás

| Fájl                                                            | Változás                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/ui/.../log-drawer/LogDrawer.tsx`                      | resize separator (pointer capture + billentyűzet), width CSS-változó    |
| `…/LogEntryRow.tsx`                                             | fejléc-gomb, részletek-régió (`dl`/`dt`/`dd`), copy gombok, JSON toggle |
| `…/log-drawer.{interface,const,logic,variants}.ts`              | új típusok, konstansok, tiszta logika, token-recipe-ek                  |
| `packages/ui/src/lib/{copy-text,json.const,json.logic}.ts`      | vágólap + pretty JSON helperek (egyetlen mellékhatás-pont)              |
| `packages/notifications/core/*`                                 | `details` modell, redakció, limitek, storage guard                      |
| `packages/notifications/react/*`                                | `useLogDrawer` width + `localStorage` adapter, host propok              |
| `packages/api-client/http-client.ts`                            | `HttpEvent`: `requestId`, `query`, `bodyPreview`, `responseMeta`        |
| `apps/admin/app/notifications/*`                                | `details` mapping, `operation` címke, `issues[]` soronként              |
| `docs/Specs/UI-Architecture.md`, `docs/Specs/API-Convention.md` | primitív sorok, §5 state plan, §7 dependency-jegyzet, 4. tier táblázat  |

## 5. Eredmény és hogyan ellenőrizhető

```bash
pnpm test        # 2229 teszt zöld (shared 335, api-client 222, notifications 270, ui 479, admin 490, api 433)
pnpm typecheck   # 7/7
pnpm lint        # web, api, admin
pnpm build       # 7/7
pnpm quality     # 0 violation
```

Kézi ellenőrzés (böngésző, `pnpm dev`): a panel húzható és a korlátok között marad, reload után
visszaáll; egy `GET /api/api-keys` sora kinyitva mutatja a metódust, path-t, query-t, státuszt,
válaszidőt, `requestId`-t, válasz-`meta`-t és az `operation`-t; egy `422` sora mezőnkénti `issues[]`-t;
a `queryKey` mellett `JSON kibontása` gomb indentált JSON-t ad; a copy gombok a vágólapra írnak; a
`requestId` egyezik a szerver log sorával. **A böngészős checklist ebben a lezárásban nem futott le**
(agent nem vezérel böngészőt) — a lépések a `docs/history/2026-11-07--19-18-00-ais-143-log-drawer-improvement.md`-ben.

## 6. Follow-up

- Manuális QA végrehajtása és a `requestId` ⇄ szerver log egyeztetés dokumentálása.
- Korrelációs id a HTTP sor és a query/mutation hiba sor között (külön ticket).
- Build info (verzió/commit) a panel fejlécében (külön ticket).
- Önálló `JsonValue` primitíva + `DescriptionList`-bekötés, ha más oldal is JSON-t mutat.
