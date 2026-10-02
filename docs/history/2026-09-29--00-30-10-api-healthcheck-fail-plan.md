# Terv: `aisztens-api-1` healthcheck ExitCode 1 javítása

**Dátum:** 2026-09-28 (CEST)
**Szerző:** Zoo (code mode)
**Állapot:** terv, jóváhagyásra vár
**Előzmény:** [`2026-09-28-dual-stack-port-collision-fix-plan.md`](2026-09-28-dual-stack-port-collision-fix-plan.md) – a CPU/port-probléma megoldódott, de az API konténer továbbra is `Restarting (1)` státuszban van, mert a healthcheck `ExitCode 1`-et ad.

---

## 1. Tünet

* A dropleten a `docker ps` szerint `aisztens-api-1` státusza `Restarting (1)`.
* `docker inspect aisztens-api-1 --format '{{json .State.Health}}'`:
  ```json
  {"Status":"unhealthy","FailingStreak":N,"Log":[{"exitCode":1,"output":"..."}, ...]}
  ```
* A CPU-terhelés már 0%-on van (a korábbi Caddy port-ütközés megszűnt), tehát a
  konténer nem pörög, csak **egyszerűen nem lesz soha `healthy`**, és a
  `restart: unless-stopped` újra meg újra indítja.
* A Caddy nem éri el az API-t, mert a `depends_on: api: condition: service_started`
  ugyan átenged (a konténer elindult), de a NestJS valójában még nem fogad
  kapcsolatot a healthcheck időpillanatában.
* A user saját feltételezése: „a setGlobalPrefix('api') miatt a / route-ot a
  healthcheck nem találja, vagy a NestJS a postgres connection során száll el."

## 2. A user feltételezéseinek ellenőrzése

| User hipotézis | Kód-alapú vizsgálat | Verdikt |
|---|---|---|
| `setGlobalPrefix('api')` miatt nem találja a `/` route-ot | [`apps/api/src/main.ts:16`](../../apps/api/src/main.ts:16) `app.setGlobalPrefix('api')` → a controller `@Get()`-je a prefixszel együtt `/api`-n lesz elérhető. A healthcheck pont `/api`-t hív. | **A feltevés téves**: a `/api` route létezik, és a `AppController.getHello()` 200-zal tér vissza. |
| A NestJS a Postgres connection során száll el | [`apps/api/src/app.module.ts:8`](../../apps/api/src/app.module.ts:8) csak `ConfigModule.forRoot({ isGlobal: true })`-et tölt be, nincs TypeORM/Prisma/driver. A `DATABASE_URL` env be van állítva, de senki nem használja. | **A feltevés téves**: jelenleg nincs DB-kapcsolat a bootstrapben. |

Tehát a healthcheck `ExitCode 1`-je **nem** a két user-hipotézis miatt van.
A valódi okot lentebb azonosítom.

## 3. A healthcheck és a NestJS boot kölcsönhatása

A healthcheck parancs ([`infra/docker-compose.yml:42`](../../infra/docker-compose.yml:42)):

```yaml
test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:${API_PORT:-3000}/api').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
interval: 15s
timeout: 5s
retries: 5
start_period: 30s
```

A konténer indulásának lépései ([`infra/app/Dockerfile:76`](../../infra/app/Dockerfile:76) + [`apps/api/package.json`](../../apps/api/package.json)):

1. Container start → `pnpm --filter @callback/api start:prod`
2. A `start:prod` script a lefordított `dist/main.js`-t indítja (`node dist/main.js`).
3. A `bootstrap()` végigmegy a module init-en, majd `app.listen(3000)`.

A két folyamat versenyzik:

* A `start_period: 30s` azt jelenti, hogy a Docker az első 30 másodpercben
  **nem tekinti hibának** a nem-0 kilépést.
* Ha a NestJS 30 s alatt nem áll kész, a healthcheck aktívvá válik, és a `node -e`
  `fetch()`-e `ECONNREFUSED`-ot dob → `.catch(()=>process.exit(1))` → kilép 1-gyel
  → `unhealthy`.

Empirikus tényezők, amik lassítják a cold startot:

* A `runtime` image-ben nincs `pnpm install` – csak a `build` stage-ből másolt
  `node_modules` van, de a `pnpm --filter @callback/api start:prod` parancs
  **mégis meghívja a pnpm-et**, ami a `node_modules/.pnpm` felépítését és a
  workspace symlinkek ellenőrzését végzi. Ez cold starton 5–15 s.
* A Fastify `app.listen()` saját maga is 1–3 s-ig tart (plugin regisztráció,
  route-ok felépítése).
* Az első healthcheck `start_period` után azonnal fut (0 s-mal késleltetve),
  nem várja meg a NestJS kész állapotát.

## 4. Gyökérok

A healthcheck parancs **két, egymást erősítő hibát** egyesít:

