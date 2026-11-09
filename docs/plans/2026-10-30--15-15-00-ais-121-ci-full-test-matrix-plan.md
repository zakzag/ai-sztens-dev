# AIS-121 — CI: a teljes teszt-mátrix futtatása a PR-on

**Dátum:** 2026-10-30 15:15 (Europe/Budapest)
**Ticket:** AIS-121 (subtask az AIS-105 alatt: „Admin alkalmazás-alap és minőségkapu")
**Téma:** a `build-test` CI job ma csak az API unit teszteket futtatja; a `shared`, `api-client`, `ui` és `admin` tesztek halott kódok a CI szempontjából.
**Státusz:** implementálva és **bizonyítva** (a negatív bizonyíték is lefutott — lásd §4 Fázis 2)
**Implementáció:** [`docs/history/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.md`](../history/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.md:1) · **Milestone:** [`docs/milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md`](../milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md:1)

---

## 1. Kiindulási állapot (mért)

### 1.1 A CI ma

A [`build-test`](../../.github/workflows/ci.yml:33) job lépései:

| Lépés          | Parancs                                          |
| -------------- | ------------------------------------------------ |
| Install        | `pnpm install --frozen-lockfile`                 |
| Build shared   | `pnpm --filter @callback/shared build`           |
| Build all      | `pnpm -r build`                                  |
| Lint           | `pnpm -r lint`                                   |
| **Unit tests** | **`pnpm --filter @callback/api test`** ← csak ez |

A root [`package.json:14`](../../package.json:14) `test` scriptje (`shared → api-client → ui → admin → api`) **nincs meghívva** a CI-ban.

### 1.2 A négy nem-futó suite — mért állapot

Lefuttatva a repóban (Node v20.19.2, pnpm 9.15.4):

| Package                | Runner               | Eredmény | Tesztfájl | Teszt                    | Idő       |
| ---------------------- | -------------------- | -------- | --------- | ------------------------ | --------- |
| `@callback/shared`     | jest + ts-jest (ESM) | ✅ PASS  | 5/5       | 99 passed, 0 failed      | 6.6 s     |
| `@callback/api-client` | jest + ts-jest (ESM) | ✅ PASS  | 5/5       | 97 passed, 0 failed      | 1.8 s     |
| `@callback/ui`         | vitest 3.2.7 (jsdom) | ✅ PASS  | 9/9       | 71 passed, 0 failed      | 38.0 s    |
| `@callback/admin`      | vitest 3.2.7 (jsdom) | ✅ PASS  | 14/14     | 145 passed, 0 failed     | 16.6 s    |
| **Összesen**           |                      |          | **33**    | **412 passed, 0 failed** | **~63 s** |

**Következtetés:** a négy suite **ma is zöld**. Az AIS-121 tehát **nem** igényel „előbb zöldítsük" fázist — a változás egyetlen CI-sor cseréje, és a DoD negatív bizonyítéka azonnal végrehajtható.

### 1.3 Amit a mérés feltárt, és a ticket nem említ

**Finding 1 — a `build-test` job Node 22-t használ, és emiatt az `api` unit suite egyik tesztje csendben kihagyódik.**

Az [`api-keys.module.spec.ts:76`](../../apps/api/src/api-keys/api-keys.module.spec.ts:76) második tesztje a **valódi** `ApiKeysModule`-t fordítja (DI-graph regresszió: a provider-feloldás hibája boot-time crash). Ez a [`JEST_CAN_REQUIRE_ESM`](../../apps/api/test/lib/app-module-gate.ts:36) flagre van kapcsolva, ami **Node ≥ 24.9**-et kér (a CommonJS `@nestjs/config` az ESM-only `@nestjs/common@12`-et `require()`-olja, amit a Jest ESM runner csak 24.9-től tud).

A `build-test` job Node **22**-t futtat → `JEST_CAN_REQUIRE_ESM === false` → a teszt **loud warning mellett kihagyódik**, és a CI zöld marad. Ez pontosan az a hibaminta, amit a [`ci.yml:79-88`](../../.github/workflows/ci.yml:79) kommentje az `api-e2e` jobnál leír — de a **unit** jobnál nincs ilyen komment, és nincs ismertetve.

**Finding 2 — a `packages/ui` suite wall-clockja (38 s) dominálja a teljes futásidőt, és 96%-a a jsdom startup, nem a tesztlogika** (1.59 s a tényleges tesztidő). Ez a CI timeout-hoz nem probléma, de megjegyzendő.

**Finding 3 — a `apps/web` néma no-op.** A [`apps/web/package.json:14`](../../apps/web/package.json:14) `test` scriptje `echo "no unit tests yet" && exit 0`. A root `pnpm test` **nem** tartalmazza a `web`-et, tehát ez nem érinti az AIS-121-et — de a negatív bizonyítékhoz fontos tudni: **a `web` szándékosan néma**, nem hiba.

**Finding 4 — a pnpm-verzió eltérése.** A CI `pnpm/action-setup@v4` `version: 10`-et pinel, a lokális gépen pnpm 9.15.4 fut. A `--frozen-lockfile` install ezt elviseli, de a root script `pnpm --filter` lánca pnpm 10-ben is `&&`-szekvenciális.

---

## 2. Döntések

### D1 — A root `pnpm test` a kanonikus belépési pont

**Döntés:** a `build-test` job `pnpm --filter @callback/api test` lépése helyett a `pnpm test` fut.

**Indoklás:** a root script a kanonikus lista; ha a CI külön parancssorokat ír csomagonként, minden új package hozzáadásakor két helyen kell módosítani, és a kettő szétcsúszik. Ez pontosan az a fajta duplikáció, amit a [`general.coding-standards.md`](../../.roo/rules/general.coding-standards.md:1) DRY elve tilt.

**Kockázat (elfogadva):** a `pnpm test` `&&`-lánca **nem jelez**, melyik package bukott el, ha nem olvassuk el a logot. Viszont a `pnpm --filter <pkg> test` nem ad job-szintű hibát sem. **A `&&` lánc a hibát a megfelelő package-re lokalizálja a stdout-on** — a Jest/vitest saját kimenete megmondja, melyik fájl és teszt bukott el. A `set -e` miatt a lánc az első hibánál megáll, tehát **a bukó package utáni suite-ok nem futnak** → a CI gyorsan piros lesz, és a piros lépés naplójában egyértelmű lesz a bukó suite.

**Alternatíva elutasítva:** a CI külön `pnpm --filter` lépéseket ír csomagonként. Elutasítva: duplikálja a root listát (D1 inverze).

### D2 — A `coverage` lépés nem kerül ebbe a jobba

**Döntés:** a `build-test` job **nem** futtatja a `pnpm sonar:coverage`-t.

**Indoklás:** a ticket D2-je ezt kimondja, és ez helyes: a coverage 5 külön runner indítását + LCOV merge-et jelent, ami a `pnpm test` ~63 s-hoz képest kétszeres-hármas futásidőt ad, miközben a PR-gate számára nem ad új jelet. A SonarQube scan külön pipeline (AIS-78) — a [`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md:107) ezt már rögzíti: „CI integráció … szándékosan külön feladat".

### D3 — A Node-verzió: **a `build-test` job Node 22-ről Node 24-re emelődik**

Ez a ticket legfontosabb döntése, és **nem** az, amit a ticket sugall.

**A ticket D3-je:** „a `build-test` job Node 22-t használ, az `api-e2e` Node 24-et. A unit teszteknél ez nem akadály."

**Ez a betevés téves.** A Finding 1 szerint a Node 22 **ponton az akadály**: az `api` unit suite egyik tesztje (`api-keys.module.spec.ts` — a valódi DI-graph compile) csendben kihagyódik Node < 24.9-en. Az AIS-121 maga épít arról, hogy „a tesztek fussanak" — ha a `pnpm test` Node 22-n fut, akkor az `api` unit suite **részben halott kód** marad, pontosan az a fajta, amit ez a ticket megszüntetni akar.

**Döntés:** a `build-test` job `node-version: 22` → `node-version: 24`.

**Kockázat / mitigáció:**

| Kockázat                                                             | Mit teszünk                                                                                                                                                          | Státusz                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| A Node 24 jobban a `api` unit suite valódi module-compile-ja elhasal | A `api-keys.module.spec.ts` második tesztje Node 24-en fut — lokálisan Node 20-on ez a kihagyott ág, tehát **a CI lesz az első hely, ahol ez a teszt valaha futott** | **Kockázatos** — lásd §4 |
| Node 24 megszünteti a `require(esm)` warningot                       | A `require(esm)` Node 22.12+-től stabil                                                                                                                              | Jó                       |
| A `ui`/`admin` vitest suite Node 24-en másként viselkedik            | A vitest 3.2.x támogatja a Node 24-et                                                                                                                                | Jó                       |

**A kockázat kezelése (ez a terv kulcsrésze):** a Node 24-es `api` unit suite-t **előbb** lokálisan/futtatókörnyezetben validálni kell, mielőtt a CI-t átállítjuk. Ha a module-compile Node 24-en elhasal (pl. egy másik CommonJS-csomag ugyanúgy belebukik), akkor **nem** Node 22-re kell visszalépni, hanem **külön lépésként** kezelni: vagy a gate kibővítése, vagy a teszt átírása metadata-alapú DI-assertionre (már létezik ilyen: [`http-wiring.metadata.spec.ts`](../../apps/api/src/common/http/http-wiring.metadata.spec.ts:1), amely **minden** Node-verzión fut).

**Alternatíva elutasítva — a Node 22 megtartása:** elutasítva, mert az `api` unit suite egy tesztje néma skip maradna, és ez közvetlenül sérti a ticket célját.

**Alternatíva elutasítva — a `build-test` job teljes átállítása Node 24-re + az `api-e2e` job megszüntetése:** elutasítva, mert az `api-e2e` job Postgres service-t és migrációt is használ, ami külön felelősség; a két job összevonása a scope növelése lenne.

### D4 — A job timeout: 15 → 20 perc

**Döntés:** `timeout-minutes: 15` → `timeout-minutes: 20`.

**Indoklás:** a jelenlegi job az `install` + `build` + `lint` + **egy** teszt-suitet futtat. A teljes mátrix a mért adatok alapján **+63 s** tesztidőt hozzáad (a `ui` 38 s + `admin` 17 s + `shared` 7 s + `api-client` 2 s), de a job **install** (~40–60 s) + **build all** (~60–90 s, a `web`/`admin` vite bundle) + **lint** (~20 s) része változatlan. A nettó növekedés tehát **~1 perc**, ami a 15 perces keretbe bőségesen belefér.

**A 20 perc azonban nem a tesztidő miatt kell, hanem mert** a `pnpm test` most már **5** egymás utáni runner-t indít, és a GitHub-hosted runner-en a `install` + `build` + 5× runner startup együtt már nem triviális. 15 perc így is elég lenne, de **nincs buffer** egy cache-miss utáni lassú buildre. A 20 perc olcsó biztosítás, nem a tesztek miatt kell.

### D5 — A negatív bizonyíték admin-oldali teszt legyen

**Döntés:** a DoD negatív bizonyítékát **az `apps/admin` vitest suite-tel** kell igazolni, nem a `shared`/`api-client` jest-tel.

**Indoklás:** az `apps/admin` suite a legnagyobb (14 fájl, 145 teszt) és a legkisebb futásidejű a két vitest közül (16.6 s vs 38 s). A `shared`/`api-client` jest suite-ek ESM-flaget igényelnek (`--experimental-vm-modules`), ami a [`ci.yml:69-75`](../../.github/workflows/ci.yml:69) kommentje szerint **nem fogadható át parancssori flagként** pnpm-en keresztül — ezért a jest-szintű negatív próba törékeny lenne. A vitest tiszta `vitest run`, nincs ilyen korlát.

**A negatív próba mechanizmusa (nem commitolható változtatás):**

1. Nyisson egy PR-t egy **eldobható branch**-en.
2. A branch-en szándékosan elront egy admin-tesztet (pl. `apps/admin/src/lib/date.test.ts` egy `expect` értékét elrontja).
3. A CI **`build-test` jobja piros lesz**, és a hibaüzenetben a hibás teszt neve látszik.
4. A branch visszaállítása után a CI **zöld**.

**Kritikus részlet:** a `&&`-lánc miatt a `shared` és `api-client` suite-ok **lefutnak és zöldek** lesznek, majd az `admin` suite elbukik → a lánc itt áll meg → **a CI piros**. Ez bizonyítja, hogy az admin-tesztek _valóban_ futnak a CI-ban (nem csak a lokális gépen). Ez a bizonyíték értéke: ha a `pnpm test` lánc elhasalna az admin-szintű linken, a CI zöld maradna, és a negatív próba **elpirosodna** — pont erre való.

### D6 — A docs frissítés: a SonarQube spec és a CI komment

**Döntés:** két doksi frissül a változással együtt.

1. **[`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md:1)** — a „Jelenlegi állapot / ismert korlátok" szekció 7. pontja azt mondja: „CI integráció (`.github/workflows/ci.yml` + `SONAR_TOKEN` secret, `sonar.qualitygate.wait=true`) szándékosan külön feladat". Ez **továbbra is igaz** (a coverage/scan nem kerül a PR-jobba, D2), de a doksinak mostantól ki kell mondania, hogy **a PR-job a teljes unit-mátrixot futtatja**, és a SonarQube-pipeline (AIS-78) ezt a mátrixot használja a coverage-re. A fejléc `**Utolsó frissítés:**` dátumát is frissíteni kell.
2. **[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:1)** fejléckomment (12. sor) — jelenleg: „`pnpm --filter @callback/api test` succeeds (Jest unit tests)". Ezután: „`pnpm test` succeeds — the full unit matrix (shared, api-client, ui, admin, api)".

**Miért kötelező:** a [`instructions.md`](../../.roo/rules/instructions.md:1) szabálya szerint, ha a kód/konfiguráció változik, az érintett specs doksit frissíteni kell. A SonarQube spec az egyetlen élő doks, ami a CI test-scope-ot írja le.

### D7 — A `docs/history/` bejegyzés és a milestone

A [`instructions.md`](../../.roo/rules/instructions.md:1) minden beszélgetést/planelt/implementációt kér: `docs/history/<YYYY-MM-DD--HH-ii-ss>-<short-description>.md`. A `docs/milestones/` a nem triviális döntések megőrzésére való — ez a ticket **négy olyan döntést** tartalmaz, amelyet egy későbbi olvasó kontextus nélkül nem értelmezne (főleg a Node 22 → 24 emelés és annak indoka), tehát **milestone is készül**.

---

## 3. Változtatások listája

| #   | Fájl                                                               | Változás                                                                                                                                                                               |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:76)    | `pnpm --filter @callback/api test` lépés → `pnpm test` lépés; a lépés neve `Unit tests (full matrix)`; a lépés kommentje rögzíti a lefedett package-eket és a `&&`-lánc hibaterjedését |
| 2   | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:52)    | `node-version: 22` → `node-version: 24` (D3) — a komment a `require(esm)` indoklással egészül ki                                                                                       |
| 3   | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:36)    | `timeout-minutes: 15` → `20` (D4)                                                                                                                                                      |
| 4   | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:11)    | fejléckomment frissítés (D6.2)                                                                                                                                                         |
| 5   | [`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md:1)       | §7 pont frissítés + `**Utolsó frissítés:**` dátum (D6.1)                                                                                                                               |
| 6   | `docs/history/<dátum>-ais-121-ci-full-test-matrix.md`              | kivonulás (D7)                                                                                                                                                                         |
| 7   | `docs/milestones/<dátum>-ais-121-ci-full-test-matrix.milestone.md` | döntés-szintű összegzés (D7)                                                                                                                                                           |
| 8   | —                                                                  | **nem változik**: `package.json` (a root `test` script már kanonikus), a package-ek `test` scriptjei, a vitest/jest konfigok                                                           |

**A `package.json`-okhoz nem nyúlunk** — ez a lényeg: a root `test` script már létezik és helyes, csak a CI nem hívta. A változás 3 sor a workflow-ban.

---

## 4. A végrehajtás lépései

### Fázis 0 — Előkészítés (a Node 24 kockázat kezelése) ✅ ELKÉSZÜLT

Mivel a Node 24-es `api` unit suite **soha nem futott** még (a `build-test` job mindig Node 22-t használt), a Node 24-re emelés **új** kockázatot hoz: az `api-keys.module.spec.ts` valódi module-compile-ja mostantól élesben fut.

- [x] **0.1** Node 24-es runtime-t biztosítani → `fnm install 24` → **v24.22.2** (`C:\Users\zakza\AppData\Roaming\fnm\node-versions\v24.22.2\installation`).
- [x] **0.2** `pnpm --filter @callback/api test` Node 24-en → **38 suite / 360 teszt, mind zöld**, és a `api-keys.module.spec.ts` valódi module-compile tesztje **lefutott (419 ms)** — nincs `skipped real-module compile` warning. A kockázat R1 **lezárva**.
- [x] **0.3** Nem szükséges — a module-compile Node 24-en **nem hasal el**.
- [x] **0.4** A teljes `pnpm test` Node 24-en → **772 teszt / 71 fájl, 0 bukás** (shared 99, api-client 97, ui 71, admin 145, api 360).

### Fázis 1 — A CI-változás ✅ ELKÉSZÜLT

- [x] **1.1** A [`ci.yml`](../../.github/workflows/ci.yml:101) unit-teszt lépése cseréje `pnpm test`-re, a lépés nevének és kommentjének frissítésével.
- [x] **1.2** `node-version: 22` → `24`, indoklással a kommentben.
- [x] **1.3** `timeout-minutes: 15` → `20`.
- [x] **1.4** A fejléckomment (12. sor) frissítése.
- [x] **1.5** `prettier --check .github/workflows/ci.yml` → **tiszta**.

### Fázis 2 — A negatív bizonyíték (a DoD szigorú része) ✅ ELKÉSZÜLT

**Ez a fázis nyílt PR-t igényel** — a negatív bizonyíték csak a CI-ben bizonyítható, lokálisan nem.

- [x] **2.1** Eldobható branch: `chore/ais-121-negative-proof` (a `main`-ből).
- [x] **2.2** Szándékosan elrontott admin-teszt: `apps/admin/src/lib/date.test.ts:46` — `getDate()` `1` → `2`. Lokálisan: **1 failed / 172 passed**.
- [x] **2.3** PR #8 nyitva → a CI run `41135219763` a `Unit tests (full matrix)` lépésen **piros**.
- [x] **2.4** **Ellenőrzés:** a build-test job lépései — a 8. lépésig (checkout, setup, install, build, lint) mind ✅, a 9. lépés (`Unit tests (full matrix)`) ❌. A lánc tehát a `shared`/`api-client`/`ui` zöld futása **után** az `admin` suite-nél állt meg — bizonyítva, hogy az admin-tesztek valóban a CI-ban futnak. A job 47 s alatt failelt (nem timeout).
- [x] **2.5** A teszt visszaállítása (`dc40361` revert) → PR #8 merge `674cae5` → **4 checks passed**.
- [x] **2.6** A branch törölve (lokálisan és a remote-on), a PR #8 lezárva.

### Fázis 3 — Dokumentáció ✅ ELKÉSZÜLT

- [x] **3.1** [`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md:100) §7 frissítése + a fejléc dátuma.
- [x] **3.2** `docs/history/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.md` megírása.
- [x] **3.3** `docs/milestones/2026-10-30--16-35-00-ais-121-ci-full-test-matrix.milestone.md` megírása (a 6 kötelező szektorral).
- [x] **3.4** Az AIS-121 Jira ticket DoD-jának kipipálása a bizonyítékok alapján — a negatív bizonyíték lefutott (Fázis 2).

