# AIS-63 — `docs/Specs/UI-Architecture.md` helyreállítása és a state-tábla feltöltése

**Jira:** AIS-63 (subtask, parent: AIS-57)
**Dátum:** 2026-10-21
**Státusz:** implemented (2026-10-21 21:42) — lásd [history](../history/2026-10-21--21-42-00-ais-63-ui-architecture-doc.md)
**Kapcsolódó:** [AIS-57 + AIS-41 összevont terv](2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md), [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1), [`UI-Architecture.md`](../Specs/UI-Architecture.md:1)

## 1. Kiinduló állapot

A doksi **már létezik** (a Fázis 3-ban jött létre, D16 döntés miatt), tehát AIS-63 nem
„létrehozás”, hanem **a hiányzó részek pótlása + a valósághoz igazítás**.

| Terület                    | Tény                                                                                                 | Bizonyíték                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Doksi                      | létezik, 7 szekció: hol mi lakik, rétegtérkép, tokenek, primitívek, state-tábla, függőségek, verify  | [`UI-Architecture.md:1`](../Specs/UI-Architecture.md:1)                            |
| State-tábla                | **egyetlen placeholder sor**, nincs valós oldal-sor                                                  | [`UI-Architecture.md:115`](../Specs/UI-Architecture.md:115)                        |
| Page-recept                | **hiányzik** (a React szabály §12-re hivatkozik, a doksi nem tartalmazza)                            | [`UI-Architecture.md:107`](../Specs/UI-Architecture.md:107)                        |
| `apps/admin/src/app/`      | **nem létezik**; `App.tsx` / `main.tsx` a `src` gyökerében                                           | `apps/admin/src/` lista                                                            |
| `apps/admin/src/entities/` | **nem létezik** (AIS-41 hozza)                                                                       | `apps/admin/src/` lista                                                            |
| Session store              | nincs Zustand session store; `AuthContext` + `sessionStorage`                                        | [`AuthContext.tsx`](../../apps/admin/src/auth/AuthContext.tsx:1)                   |
| Telepített UI deps         | `@tanstack/react-query`, `react-router-dom` van; **zustand, react-hook-form, zod nincs** az adminban | [`apps/admin/package.json:18`](../../apps/admin/package.json:18)                   |
| `api-client` teszt         | **jest + ts-jest**, nem vitest (D13)                                                                 | [`packages/api-client/package.json:14`](../../packages/api-client/package.json:14) |
| Oldalak                    | `/` → `PlaceholderPage` (statikus), `/login` → `LoginPage`, `/api-keys` még nincs                    | [`App.tsx:33`](../../apps/admin/src/App.tsx:33)                                    |
| Szabály hivatkozás         | a React szabály csak félkövér szövegként említi a doksit, nem link                                   | [`react.coding-standards.md:5`](../../.roo/rules/react.coding-standards.md:5)      |

## 2. Scope

**In:** `docs/Specs/UI-Architecture.md` frissítése (state-tábla, page-recept, rétegtérkép a
valós mappákhoz, függőség-tábla, verify parancsok, fejléc-dátum), a React szabály
hivatkozásának linkké alakítása, az összevont terv Fázis 5 státuszának lezárása, history bejegyzés.

**Out:** bármilyen kódváltozás (az `api-keys` oldal az AIS-41), új függőségek telepítése,
Zustand/RHF bevezetése, a `docs/Specs/` többi doksija.

## 3. Döntések

| #   | Döntés                                                                                                                          | Miért                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D24 | A state-tábla a **valós** oldalakat sorolja fel: `api-keys`, `/login`, `/` — a ticketben szereplő `dashboard` sor **kimarad**   | nincs dashboard oldal; egy nem létező oldal sora hamis állapotot dokumentálna. Eltérésként rögzítjük a tervben és a history-ban                          |
| D25 | A rétegtérkép **két oszlopos**: „cél struktúra (szabály §1)” és „mai állapot”                                                   | a doksi élő dokumentum; a `src/app/` és `src/entities/` csak az AIS-41-gyel jön létre, de a szabály már most rájuk hivatkozik                            |
| D26 | A függőség-tábla külön jelöli a `zustand`, `react-hook-form`, `zod`-ot mint **még nem telepített, AIS-41-gyel érkező** elemeket | a doksi „Adding a dependency requires updating this table” szabálya csak akkor tartható, ha a hiányzó deps látszik                                       |
| D27 | A verify szekció külön kezeli a `jest`-et (`api-client`) és a `vitest`-et (`ui`, `admin`)                                       | D13 óta két test runner van; egy `pnpm test` sor elrejtené ezt                                                                                           |
| D28 | Nincs milestone doksi ehhez a ticketthez                                                                                        | nincs kód- vagy konfigváltozás; a döntés-magot maga a specs doksi hordozza (milestone-szabály: „design decisions need preserving” — itt az a doksi maga) |

