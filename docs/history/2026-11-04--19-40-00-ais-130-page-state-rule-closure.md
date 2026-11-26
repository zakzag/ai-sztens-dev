# AIS-130 — a page-state szabály lezárása

**Dátum:** 2026-11-04 19:40 (Europe/Budapest)
**Ticket:** [AIS-130](https://zakzag.atlassian.net/browse/AIS-130) — parent [AIS-129](https://zakzag.atlassian.net/browse/AIS-129)
**Típus:** dokumentáció + szabály (nulla termékkód, nulla új dependency)

## Probléma

A page-state szabály **két doksiban, ellentmondva** élt:

- [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) §6 **kötelezően** írt elő page-local Zustand store-t (kódpéldával);
- [`UI-Architecture.md`](../Specs/UI-Architecture.md:375) §5 szerint a `zustand` **nincs telepítve**, a §7 táblázatban `planned`.

A `pages/` alatt egyetlen `*.store.ts` sem volt, tehát a kötelező minta sehol nem volt példázva.

## Döntés

**A `zustand` nem kerül telepítésre.** Egyetlen oldalnak sincs tranziens UI-állapota (a lista
szűrő/rendezés/oldal állapota az URL-ben él, AIS-119), így a csomag használatlan dependency lenne,
amit a `pnpm quality:dead-code` (knip) azonnal pirosra váltana — és az AIS-105 D1 kimondja, hogy a
ticket ne vezessen be dependency-t, ha nem kell.

**Kiváltó:** az AIS-129 első oldala, amelynek tényleg tranziens UI-állapota van (nyitott drawer,
kijelölt sor, oszlopszűrő). Az a change telepít, `installed`-ra váltja a §7 sort és megírja a
store-tesztet (init → patch → selector).

## Változások

| Fájl | Változás |
| --- | --- |
| [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) | §6 újraírva: **4 bucket döntési sorrendben** (URL → Query → page store → `useState`) + §6.1 döntési teszt + §6.2 URL + §6.3 store + §6.4 „`zustand` is not installed yet (AIS-130)” + §6.5 server-state szabályok. A „három bucket” megfogalmazás mindenhol feltételes lett: `:4` Stack, `:13` §0.3, `:14` §0.4, `:31` folder layout, `:90` §3 Store sor, §12/4, §12/8, §13 DoD |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:27) | új `AIS-130 (2026-11-04)` fejléc-blokk a §6 döntési létra **idézetével**; §5 nyitány a §6-ra hivatkozik; §5 záró bekezdés és a „`zustand` stays uninstalled” bekezdés feltételessé téve (döntés-hely: AIS-130); §6/1 lépés a §6.1 tesztre mutat; §7 táblázat alatti jegyzet kimondja a döntést és a kiváltó feltételt |
| [`docs/plans/2026-11-04--19-30-00-ais-130-page-state-rule-closure-plan.md`](../plans/2026-11-04--19-30-00-ais-130-page-state-rule-closure-plan.md:1) | a végrehajtott plan, a §6 teljes új szövegével |

**Nem változott:** `apps/admin/**`, `packages/**`, `knip.json`, `.dependency-cruiser*`, CI.
A state-plan táblázat sorai is érintetlenek — a DoD 3. pontja („minden oldal sora megvan”) **már**
teljesült: `api-keys`, `LoginPage`, `PlaceholderPage`, `/calls`.

## Következmény

Egy új oldal fejlesztője a §6.1 három kérdésével eldönti, hova kerül a szűrő, a kijelölt sor vagy a
form hiba — a két doksi többé nem mond ellent, mert a specs **idézi** a szabályt, nem fordítja.

## Ellenőrzés

```bash
git diff --name-only     # 2 szabály/specs fájl + plan + history + milestone
pnpm quality             # a négy gate zöld (a változás nem érinti egyiket sem: docs + .roo)
```
