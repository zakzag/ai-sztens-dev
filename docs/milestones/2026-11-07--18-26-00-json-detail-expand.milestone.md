# JSON mezőértékek lenyitása a log sorban

**Ticket:** AIS-163 · **Parent:** AIS-143 · **Dátum:** 2026-11-07

## 1. Probléma / feature

Az AIS-152 óta a log bejegyzés `details` tömbje JSON-t is hordoz (`queryKey`, `mutationKey`, `body`,
`responseMeta`), de a részletek-régió ezt egyetlen, hosszú, tördelhetetlen stringként mutatta:
`["api-keys","update"]`, `{"name":"first"}`. Kérés: maradjon a string, de legyen **kinyitható**, és
kinyitva **indentált, pretty JSON** látszódjon.

## 2. Kiindulás

| Tény                                                                                  | Következmény                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| a store minden `details.value`-t **stringként** tárol (redakció + csonkolás, AIS-151) | a parse a megjelenítés rétegében történik, a store érintetlen          |
| a `dd` a `dl` gyereke, ami csak `dt`/`dd`/`div` elemet enged                          | a toggle és a pretty blokk a `dd` **belül** kap helyet                 |
| `JSON.parse('42')` sikeres                                                            | a „JSON” kritérium nem a parse sikeressége, hanem a **container** volt |

## 3. Design rationale

| Döntés                                                                   | Miért                                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Tartalom-alapú detektálás (`JSON.parse` + object/array), nem címke-lista | egy új JSON-os mező nem felejthető el; a címke-lista karbantartást igényelne                               |
| Primitív (`42`, `true`, `"x"`, `null`) → nincs gomb                      | különben minden státuszkód és minden boolean kapna egy felesleges lenyitót                                 |
| Pretty print **csak megjelenítés**                                       | a tárolt alak, a `detail` egysoros és a „copy JSON” payload ne változzon — a debug-adat maradjon a valóság |
| Megzőnkénti, lokális `Set`                                               | mezőnként független kibontás; nem store, nem URL, nem perzisztált (state-döntési sor 4. szintje)           |
| `lib/json.const.ts` a `JSON_PRETTY_INDENT`-nek                           | a `lib` nem importálhat `components`-ből, a formázó viszont `lib` helper                                   |
| `<pre>` `max-h-48 overflow-auto`                                         | nagy tömb/body görgethető, nem nyújtja szét a panelt                                                       |

## 4. Implementáció

- `lib/json.const.ts` (új): `JSON_PRETTY_INDENT = 2`, `NO_EXPANDED_JSON`.
- `lib/json.logic.ts` (új): `toPrettyJson(value): string | null`, `isJsonDetailValue(value): boolean`;
  parse hiba és primitív → `null`, soha nem dob.
- `log-drawer.const.ts`: `LOG_DETAIL_JSON_TOGGLE_LABEL_OPEN/CLOSE`, `LOG_DETAIL_JSON_REGION_ID_SUFFIX`.
- `log-drawer.variants.ts`: `logDetailJsonToggleVariants`, `logDetailJsonPreVariants` (token-only).
- `LogEntryRow.tsx`: `expandedJson` `ReadonlySet<string>` state (kulcs: `label-index`), a `dd` egy
  `<span data-log-detail-value>` + opcionális toggle (`aria-expanded`/`aria-controls`) + `hidden` `<pre>`;
  a sor becsukása `NO_EXPANDED_JSON`-ra állítja vissza.
- `index.ts`: minden új szimbólum explicit exportja.
- Tesztek: `test/json.logic.test.ts` (új, 18 eset), `log-entry-row.test.tsx` +7 eset; a meglévő
  value-assert `[data-log-detail-value]`-ra állt át, mert a `dd` már nem csak az értéket tartalmazza.

## 5. Eredmény és ellenőrzés

```bash
pnpm --filter @callback/ui test       # 479/479 zöld (json.logic 18, row 26, drawer 45)
pnpm --filter @callback/ui typecheck
pnpm typecheck && pnpm quality
```

Kézi ellenőrzés: `pnpm dev` → admin → log drawer → egy hibás kérés sorának kinyitása → a `queryKey`
mellett `JSON kibontása` gomb → kattintásra indentált tömb, még egyszer kattintva visszacsukódik; a
`url` mezőn (sima szöveg) nincs gomb; a sor becsukása után a mezőkibontás eltűnik.

## 6. Follow-up

- Önálló `JsonValue` primitíva + `DescriptionList`-bekötés, ha más oldalakon is JSON-t kell mutatni.
- A `detail` egysoros összefoglaló továbbra sem parse-olt (szándékos).