---

## 5. A DoD ellenőrzési listája

| DoD pont                                                                                                     | Hol bizonyul                                              | Státusz                                                                                |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A `build-test` job lefuttatja a `shared`, `api-client`, `ui` és `admin` teszteket is                         | A CI log a `pnpm test` kimenete — mind az 5 suite látszik | ✅ Fázis 1 — lokálisan igazolt: 772 teszt / 71 fájl / 0 bukás                          |
| **Negatív bizonyíték:** a szándékosan elrontott admin-teszttel a CI **piros**, a visszaállítás után **zöld** | Fázis 2 teljes jegyzőkönyve                               | ✅ Fázis 2 — CI run `41135219763` ❌ failure, PR #8 merge `674cae5` ✅ 4 checks passed |
| A job futásideje a változás előtti értékhez képest ésszerű (a timeout nem kell)                              | A job sikeres lefutása + a timeout 20 perc                | ✅ Fázis 1 — a mátrix ~1 percet ad hozzá                                               |
| `docs/Specs/SonarQube.md` és a CI komment frissül                                                            | Fázis 3.1 + 1.4 diff                                      | ✅ Fázis 3                                                                             |
| _(kiegészítő)_ Az `api` unit suite valódi module-compile tesztje is fut, nem skipel                          | Fázis 0.2 — a loud skip warning hiánya a CI logban        | ✅ Fázis 0 — Node 24-en lefutott (419 ms)                                              |