## 4. Feladatok

| #   | Fájl                                                                        | Változás                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `docs/Specs/UI-Architecture.md`                                             | §2 rétegtérkép: cél vs mai állapot tábla (`src/app/`, `src/entities/`, `services/`, `lib/`, `test/mocks/`), a „nincs page→page” elv megtartása                                                                                                                                          |
| 2   | ugyanaz                                                                     | §5 state-tábla: `api-keys` (server: `useApiKeysQuery`/`useCreateApiKeyMutation`; page state: **nincs**, D9; form: RHF + zod, identifier mezőn 409), `/login` (form: `AuthContext` + `sessionStorage`), `/` (statikus placeholder), a záró megjegyzésből a „AIS-63 hozza” mondat törlése |
| 3   | ugyanaz                                                                     | új §6 „Új oldal receptje”: a szabály §12 tíz lépése a repó konvencióival (fájlnevek, `.js` extension, `src/test/mocks`, paletta-check)                                                                                                                                                  |
| 4   | ugyanaz                                                                     | §6 (lesz §7) függőség-tábla: `@tanstack/react-query`, `react-router-dom`, `@callback/{shared,ui,api-client}`, `jest`+`ts-jest` sor, valamint `zustand`/`react-hook-form`/`zod` „planned (AIS-41)” jelöléssel                                                                            |
| 5   | ugyanaz                                                                     | §7 (lesz §8) verify parancsok: `pnpm --filter @callback/api-client test` (jest), `pnpm test` root, paletta-check `rg`-vel **és** a PowerShell változattal                                                                                                                               |
| 6   | ugyanaz                                                                     | Fejléc: `**Utolsó frissítés:**` dátum frissítése + „Authority” sorban a React szabály relatív linkje                                                                                                                                                                                    |
| 7   | `.roo/rules/react.coding-standards.md`                                      | 5. sor: `docs/Specs/UI-Architecture.md` → relatív markdown link (a §0.10 már hivatkozik, azt nem kell módosítani)                                                                                                                                                                       |
| 8   | `docs/plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md` | §10: Fázis 5 → **kész**, D24–D28 felvétele az eltérések közé                                                                                                                                                                                                                            |
| 9   | `docs/history/<YYYY-MM-DD--HH-ii-ss>-ais-63-ui-architecture-doc.md`         | új: mit és miért módosítottunk, verify output                                                                                                                                                                                                                                           |

Sorrend: 1–6 (doksi) → 7 (szabály link) → 8 (terv státusz) → 9 (history).

## 5. Ellenőrzés

A `prettier --check` **nem** használható kapuként: a `docs/` fa egésze nincs prettier-formázva
(pl. `docs/Specs/Functional-Specification.md` és a milestone-ok is `warn`-olnak), ezért egy
`--write` a szomszédos doksiktól eltérő stílust és nagy, zajos diffet okozna. A formázás
ellenőrzése helyett a hivatkozások és a tények ellenőrzése a DoD:

```bash
# minden hivatkozott fájl létezik?
test -f docs/Specs/UI-Architecture.md && test -f .roo/rules/react.coding-standards.md
```

Manuális DoD (ticket):

1. A doksi létezik, a fejléc dátuma mai.
2. A state-táblában szerepel az `api-keys` sor, és a „dashboard” eltérés dokumentálva van.
3. A doksi a `.roo/rules/react.coding-standards.md`-re **linkkel** mutat, és a szabály linkkel mutat vissza.
4. Minden fájlhivatkozás a doksiban létező fájlra mutat (nincs `src/app/` ígéret tényként).
5. A függőség-tábla nem állít be nem létező csomagot telepítettként.

## 6. Kockázatok

| Kockázat                                                                  | Kezelés                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A doksi „cél” állapotot ír le, és a következő olvasó kész tényként kezeli | D25: külön oszlop + „mai állapot” jelölés                                  |
| A state-tábla elavul, amikor az AIS-41 oldal elkészül                     | a szabály §0.10 kötelezettsége + a tábla `Notes` oszlopában AIS-hivatkozás |
| A ticket `dashboard` sora review-n hiányérzetet kelt                      | D24 + explicit eltérés a history-ban és a terv §10-ében                    |
