# SonarQube — lokális kódelemzés

**Utolsó frissítés:** 2026-10-22
**Kapcsolódó ticket:** AIS-78
**Kapcsolódó terv:** [`docs/plans/2026-10-21--23-55-00-pnpm-sonarqube-scan-plan.md`](../plans/2026-10-21--23-55-00-pnpm-sonarqube-scan-plan.md)

Ez a doksi írja le, hogyan futtatja a repó a SonarQube elemzést egy fejlesztői gépen futó
szerverre. A cél, hogy **egy paranccsal** legyen kód + tesztlefedettség a dashboardon, ne kelljen
kézzel scanner CLI-t telepíteni.

## 1. Mi történik egy `pnpm sonar` alatt

```text
pnpm sonar
 ├─ pnpm sonar:coverage
 │   ├─ @callback/shared     → jest  --coverage       → coverage/shared/lcov.info
 │   ├─ @callback/api-client → jest  --coverage       → coverage/api-client/lcov.info
 │   ├─ @callback/ui         → vitest run --coverage  → coverage/ui/lcov.info
 │   ├─ @callback/admin      → vitest run --coverage  → coverage/admin/lcov.info
 │   ├─ @callback/api        → jest  --coverage       → coverage/api/lcov.info
 │   └─ scripts/sonar/lcov-merge.mjs → coverage/lcov.info (repo-root relatív SF: útvonalak)
 └─ pnpm sonar:scan
     ├─ sonar.env / env beolvasása  → SONAR_TOKEN, SONAR_HOST_URL
     ├─ preflight: GET <host>/api/system/status  (nem UP → azonnali hiba)
     └─ @sonar/scan  → sonar-scanner (a sonar-project.properties alapján)
```

Miért kell a merge: a SonarQube az LCOV `SF:` útvonalait a **projekt gyökeréhez** képest oldja
fel. A jest a saját `rootDir`-jéhez (az `apps/api`-nél ez a `src`), a vitest a package
gyökeréhez képest írja az útvonalakat, tehát `SF:src/...` alakban. A merge script ezeket
`packages/ui/src/...`, `apps/api/src/...` alakúra írja át, kigyomlálja a package-ek között
duplikált fájlokat, és figyelmeztet, ha egy útvonal nem létezik a lemezen. Enélkül a coverage
szekció üres marad a dashboardon.

## 2. Előfeltételek

| Követelmény            | Miért                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futó SonarQube szerver | A script nem indít konténert; a szervernek már futnia kell (alapból `http://localhost:9000`).                                                                                                                                         |
| SonarQube user token   | A `pnpm sonar:scan` ezzel hitelesít. Nem admin token, a projekt elemzéséhez elegendő a `Create Projects` + `Execute Analysis` jog.                                                                                                    |
| Node ≥ 18              | `@sonar/scan` v4 követelménye (a repóban tesztelve Node 20.19.2-vel). Node ≥ 22.12 esetén a v5 is használható, de a v4 visszafelé kompatibilis.                                                                                       |
| Java 17+               | Csak akkor kell, ha a szerver nem támogatja a JRE provisioning-ot (a SonarQube 10.2.1 nem támogatja) — ilyenkor a scanner a `sonar-scanner-cli`-re esik vissza és a helyi Java-t használja. A scanner ezt magától eldönti és logolja. |

A token generálása: SonarQube → jobb felső avatar → **My Account → Security → Generate Tokens**
(típus: _User Token_).

## 3. Beállítás

```bash
cp sonar.env.example sonar.env     # gitignore-olt, soha ne commitold
# sonar.env:
#   SONAR_HOST_URL=http://localhost:9000
#   SONAR_TOKEN=squ_...
```

A valós `process.env` mindig felülírja a `sonar.env` tartalmát (CI secret nem veszhet el egy
régi lokális fájl miatt). A script a tokent soha nem írja logba, és a `sonar-project.properties`
sem tartalmaz titkot.

## 4. Parancsok