1. **Nincs dedikált health endpoint.** A `GET /api` a `AppController.getHello()`-ra
   megy, ami egy üzleti „Hello World!” stringet ad vissza. Ez:
   * **rossz szeparáció** – a health-nek nem szabad üzleti route-okkal
     osztoznia,
   * **rossz jelzés** – ha bármikor megváltozik a controller (pl. auth guard
     kerül rá, vagy a service bármitől függ), a healthcheck azonnal elromlik,
   * **rossz tartalom** – a healthcheck egy integer kódra épül, nem pedig
     explicit JSON státuszra (`{ "status": "ok", ... }`).

2. **A healthcheck shell-parancs nem jelzi a sikeres utat.** A lánc csak a
   `process.exit(1)`-et kezeli, és a sikeres ágon (`r.ok === true`) **nem hív
   `process.exit(0)`-t**. Az exit kód a Node alapértelmezett 0-s értéke lesz, ami
   történetesen most jó, DE:
   * Ha a fetch lassú, a 5 s-os `timeout` lejár, a Node child_process
     `SIGTERM`-et kap, és a kilépési kód `143`/`124` – ezt a Docker **szintén
     hibának** tekinti.
   * A `fetch()` alapértelmezetten nincs `AbortController`-hoz kötve, így a
     timeout csak a `node -e` processzt öli meg, de a fetch promise tovább él
     a háttérben (nem baj, de nem is optimális).

3. **A `start_period: 30s` rövid.** Első indításkor (image pull + pnpm + NestJS
   bootstrap) a 30 s nem mindig elég. A `retries: 5` csak 5 próbát ad
   15 s-onként, azaz a teljes grace window 30 + 5×15 = 105 s. Ha a NestJS 110 s
   alatt áll csak kész, a konténer halottnak minősül.

4. **A healthcheck `fetch` URL-je a NestJS globális prefixére épül.** Ha a
   jövőben a prefix megváltozik (pl. `api/v1`), a healthcheck azonnal eltörik,
   és a konténer `Restarting` státuszba kerül – ez egy „kemény csatolás”.

## 5. A terv – javítási lehetőségek

Három, egymásra épülő változtatást javaslok, a lehető legkisebb
kockázattal.

### 5.1 Dedikált health endpoint bevezetése

**Cél:** A healthcheck ne függjön az üzleti route-októl.

* Új module / controller: `apps/api/src/health/health.controller.ts`,
  route: `GET /healthz` (a globális prefix **alól kivéve**, lásd lentebb).
* Válasz: `200 OK` + `application/json` body `{"status":"ok","uptime":<sec>}`.
* A globális prefix-szel kapcsolatos megoldás: a NestJS `setGlobalPrefix`
  támogatja az `exclude` opciót – a health route-ot kizárjuk a prefix alól:
  ```ts
  app.setGlobalPrefix('api', { exclude: ['healthz', 'healthz/(.*)'] });
  ```
  Így a health endpoint `GET /healthz` marad, függetlenül az üzleti
  route-ok prefix-változásaitól.

### 5.2 A healthcheck parancs átírása

**Cél:** Explicit 0-s kilépés siker esetén, és a timeout-tal szembeni
védettség.

* A `docker-compose.yml` healthcheck `test:`-je legyen egy
  **külön healthcheck script**, ami az API image-ben van (vagy egy `wget`
  one-liner):
  ```yaml
  test:
    - CMD-SHELL
    - 'wget -q -T 4 -O - http://127.0.0.1:3000/healthz | grep -q "ok" || exit 1'
  ```
  Vagy ha a Node-os megoldás marad (konzisztens a mostani kóddal):
  ```yaml
  test:
    - CMD
    - node
    - -e
    - "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  ```
  A `process.exit(r.ok?0:1)` az explicit 0-s kilépés, így ha bármi
  megváltozik a Node alapértelmezésében (újabb Node verzió), a healthcheck
  nem megy tönkre.

* A `start_period: 30s` → `start_period: 60s` (hideg indítás grace window).
* A `retries: 5` → `retries: 10` (elegendő buffer a lassú bootra, közben
  a `docker ps` státusza `health: starting`, nem `unhealthy`).
* Az `interval: 15s` marad.

### 5.3 A monitor watchdog URL-jének szinkronizálása

**Cél:** A [`infra/monitor/watch.sh:10`](../../infra/monitor/watch.sh:10) jelenleg
`http://api:3000/api`-t hív, ami megegyezik a korábbi, most leváltandó
healthcheck URL-jével. Ha a healthchecket `/healthz`-re váltjuk, a monitor is
azt hívja (mert az üzleti `/api` route-ok auth guard mögé kerülhetnek).

* `infra/.env`-ben a `MONITOR_TARGET_URL` legyen
  `http://api:3000/healthz` (alapértelmezés a `infra/.env.example`-ban).

