# AIS-63 — `docs/Specs/UI-Architecture.md` feltöltése (state-tábla, page-recept, deps)

**Dátum:** 2026-10-21 21:42 (Europe/Budapest)
**Jira:** AIS-63 (subtask, parent: AIS-57)
**Terv:** [2026-10-21--21-35-00-ais-63-ui-architecture-doc-plan.md](../plans/2026-10-21--21-35-00-ais-63-ui-architecture-doc-plan.md)
**Státusz:** implemented

## Kiindulás

A ticket a doksi **létrehozását** kérte, de az már létezett: a Fázis 3 (AIS-61) alatt jött létre a
React szabály „same change” kötelezettsége miatt (D16). A hiányzó rész a **state-tábla** volt
(egyetlen placeholder sor), és a doksi több ponton a _cél_ struktúrát írta le tényként
(`src/app/`, `src/entities/`, Zustand session store), ami ma nem létezik.

## Változások

| Fájl                                                                                                                                                       | Változás                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1)                                                                                           | Fejléc: `Utolsó frissítés: 2026-10-21`, az Authority sor linkkel + „a szabály nyer” kitétel. §1: `apps/web` + jest/vitest megjegyzés a csomag-táblában. §2: rétegtérkép **cél vs mai állapot** (D25). §3.3: paletta-check `rg`-vel és PowerShell-lel. §5: 4 valós state-sor (D24). §6: új **page-recept**. §7: függőség-tábla `State` oszloppal, `zustand`/`react-hook-form`/`zod` _planned_ jelöléssel (D26). §8: jest/vitest szétválasztott verify + root `pnpm test` (D27) |
| [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:5)                                                                     | Az 5. sor `docs/Specs/UI-Architecture.md` említése relatív markdown linkké alakult, rövid felsorolással arról, mit tartalmaz a doksi                                                                                                                                                                                                                                                                                                                                          |
| [`docs/plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md`](../plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md:265) | Fázis 5 → **kész**; D24–D28 felvéve az eltérések közé                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Döntések

- **D24 — `dashboard` sor kimarad.** A ticket DoD-ja dashboard oldal sort kért, de ilyen oldal nem
  létezik. A tábla a valós oldalakat sorolja fel (`api-keys`, `/login`, `/`, `/calls`); a dashboard
  sor a valós dashboard ticketjével érkezik. Eltérésként rögzítve a tervben és itt is.
- **D25 — kétoszlopos rétegtérkép.** A `src/app/` és `src/entities/` mappa csak az AIS-41-gyel jön
  létre, a szabály viszont már most rájuk hivatkozik — a doksi nem állíthatja kész tényként.
- **D26 — „planned” függőségek.** A `zustand`, a `react-hook-form` és az admin-szintű `zod` ma
  nincs telepítve; a tábla ezt külön jelöli, hogy senki ne importálja őket hiába.
- **D27 — két test runner.** `jest` (`shared`, `api-client`) vs `vitest` (`ui`, `admin`); a verify
  szekció ezt külön blokkokban adja, mert egy `pnpm test` sor elrejtené a D13 szerinti felosztást.
- **D28 — nincs milestone.** Nincs kód- vagy konfigváltozás; a döntés-magot maga a specs doksi
  hordozza, így a milestone-szabály „design decisions need preserving” kritériumát a doksi teljesíti.

## Verify

Kódérintés nincs, ezért `pnpm test` / `lint` / `build` nem szükséges ehhez a változáshoz.

**Prettier-megjegyzés:** a `pnpm exec prettier --check` a fenti markdown fájlokra `warn`-ol, de ez
nem regresszió: a `docs/` fa egésze nincs prettier-formázva (pl. `docs/Specs/Functional-Specification.md`
és a `docs/milestones/*.milestone.md` fájlok érintetlenül is `warn`-olnak). A `--write` a szomszédos
doksiktól eltérő stílust és nagy, zajos diffet okozna, ezért nem futtattuk.

A doksi ellenőrzése manuális:

1. A state-táblában ott az `api-keys` sor, „page UI state: none” indoklással (D9-re hivatkozva).
2. Minden fájlhivatkozás létező fájlra mutat (nincs `src/app/` kész tényként).
3. A szabály és a doksi **oda-vissza** linkelnek.
4. A függőség-tábla nem állít be nem telepített csomagot telepítettként.

## Jira lezárás (2026-10-21 21:51)

A `Done` (transition id `41`) állapotba állítva, mert a munka a repóban már benne volt:

| Ticket | Előtte    | Utána |
| ------ | --------- | ----- |
| AIS-58 | To Do     | Done  |
| AIS-59 | To Do     | Done  |
| AIS-61 | In Review | Done  |
| AIS-62 | To Do     | Done  |
| AIS-63 | To Do     | Done  |

AIS-60 már `Done` volt. Megjegyzés került az AIS-63-hoz (D24 eltérés + bizonyítékok) és az AIS-57-hez
(subtask összefoglaló + a nyitott AIS-41). Az AIS-57 státusza **nem** változott: a lezárása külön
döntés, a story DoD-ja szerint mind a hat subtask Done.
