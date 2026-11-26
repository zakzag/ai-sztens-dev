# AIS-163 — JSON mezőértékek lenyitása a log sorban

**Dátum:** 2026-11-07 18:26 (Europe/Budapest)
**Ticket:** [AIS-163](https://zakzag.atlassian.net/browse/AIS-163) · **Parent:** AIS-143
**Terv:** [`docs/plans/2026-11-07--18-03-00-ais-163-json-detail-expand-plan.md`](../plans/2026-11-07--18-03-00-ais-163-json-detail-expand-plan.md)

## Mit szállítottunk

A lenyitott log sor részletek-régiójában a JSON-t tartalmazó mezőérték (`queryKey`, `mutationKey`,
`body`, `responseMeta`) **megtartja a tárolt egysoros stringet**, és kap egy kis `JSON kibontása` /
`JSON összecsukása` gombot, ami indentált, pretty JSON-t mutat egy korlátozott magasságú blokkban.
Nem JSON értéknél (szám, boolean, sima szöveg) nincs gomb.

## Változott fájlok

| Fájl                                                                                               | Változás                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`lib/json.const.ts`](../../packages/ui/src/lib/json.const.ts:1)                                   | új: `JSON_PRETTY_INDENT = 2`, `NO_EXPANDED_JSON`                                                                               |
| [`lib/json.logic.ts`](../../packages/ui/src/lib/json.logic.ts:1)                                   | új: `toPrettyJson`, `isJsonDetailValue` (csak object/array, soha nem dob)                                                      |
| [`log-drawer.const.ts`](../../packages/ui/src/components/log-drawer/log-drawer.const.ts:246)       | `LOG_DETAIL_JSON_TOGGLE_LABEL_OPEN/CLOSE`, `LOG_DETAIL_JSON_REGION_ID_SUFFIX`                                                  |
| [`log-drawer.variants.ts`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:225) | `logDetailJsonToggleVariants`, `logDetailJsonPreVariants` + típusok                                                            |
| [`LogEntryRow.tsx`](../../packages/ui/src/components/log-drawer/LogEntryRow.tsx:70)                | `expandedJson` Set state, mezőnkénti toggle + `hidden` `<pre>`, `data-log-detail-value` a value spanen, sor becsukásakor reset |
| [`index.ts`](../../packages/ui/src/index.ts:296)                                                   | a json logika/konstansok + 2 recipe + 2 típus exportja                                                                         |
| [`test/json.logic.test.ts`](../../packages/ui/test/json.logic.test.ts:1)                           | új: 18 eset (objektum, tömb, beágyazott, primitívek, parse hiba, determinizmus)                                                |
| [`test/log-entry-row.test.tsx`](../../packages/ui/test/log-entry-row.test.tsx:418)                 | +7 eset, a meglévő value-assert `[data-log-detail-value]`-ra állítva                                                           |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:103)                         | AIS-163 bekezdés, `LogEntryRow` sor, §5 „Row expansion" sor                                                                    |

## Eltérések a tervtől (dokumentálva)

| #   | Terv                                                 | Megvalósult                                                                         | Miért                                                                                                                                                                                                   |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `LOG_DETAIL_JSON_INDENT` a `log-drawer.const.ts`-ben | `JSON_PRETTY_INDENT` a `lib/json.const.ts`-ben                                      | A formázó `lib/` helper, a `lib` pedig nem importálhat `components`-ből (réteg-szabály). Ugyanitt él a `NO_EXPANDED_JSON` üres halmaz is.                                                               |
| 2   | a `dd` szövege változatlan                           | a `dd` egy `<span data-log-detail-value>`-ba került, mellette a toggle és a `<pre>` | A toggle és a pretty blokk nem lehet a `dd`-n kívül (`<dl>` csak `dt`/`dd`/`div` gyereket enged), a `dd.textContent` viszont már nem csak az érték — a meglévő teszt ezért a data-attribútumra állt át. |

## Döntések

| #   | Döntés                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Csak a log drawerben (user döntés): a logika `lib/`-ben van, önálló `JsonValue` primitíva nincs.                                           |
| B   | A pretty print csak megjelenítés: a tárolt `details`, a `detail` egysoros és a `toEntryJson` payload változatlan.                          |
| C   | Primitív érték nem JSON → nincs gomb (különben minden szám és `true` kapna lenyitót).                                                      |
| D   | A kibontás komponens-lokális `ReadonlySet<string>`, kulcsa `` `${label}-${index}` ``; a sor becsukásakor `NO_EXPANDED_JSON`-ra áll vissza. |
| E   | `<pre>`: `max-h-48 overflow-auto whitespace-pre` — görget, nem nyújtja szét a panelt.                                                      |
| F   | Parse hiba → `null` → nincs gomb, nincs konzolzaj, nincs kivétel.                                                                          |

## Ellenőrzés

- `pnpm --filter @callback/ui test` → **479/479 zöld** (46 fájl): `json.logic` 18, `log-entry-row` 26,
  `log-drawer` 45 (regresszió), `log-drawer.logic` 35.
- `pnpm --filter @callback/ui typecheck`, `pnpm typecheck`, `pnpm quality` → zöld.

## Nem része

Önálló `JsonValue` primitíva és `DescriptionList`-bekötés; a `detail` egysoros parse-olása; a store-ban
tárolt `details` alak átírása.