## 6. Akcióterv (lépésenként, jóváhagyásra vár)

### 6.1 Kód-módosítások (lokálban, commitolandó)

1. **`apps/api/src/health/health.controller.ts`** – új fájl:
   * `@Controller('healthz')` export class `HealthController`
   * `@Get()` metódus: visszaadja `{ status: 'ok', uptime: process.uptime() }`.
2. **`apps/api/src/health/health.module.ts`** – új fájl:
   * `@Module({ controllers: [HealthController] })`.
3. **`apps/api/src/app.module.ts`** – importálja a `HealthModule`-t.
4. **`apps/api/src/main.ts`** – a `setGlobalPrefix` hívás legyen
   `setGlobalPrefix('api', { exclude: ['healthz'] })`.
5. **`apps/api/src/app.controller.ts` + `app.controller.spec.ts`** – a
   `Hello World!` controller marad (a frontend smoke teszthez kell), de a
   healthcheck nem hivatkozik rá.

### 6.2 docker-compose / monitor

6. **`infra/docker-compose.yml`** – az `api` service healthcheck:
   * `test` legyen a Node-os one-liner `process.exit(r.ok?0:1)`-rel,
     URL `/healthz`.
   * `start_period: 60s`, `retries: 10`.
7. **`infra/.env.example`** – `MONITOR_TARGET_URL` alapértéke
   `http://api:3000/healthz`.

### 6.3 Tesztek

8. **`apps/api/test/health.e2e-spec.ts`** – új e2e teszt:
   * `GET /healthz` → 200 + JSON `{ status: 'ok', ... }`.
9. **`apps/api/src/health/health.controller.spec.ts`** – unit teszt a
   controllerre.

### 6.4 Specs doksi frissítése

10. **`docs/Specs/Production-Runbook.md`** – a runbook „API healthcheck”
    fejezetében a `/healthz` endpoint legyen a referencia.
11. **`docs/Specs/Functional-Specification.md`** – ha a monitoring/health
    szekcióban van hivatkozás a `/api` route-ra, frissíteni kell.

### 6.5 History + milestone

12. **`docs/history/2026-09-28-api-healthcheck-fail-plan.md`** – ez a fájl.
13. **`docs/milestones/2026-09-28-api-healthcheck-fail.milestone.md`** –
    döntés szintű összefoglaló, miért fontos, hogy a healthcheck
    dedikált endpointra épüljön, és ne az üzleti route-okkal osztozzon.

## 7. Nem változtatunk

* **`apps/api/src/app.controller.ts` Hello World route** – marad (a
  smoke teszteknek és a frontend alapellenőrzésnek kell).
* **`infra/caddy/Caddyfile`** – a `/api/*` proxyzás marad, a `/healthz`-t
  nem kell külön expose-olni, mert az csak belső (Docker healthcheck +
  monitor watchdog használja).
* **A `Memória-korlátok` és a `port-ütközés` kapcsán hozott döntések** –
  változatlanok.

## 8. Siker-kritériumok

| Kritérium | Hogyan ellenőrizzük |
|---|---|
| A `aisztens-api-1` konténer státusza `Up (healthy)` | `docker ps` – a `STATUS` oszlopban `Up X minutes (healthy)` |
| A healthcheck `exitCode: 0` | `docker inspect aisztens-api-1 --format '{{json .State.Health}}'` |
| `curl http://127.0.0.1:3000/healthz` (a konténeren belül) `{"status":"ok",...}` | `docker exec aisztens-api-1 wget -qO- http://127.0.0.1:3000/healthz` |
| A `aisztens-monitor-1` watchdog sem jelez hibát | `docker logs aisztens-monitor-1` – nincs „API check failed” sor |
| A CI `apps/api` e2e + unit teszt zöld | `pnpm --filter @callback/api test` és `pnpm --filter @callback/api test:e2e` |
| A Caddy-n át `https://api.aisztens.hu/api` továbbra is 200 | `curl -fsS https://api.aisztens.hu/api` (kívülről) |

## 9. Kockázatok / visszafordíthatóság

* **Visszafordítható egyszerűen** – a `/healthz` controller és a
  `setGlobalPrefix` `exclude` opciója egymástól függetlenül is
  visszafordítható, és a healthcheck parancs visszaállítható a régi
  `fetch('/api')` formára.
* **A `start_period` növelése** – ha a NestJS gyorsabban indul, a
  konténer korábban lesz `healthy`, nincs hátrány.
* **A monitor URL váltás** – ha a `/healthz` mégsem elérhető, a monitor
  `down` alertet küld, ami operatívan azonnal látszik (nem okoz
  adatvesztést, csak zajt).
* **A CI futásideje** – 1 új e2e teszt + 1 új unit teszt < 1 s extra idő.