---

## 6. Kockázatok

| #   | Kockázat                                                                         | Valószínűség | Hatás                                          | Mitigáció                                                                                         |
| --- | -------------------------------------------------------------------------------- | ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R1  | A Node 24-es `api` unit suite valódi module-compile-ja elhasal (soha nem futott) | közepes      | a CI piros lesz az átálláskor                  | Fázis 0.2 — előbb validálni; a 0.3-as opciók (metadata-assertion / gate kiterjesztése) a kiút     |
| R2  | A teljes mátrix növeli a PR-gate futásidőt                                       | alacsony     | nincs (a növekedés ~1 perc, a timeout 20 perc) | Fázis 1.3                                                                                         |
| R3  | A `pnpm test` `&&`-lánc elrejti, melyik package bukott                           | alacsony     | diagnosztikai zaj                              | A bukó suite saját kimenete a logban; a lépés neve és a komment a láncot dokumentálja             |
| R4  | A Node 22 → 24 emelés a `ui`/`admin` vitest viselkedését megváltoztatja          | alacsony     | teszt-hiba                                     | Fázis 0.4 — a teljes `pnpm test` Node 24-en                                                       |
| R5  | A negatív próba nyílt PR-t hagy hátra                                            | alacsony     | repo-zaj                                       | Fázis 2.6 — a branch törlése a próba után                                                         |
| R6  | A `apps/web` néma no-op-ja összekeveredik a valódi bukással                      | alacsony     | hamis zöld                                     | A `web` **nincs** a root `pnpm test` láncban → a CI nem is futtatja; a Finding 3 ezt dokumentálja |

