# AIS-121 — CI: a teljes teszt-mátrix futtatása a PR-on

**Dátum:** 2026-10-30 16:35 (Europe/Budapest)
**Ticket:** AIS-121 (subtask az AIS-105 alatt)
**Terv:** [`docs/plans/2026-10-30--15-15-00-ais-121-ci-full-test-matrix-plan.md`](../plans/2026-10-30--15-15-00-ais-121-ci-full-test-matrix-plan.md:1)
**Milestone:** [`docs/milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md`](../milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md:1)

## Mi történt

A `build-test` CI job a `pnpm --filter @callback/api test` parancs helyett mostantól a root
`pnpm test`-et futtatja, vagyis a **teljes unit-mátrixot**: shared → api-client → ui → admin → api.

Közben a job **Node 22-ről Node 24-re** emelődött, és a `timeout-minutes` 15-ről 20-ra nőtt.

## Miért

A root `package.json` `test` scriptje (`shared → api-client → ui → admin → api`) már létezett és
helyes volt, de a CI nem hívta. Emiatt a `packages/shared`, `packages/api-client`, `packages/ui` és
`apps/admin` tesztjei **halott kódok voltak a CI szempontjából** — az admin-oldali regressziók
észrevétlen maradtak, miközben az AIS-102…AIS-104 story-k épp ilyen teszteket írnak.

A Node-verzió emelése nem volt benne a ticket eredeti szövegében, de a mérés rávilágított: a
ticket D3-e azt állította, hogy a Node 22 a unit tesztekhez nem akadály. **Az.** Az `api` unit
suite egyik tesztje — az [`api-keys.module.spec.ts`](../apps/api/src/api-keys/api-keys.module.spec.ts:1)
második tesztje, ami a valódi `ApiKeysModule`-t fordítja (DI-graph regressziós őr) — a
[`JEST_CAN_REQUIRE_ESM`](../apps/api/test/lib/app-module-gate.ts:36) flagre van kapcsolva, ami
**Node ≥ 24.9**-et kér (a CommonJS `@nestjs/config` az ESM-only `@nestjs/common@12`-et
`require()`-olja, amit a Jest ESM runner csak 24.9-től tud). Node 22-n ez a teszt néma skipként
elhagyja a jobot zöldnek — vagyis az unit suite is részben halott kód volt.

## Mérések

**A négy korábban nem futó suite lokálisan (Node 20.19.2):** mind zöld — shared 99, api-client 97,
ui 71, admin 145 teszt, összesen 412 teszt / 33 fájl, 0 bukás, ~63 s.

**A teljes mátrix Node 24.22.2-vel (a CI új runtime-je):** **772 teszt / 71 fájl, 0 bukás**
(shared 99, api-client 97, ui 71, admin 145, api 360).

**A Node-verzió hatás bizonyítéka** az `api-keys.module.spec.ts`-re:

| Runtime                | A "real module" teszt                    |
| ---------------------- | ---------------------------------------- |
| Node 20.19.2 (lokális) | kipagyódott, loud warning                |
| Node 24.22.2           | **lefutott, 419 ms**, nincs skip-warning |

## Változtatott fájlok

| Fájl                                                                                                                                                             | Változás                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml:101)                                                                                                    | `pnpm --filter @callback/api test` → `pnpm test`; lépés neve `Unit tests (full matrix)`; a komment rögzíti a `&&`-lánc hibaterjedését és a negatív bizonyíték mechanizmusát |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml:67)                                                                                                     | `node-version: 22` → `24`, indoklással kommentelve                                                                                                                          |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml:42)                                                                                                     | `timeout-minutes: 15` → `20`                                                                                                                                                |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml:12)                                                                                                     | fejléckomment: a teljes mátrix leírása                                                                                                                                      |
| [`docs/Specs/SonarQube.md`](../docs/Specs/SonarQube.md:1)                                                                                                        | §7: a PR-mátrix és a SonarQube-pipeline kapcsolata, a Node 24 indoklás, a fejléc dátuma (2026-10-30)                                                                        |
| [`docs/milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md`](../milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md:1) | döntés-szintű összegzés                                                                                                                                                     |

**Nem változott:** a root `package.json` (a `test` script már kanonikus), a package-ek `test`
scriptjei, a vitest/jest konfigurációk, a lockfile, az `api-e2e` job.

## Ellenőrzés

```bash
pnpm --filter @callback/shared build   # a dist/ előfeltétel
pnpm test                              # mind az 5 suite zöld
```

A `prettier --check .github/workflows/ci.yml` tiszta.

## Hátralévő (nem a ticket scope-jában)

- **A negatív bizonyíték még nem futott le** — ehhez nyitott PR kell (eldobható branch +
  szándékosan elrontott admin-teszt, majd visszaállítás).
- A `apps/web` néma no-op teszt-scriptje (`echo "no unit tests yet" && exit 0`) és nincs a root
  `pnpm test` láncban — nem hiba, de figyelendő.
- Az AIS-105 T4-5 (réteg-lint, knip, paletta-check) kapu erre a mátrixra épül.
