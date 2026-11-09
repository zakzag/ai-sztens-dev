# Lenyitható log sor (`packages/ui`)

**Ticket:** AIS-153 · **Parent:** AIS-143 · **Dátum:** 2026-11-07

## 1. Probléma / feature

A `LogEntryRow` statikus sor volt: glyph + szint + idő + `message` + opcionális egysoros `detail`. Az
AIS-151 óta a store strukturált `details` tömböt is őriz (request id, URL, body, stack), de a UI nem
tudta megjeleníteni. Kell: kinyitható sor, kulcs–érték listával, copy gombokkal, akadálymentesen.

## 2. Bizonyíték / kiindulás

- A `NotificationHost` az `entries` listát **változtatás nélkül** adja át a `LogDrawer`-nek, tehát a
  `details` strukturálisan átfolyik; nem kell mapping és nem kell új prop.
- A meglévő 44 drawer-teszt a csukott sor külsejére épül.

## 3. Root cause / miért így

| Döntés                                                                                                | Miért                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `<button aria-expanded aria-controls>` + `role="region"`, nem `<details>`                             | A `<summary>` nem stílusozható egységesen a token-recipe-ekkel, és a régió copy gombjainak fókuszsorrendje kiszámíthatatlan lenne       |
| Nyitottság komponens-lokális `useState`                                                               | A state-döntési sor 4. szintje: nem kell túlélnie reloadot (nem URL), nem szerver-adat (nem Query), nincs második fogyasztó (nem store) |
| A fejléc-gomb csak a fejléc-sávot öleli                                                               | Hosszú `message` gomb belsejében kattinthatóvá és olvashatatlanná válna; a beágyazott gomb pedig érvénytelen HTML                       |
| Copy csak [`lib/copy-text.ts`](../../packages/ui/src/lib/copy-text.ts:1)-en át, csendes degradációval | A vágólap-hívás az egyetlen mellékhatás; így egyetlen szelep van, amit tesztelni kell, és clipboard nélküli környezet nem hibázik el    |
| Gombonként független visszajelzés (A0)                                                                | Egy közös flag esetén a `JSON` kattintás letakarná a `requestId` visszajelzését; így a felhasználó látja, mit másolt                    |

## 4. Megoldás

- `LogDetailField` / `LogEntryCopyTarget` / `LogEntryCopyFlags` / `LogEntryJson` típusok, `details?` a
  `LogEntryItem`-en (a `packages/ui` továbbra sem importálja a `@callback/notifications`-t).
- 12 új `LOG_ENTRY_*` konstans; tiszta `toEntryToggleLabel`, `toEntryJson` (fix mezősorrend),
  `findRequestIdField`.
- Négy új cva recipe (toggle, chevron, details régió, `dt`/`dd` slot) — csak token osztályok.
- `LogEntryRow`: fejléc-gomb, `hidden` régió, `dl`/`dt`/`dd`, `Nincs részletes adat` üres állapot,
  `requestId`/`JSON` copy gombok külön időzítővel, `useRef` map tisztítva unmountkor.
- `LogDrawer` **változatlan**.
- Tesztek: 5 → 19 row-eset, +3 logika describe, +1 drawer-eset; `stubClipboard` mock.

## 5. Eredmény és ellenőrzés

```bash
pnpm --filter @callback/ui test        # 454/454 zöld
pnpm --filter @callback/ui typecheck   # tiszta
```

Kézi ellenőrzés: admin app → log drawer → egy hibás bejegyzés fejlécére kattintva megjelenik a
kulcs–érték lista; a `requestId` gomb `Kimásolva`-ra vált 2 s-re, a `JSON` gomb ettől függetlenül; a
csukott sor kinézete a korábbi.

Kulcs-tanulság: a `hidden` régió accessible name nélkül jelenik meg, ezért a teszt `[role="region"]`-t
kérdez le, és fake timerek mellett tilos `findBy*`/`waitFor`.

## 6. Follow-up

- A `details` tényleges feltöltése a HTTP-eseményekből: AIS-152.
- Toast továbbra sem kap `details`-t (szándékos).