---

## 7. Mit NEM csinálunk

- **Nem** módosítjuk a root `package.json` `test` scriptjét — már kanonikus.
- **Nem** adunk `coverage`/`sonar` lépést a `build-test` jobba (D2, AIS-78 külön pipeline).
- **Nem** nyúlunk a `packages/ui`/`packages/shared`/`packages/api-client`/`apps/admin` `package.json`-hoz vagy a vitest/jest konfigokhoz.
- **Nem** vonjuk össze a `build-test` és az `api-e2e` jobot.
- **Nem** vezetjük be a `knip`/réteg-lint/paletta-check kapukat — az a **AIS-121** testvér-ticket (és az AIS-105 T4-5) hatókörje; ez a ticket csak a _teszt-mátrix futtatása_.
- **Nem** töröljük az `api-e2e` job Node 24-es beállítását — ez a D3 alapja, ott már helyes.
- **Nem** nyitunk új függőséget és nem módosítunk lockfile-t.

---

## 8. Következő lépések (a backlogban)

Az AIS-105 story subtaskjai és a függőségeik, a mostani állapot szerint:

| Ticket      | Tartalom                                                             | Előfeltétel                        | Prioritás                       |
| ----------- | -------------------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| **AIS-121** | CI teszt-mátrix                                                      | —                                  | Highest — **a jelenlegi munka** |
| **AIS-118** | `src/app/` réteg (providers, route registry, layout, error boundary) | AIS-74, AIS-84                     | Highest                         |
| **AIS-119** | URL-alapú lista-állapot (`useListParams`)                            | AIS-106, AIS-118                   | High                            |
| **AIS-120** | MSW teszt harness                                                    | AIS-109, AIS-114                   | High                            |
| **AIS-122** | Quality gate: réteg-lint, knip, paletta-check                        | **AIS-120**, **AIS-118**           | High                            |
| **AIS-123** | docs: Admin-Data-Flow + Forms-and-Validation spec                    | az AIS-102…104 és AIS-118…121 után | Medium                          |