| Parancs               | Mit csinál                                                    |
| --------------------- | ------------------------------------------------------------- |
| `pnpm sonar`          | A teljes folyamat: coverage + merge + elemzés.                |
| `pnpm sonar:coverage` | Csak a tesztek coverage-dzsel + a LCOV merge.                 |
| `pnpm sonar:scan`     | Csak az elemzés (a meglévő `coverage/lcov.info`-t használja). |
| `pnpm sonar:test`     | A `scripts/sonar/` eszköz saját unit tesztjei (`node:test`).  |

Kilépési kódok: `0` siker, `1` hiányzó token / elérhetetlen vagy nem `UP` szerver / scanner hiba.

Quality gate: alapból nem vár rá (`sonar.qualitygate.wait=false`). Ha a scriptnek piros gate
esetén is hibára kell futnia (pl. CI-ben), állítsd be:

```bash
SONAR_QUALITYGATE_WAIT=true pnpm sonar:scan
```

## 5. Mit elemez

Forrás: [`sonar-project.properties`](../../sonar-project.properties) — `apps/{api,web,admin}/src`,
`packages/{shared,api-client,ui}/src`, `scripts`. Kizárva: `node_modules`, `dist`, `build`,
`coverage`, `.scannerwork`, `*.d.ts`, `apps/api/drizzle/**`. A tesztfájlok (`*.test.ts(x)`,
`*.spec.ts`) kódduplikáció szempontjából kizártak, és a coverage-ből is.

Egy Sonar projekt (`sonar.projectKey=aisztens`) fedi le az egész monorepót — így a package-ek
közötti duplikáció és a cross-package függőségek is látszanak.

## 6. Hibakeresés

| Tünet                                                                           | Ok / megoldás                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Hiányzó SONAR_TOKEN`                                                           | Nincs token sem env-ben, sem `sonar.env`-ben. Generálj tokent, vagy exportáld.                                                                                                           |
| `A SonarQube nem érhető el a(z) http://localhost:9000 címen`                    | A szerver nem fut, vagy más porton. Állítsd be a `SONAR_HOST_URL`-t.                                                                                                                     |
| `A SonarQube státusza "STARTING"`                                               | A szerver még indul; várd meg a `UP` státuszt.                                                                                                                                           |
| `Not authorized. Please check the user token`                                   | Rossz / visszavont token. Új token kell.                                                                                                                                                 |
| A dashboardon nincs coverage                                                    | Nem futott a `pnpm sonar:coverage`, vagy a `coverage/lcov.info` nem készült el. Nézd meg a merge kimenetét: ha `LCOV: a(z) "..." útvonal nem létezik` sort ír, az `SF:` leképezés hibás. |
| `JRE provisioning is NOT supported ... Falling back on using sonar-scanner-cli` | Normális a SonarQube 10.2.x-nél; a helyi Java 17-et használja. Ha nincs Java: telepíts JRE 17-et vagy frissíts SonarQube-ra (≥ 10.3).                                                    |
| `The base directory of the analysis ... does not exist` / `sonar.sources` hiba  | Rossz könyvtárból futtattad. Mindig a repó gyökeréből: `pnpm sonar` (a `sonar.projectBaseDir` a repo root).                                                                              |

## 7. Jelenlegi állapot / ismert korlátok

- Tesztelve: SonarQube **10.2.1**, Windows 11, Node 20.19.2, Java 17, `@sonar/scan@4.4.0`.
  A lánc a valós szerverig eljut (scanner CLI letöltés → `sonar-project.properties` betöltés →
  `Load global settings`); érvényes token nélkül a szerver `401 Not authorized`-ral válaszol, ami
  a várt viselkedés.
- `apps/web`-nek még nincs unit tesztje, ezért coverage-et sem ad; az elemzésbe viszont bekerül.
- CI integráció (`.github/workflows/ci.yml` + `SONAR_TOKEN` secret, `sonar.qualitygate.wait=true`)
  szándékosan külön feladat, ez a doksi a lokális futtatást írja le.
- Quality Gate és minőségi profil testreszabása (küszöbök, PR-dekoráció) nincs beállítva; a
  szerver default "Sonar way" profilját használja.
