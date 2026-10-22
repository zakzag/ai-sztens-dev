# 2026-10-22 01:48 — Lokális SonarQube elemzés: `pnpm sonar`

**Ticket:** AIS-78
**Terv:** [`docs/plans/2026-10-21--23-55-00-pnpm-sonarqube-scan-plan.md`](../plans/2026-10-21--23-55-00-pnpm-sonarqube-scan-plan.md)
**Milestone:** [`docs/milestones/2026-10-22--01-48-00-sonarqube-local-scan.milestone.md`](../milestones/2026-10-22--01-48-00-sonarqube-local-scan.milestone.md)
**Spec:** [`docs/Specs/SonarQube.md`](../Specs/SonarQube.md)

## Kiindulás

A gépen fut egy SonarQube (10.2.1, `http://localhost:9000`), de a repónak nem volt semmilyen
bekötése: nem volt `sonar-project.properties`, nem volt scanner hívás, és a unit tesztek sem
termeltek LCOV-ot. Így a kódminőség, a duplikáció és a lefedettség sehol nem volt mérhető.

## Amit megépítettünk

1. **Scanner bekötés** — `@sonar/scan@^4.4.0` root devDependency. A `scripts/sonar/scan.mjs`
   beolvassa a gitignore-olt `sonar.env`-et, validálja a configot (`SONAR_TOKEN` kötelező,
   `SONAR_HOST_URL` default `http://localhost:9000`), **preflight** `/api/system/status` hívást
   tesz (nem `UP` → azonnali, magyar hibaüzenet), majd meghívja a scannert. A token soha nem
   kerül logba.
2. **Coverage pipeline** — mind az öt tesztelő package kapott `test:cov` scriptet:
   jest (shared, api-client, api) és vitest + `@vitest/coverage-v8` (ui, admin). A jelentések
   `coverage/<pkg>/lcov.info` alá mennek.
3. **LCOV merge** — `scripts/sonar/lcov-merge.mjs` egyetlen `coverage/lcov.info`-t ír, benne
   **repo-root relatív** `SF:` útvonalakkal. Ez a lépés kötelező: a jest a `rootDir`-jéhez
   (az `apps/api`-nél `src`), a vitest a package gyökeréhez képest írja az útvonalakat, a
   SonarQube viszont a projekt gyökeréhez képest oldja fel őket.
4. **Root scriptek** — `pnpm sonar`, `sonar:coverage`, `sonar:scan`, `sonar:test`.
5. **Docs** — új living spec [`docs/Specs/SonarQube.md`](../Specs/SonarQube.md) (előfeltételek,
   token, használat, hibakeresési táblázat), `scripts/sonar/README.md`, `scripts/README.md`
   frissítés, `docs/Specs/UI-Architecture.md` dependency-tábla + `test:cov` parancsok.

## Menet közben talált buktatók

| Probléma | Megoldás |
|---|---|
| A helyi `pnpm` 9.15.4 és 11 között virtual-store eltérés (`ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF`, majd `ERR_PNPM_UNEXPECTED_STORE`) | A repó `node_modules`-a pnpm 11-gyel készült; a telepítést `npx pnpm@11`-gyel, Node 26-tal kellett futtatni (a default `node` a gépen 20.19.2). |
| A jest a `coverageDirectory`-t a `rootDir`-hez képest oldja fel, ezért az `apps/api` coverage először `apps/coverage/api`-ba került | `--coverageDirectory=../../../coverage/api`, plusz `coveragePathIgnorePatterns` a `test/` mappákra. |
| A `node:test` Windows-on a `path.join`-elt abszolút `SF:` útvonalat nem találta | A `SF:` értékeket előbb POSIX-szeparátorra normalizáljuk, csak utána oldjuk fel. |

## Verifikáció (lefuttatva)

| Parancs | Eredmény |
|---|---|
| `pnpm sonar:test` | 43/43 zöld |
| `pnpm sonar:coverage` | shared 34, api-client 29, ui 55, admin 87, api 194 teszt zöld; `LCOV merge: 5 package, 91 fájl → coverage/lcov.info`; mind a 91 `SF:` útvonal létezik |
| `node scripts/sonar/scan.mjs` token nélkül | magyar hibaüzenet, exit code 1 |
| `SONAR_TOKEN=<dummy> node scripts/sonar/scan.mjs` | preflight `UP`, scanner CLI 6.2.1 letöltés, `sonar-project.properties` betöltés, `Load global settings` → a szerver `401 Not authorized` (várt, dummy token) |
| `pnpm build` | minden package zöld |
| `pnpm lint` | **elbukik** az `apps/api`-ban két, ehhez a változáshoz nem tartozó spec fájlon (`vapi-signature.guard.spec.ts`, `vapi-webhooks.e2e-spec.ts`: `@typescript-eslint/no-unsafe-*` a `.mockRestore` hívásokon) — pre-existing hiba, külön javítandó |

## Nyitva maradt

- Valós (nem dummy) tokennel egy teljes elemzés lefuttatása és a dashboard ellenőrzése.
- CI bekötés (`SONAR_TOKEN` secret, `sonar.qualitygate.wait=true`) — külön ticket.
- A fenti pre-existing `apps/api` lint hiba javítása.