**A legközelebbi logikus lépés: AIS-118** (`src/app/` réteg).

**Miért az, nem más:**

- **AIS-122** (a minőségkapu) **előfeltétele** az AIS-120 és az AIS-118 — a réteg-definíció nem állhat
  egy nem létező `src/app/` réteg fölé, és a kapu csak akkor értékes, ha a tesztek is futnak (ez a
  mostani AIS-121 értelme). Tehát AIS-122 **nem** jöhet először.
- **AIS-119** az AIS-118-ra épül (a route registry kell a szűrő URL-ben való tárolásához).
- **AIS-120** az AIS-109-re és AIS-114-re épül — ezek az AIS-102 (adatáramlás) subtaskjai, tehát
  távolabb van.
- Az AIS-102/103/104 story-k (Highest) az AIS-105-től **független** futhatnak, és ők a szerződés-
  és UI-alapot adják. Az AIS-105 csak akkor tud „mag-alapot" építeni, ha az AIS-102 (transport)
  és az AIS-104 (primitívek) előbb kész.

**Két párhuzamos út lehetséges:**

1. **AIS-105 szál:** AIS-121 lezárása (negatív bizonyíték) → AIS-118 → AIS-120 → AIS-119 → AIS-122 → AIS-123
2. **AIS-102/103/104 szál:** a szerződés, a form és a primitívek — ezek adják az AIS-105 számára a
   `useApiList` hookot (AIS-114), a `listQuerySchema`-t (AIS-106) és az `ApiResult` transzportot (AIS-109),
   amiket az AIS-119/120/122 fogyaszt.

