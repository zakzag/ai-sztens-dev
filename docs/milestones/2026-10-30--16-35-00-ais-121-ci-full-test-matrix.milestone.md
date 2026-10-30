# AIS-121 — CI: a teljes teszt-mátrix futtatása a PR-on

**Dátum:** 2026-10-30
**Ticket:** AIS-121 (subtask az AIS-105 alatt)
**Terv:** [`docs/plans/2026-10-30--15-15-00-ais-121-ci-full-test-matrix-plan.md`](../plans/2026-10-30--15-15-00-ais-121-ci-full-test-matrix-plan.md:1)

---

## 1. Problem

A `.github/workflows/ci.yml` `build-test` jobja a `pnpm --filter @callback/api test` parancsot
futtatta — **csak az API unit teszteket**. A root `package.json` `test` scriptje
(`shared → api-client → ui → admin → api`) létezett és helyes volt, de a CI **nem hívta**.

Következmény: a `packages/shared` (99 teszt), `packages/api-client` (97), `packages/ui` (71) és
`apps/admin` (145) tesztjei **halott kódok voltak a CI szempontjából**. Az admin-oldali
regressziók (form, hook, primitívek, shared sémák) észrevétlen maradtak — miközben az
AIS-102…AIS-104 story-k épp ilyen teszteket fognak írni.

Egy második, rejtett réteg: a `build-test` job **Node 22**-t futtatott, és az `api` unit suite
egyik tesztje (`api-keys.module.spec.ts` — a valódi `ApiKeysModule` DI-graph compile-ja) Node
≥ 24.9-et igényel. Node 22-n ez a teszt **némán kihagyódott** — vagyis a unit suite is részben
halott kód volt.

## 2. Measured data

Lokális mérés a `build-test` job parancssorainak megfelelő sorrendben (Node v20.19.2, pnpm 9.15.4):

| Package                | Runner               | Fájlok | Tesztek              | Idő       |
| ---------------------- | -------------------- | ------ | -------------------- | --------- |
| `@callback/shared`     | jest + ts-jest (ESM) | 5      | 99 pass              | 6.6 s     |
| `@callback/api-client` | jest + ts-jest (ESM) | 5      | 97 pass              | 1.8 s     |
| `@callback/ui`         | vitest (jsdom)       | 9      | 71 pass              | 38.0 s    |
| `@callback/admin`      | vitest (jsdom)       | 14     | 145 pass             | 16.6 s    |
| **Összesen**           |                      | **33** | **412 pass, 0 fail** | **~63 s** |

**Node 24.22.2-vel** (a CI új runtime-je) a teljes mátrix: **71 tesztfájl, 772 teszt, 0 bukás**
(shared 99, api-client 97, ui 71, admin 145, api 360).

A Node-verzió hatás bizonyítéka az `api-keys.module.spec.ts`-re:

| Runtime           | `JEST_CAN_REQUIRE_ESM` | A "real module" teszt                    |
| ----------------- | ---------------------- | ---------------------------------------- |
| Node 20 (lokális) | `false`                | **kipagyódott** (loud warning)           |
| Node 24.22.2      | `true`                 | **lefutott, 419 ms**, nincs skip-warning |

## 3. Root cause / rationale

A CI a root script helyett **egy csomag szűkített parancsát** hívta. Ennek két oka van, és mindkettő
javítható:

1. **Duplikáció.** A root `package.json` és a CI workflow _két helyen_ tartalmazza a csomaglistát.
   Bármelyik szerkesztés elcsúszhat. A kanonikus forrás a root script; a CI-nek azt kell hívnia.
2. **A `node-version` választása nem a unit suite-hoz igazodott.** A `build-test` job Node 22-t
   használt, miközben a `api-e2e` job Node 24-et — a CI-ban két különböző Node-verzió futott.

Elutasított alternatívák:

| Alternatíva                                                     | Miért nem                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A CI külön `pnpm --filter <pkg> test` lépéseket ír csomagonként | Ugyanaz a duplikáció, amit a root script megszüntet.                                                   |
| A `build-test` job marad Node 22-n                              | Az `api` unit suite egy tesztje néma skip marad → részben halott kód a CI-ban, ami épp e ticket célja. |
| A `coverage` lépés is ebbe a jobba kerül                        | 5 runner + LCOV merge ≈ kétszeres PR-gate idő, új jel nélkül. A SonarQube külön pipeline (AIS-78).     |
| A `build-test` és az `api-e2e` job összevonása                  | Az e2e job Postgres service-t és migrációt használ — külön felelősség.                                 |

## 4. Solution / implementation

| Fájl                                                               | Változás                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:101)   | A unit-teszt lépés `pnpm --filter @callback/api test` → **`pnpm test`**; a lépés neve `Unit tests (full matrix)`; a komment rögzíti a `&&`-lánc hibaterjedését és a negatív bizonyíték mechanizmusát. |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:67)    | `node-version: 22` → **`24`**, a `require(esm)` indoklással kommentelve.                                                                                                                              |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:42)    | `timeout-minutes: 15` → **`20`**.                                                                                                                                                                     |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:12)    | Fejléckomment: a régi „`pnpm --filter @callback/api test`" leírás helyett a teljes mátrix.                                                                                                            |
| [`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md:1)       | §7: a PR-on futó unit-mátrix és a SonarQube-pipeline kapcsolata; a Node 24 indoklás; a fejléc dátuma.                                                                                                 |
| `docs/history/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.md` | Kivonulás.                                                                                                                                                                                            |

**Nem változott:** a root `package.json` (a `test` script már kanonikus), a package-ek `test`
scriptjei, a vitest/jest konfigurációk, a lockfile, az `api-e2e` job.

## 5. Outcome and how to verify

A PR-on futó `build-test` job mostantól a **teljes unit-mátrixot** futtatja (772 teszt, 5 suite),
Node 24-en, és **egyetlen teszt sem fut néma skipként**.

**Lokális ellenőrzés:**

```bash
pnpm --filter @callback/shared build   # a dist/ előfeltétel
pnpm test                              # mind az 5 suite, zöldnek kell lennie
```

**CI ellenőrzés (a PR-on):** a `build-test` job lépései között a `Unit tests (full matrix)` lépés
kimenetében mind az 5 suite látszik (`@callback/shared`, `@callback/api-client`, `@callback/ui`,
`@callback/admin`, `@callback/api`).

**A negatív bizonyíték (a DoD szigorú része):** egy eldobható branchen szándékosan el kell
rontani egy admin-tesztet (pl. [`apps/admin/src/lib/date.test.ts`](../../apps/admin/src/lib/date.test.ts:1)
egy `expect` értékét). Ekkor:

- a `build-test` job **piros** lesz, és a bukó teszt neve látszik a logban;
- a `shared` és `api-client` suite **zöld** marad (ők korábban futnak a láncban), és a lánc az
  `admin` suite-nél áll meg — ez bizonyítja, hogy az admin-tesztek **valóban a CI-ban futnak**;
- a teszt visszaállítása után a CI **zöld**.

## 6. Follow-ups

- **`apps/web` néma no-op.** A `test` scriptje `echo "no unit tests yet" && exit 0`, és a web
  **nincs** a root `pnpm test` láncban. Nem hiba, de ha a web csomag egyszer tesztet kap, a root
  scriptbe is fel kell venni — különben az is halott kód lesz.
- **A negatív bizonyíték manuális.** Nincs automatizált regresszió-ellenőrző, ami biztosítaná,
  hogy a `pnpm test` lánc továbbra is a root scriptre mutat. Egy kézi CI-ellenőrző workflow
  (`workflow_dispatch` + injektált hiba) ezt bezárná.
- **A `build-test` job Node-verziója és a `package.json` `engines` mezője nincs összekötve.** A
  `packages/*` `devDependencies` `@types/node: ^24`-et ír, az `apps/admin` `^22`-t — a CI
  runtime és a típus-definíciók közötti eltérés nem futásidejű hiba, de zajt ad.
- **Az AIS-105 T4-5 (réteg-lint, knip, paletta-check) kapu** erre a mátrixra épül — a kapuk akkor
  értékesek, ha a tesztek is futnak.