**Az AIS-121 lezárásához még kell egy PR** (a negatív bizonyíték) — ez a legkisebb ráfordítású
lépés, és a mostani változás PR-ja önmagában már bizonyítja a pozitív oldalt (a `Unit tests (full
matrix)` lépés mind az 5 suite-ot futtatja).

---

## 9. Hivatkozások

- Ticket: AIS-121 (AIS-105 subtask) — Jira
- Kapcsolódó tervek: [`2026-10-30--13-50-00-admin-foundation-jira-themes-review-plan.md`](2026-10-30--13-50-00-admin-foundation-jira-themes-review-plan.md:1) (K1/K7 finding — a CI-hiány azonosítása), [`2026-10-27--11-41-38-git-hooks-quality-gate-plan.md`](2026-10-27--11-41-38-git-hooks-quality-gate-plan.md:1) (a gyors győzelmek listája, ugyanaz a CI-hiány)
- Kapcsolódó ticketek: AIS-78 (SonarQube pipeline), AIS-97 (e2e gate), AIS-105 (parent story), AIS-102…104 (a következő teszteket író story-k)
- Érintett kód: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:1), [`package.json:14`](../../package.json:14), [`apps/api/test/lib/app-module-gate.ts`](../../apps/api/test/lib/app-module-gate.ts:1), [`apps/api/src/api-keys/api-keys.module.spec.ts`](../../apps/api/src/api-keys/api-keys.module.spec.ts:1), [`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md:1)
