# Milestone: API healthcheck dedikált `/healthz` endpointra váltás

**Dátum:** 2026-09-28
**Szerző:** Zoo (code mode)
**Kapcsolódik:** [`2026-09-29--00-30-10-api-healthcheck-fail-plan.md`](../history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md), [`2026-09-29--00-34-28-api-healthcheck-fail-impl.md`](../history/2026-09-29--00-34-28-api-healthcheck-fail-impl.md), [`2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md`](./2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md)

## 1. Problem

A [`2026-09-28-dual-stack-port-collision-fix`](2026-09-28-dual-stack-port-collision-fix.milestone.md) megoldotta a CPU-terhelést és a port-ütközést, de a dropleten az `aisztens-api-1` konténer továbbra is `Restarting (1)` státuszban maradt. A Docker healthcheck `fetch('http://127.0.0.1:3000/api')` hívása `ExitCode 1`-et adott, így a `restart: unless-stopped` folyamatosan újraindította a NestJS-t. A Caddy `depends_on: api: condition: service_started` átenged ugyan, de a NestJS valójában nem szolgálta ki a kérést, és a VAPI webhookok / frontend hívások elhaltak.

A user két hipotézise (a `setGlobalPrefix('api')` miatti route-hiány, illetve a Postgres connection) a kód átolvasása után **mindkettő cáfolható**: a `/api` route létezik és 200-zal tér vissza, és nincs DB driver az `AppModule`-ban.

## 2. Root cause

A healthcheck három, egymást erősítő hiányosságot egyesít:

| # | Probléma | Hatás |
|---|---|---|
| 1 | **Nincs dedikált health endpoint** — a `/api` az üzleti `AppController.getHello()`-t hívja. | Ha a controllerra bármikor guard/pipe kerül, a healthcheck azonnal elromlik. |
| 2 | **A healthcheck `node -e` script nem jelenti a sikert** — csak a `.then(r=>{if(!r.ok)process.exit(1)})` és `.catch(()=>process.exit(1))` ágak hívnak `exit`-et; a sikeres ág a Node alapértelmezett 0-s kódjára épít. | Egy jövőbeli Node verzió-változás csendben elronthatja. |
| 3 | **`start_period: 30s` + `retries: 5` rövid** — első indításkor (image pull + pnpm symlinkek + NestJS bootstrap + Fastify bind) a grace window nem volt elég. | A konténer „RESTARTING" státuszba került, és a NestJS-t újra meg újra megölték a 30 s-os healthcheckek. |

A **4.** probléma (kevésbé fontos): a healthcheck URL a globális `api` prefixre épült, így bármilyen jövőbeli prefix-változás (pl. `api/v1`) azonnal törte volna a healthchecket.

## 3. Solution

A healthchecket **szétválasztottuk** az üzleti routingtól:

* **Új `HealthController` + `HealthModule`** a [`apps/api/src/health/`](../../apps/api/src/health/) mappában. A `GET /healthz` route a globális `api` prefix **alól kivéve** (`setGlobalPrefix('api', { exclude: ['healthz'] })` a [`main.ts:16`](../../apps/api/src/main.ts)-ban), így az URL stabil marad. A válasz JSON: `{"status":"ok","uptime":N,"timestamp":"..."}`.
* **A healthcheck parancs átírva** [`infra/docker-compose.yml:42`](../../infra/docker-compose.yml): `process.exit(r.ok?0:1)` mindkét ágon; URL `/healthz`; `start_period: 60s`; `retries: 10`.
* **A monitor watchdog URL szinkronizálva** [`infra/monitor/watch.sh:10`](../../infra/monitor/watch.sh) + [`infra/.env.example:35`](../../infra/.env.example) → `http://api:3000/healthz`.
* **Tesztek:** unit ([`health.controller.spec.ts`](../../apps/api/src/health/health.controller.spec.ts)) + e2e ([`health.e2e-spec.ts`](../../apps/api/test/health.e2e-spec.ts)) — utóbbi azt is ellenőrzi, hogy `/api/healthz` 404, tehát a `setGlobalPrefix` `exclude` szabálya valóban érvényesül.
* **A meglévő `AppController` Hello World route-ja maradt** — a frontend smoke tesztek és a deploy sanity check használja, de a healthcheck **nem**.

A Production-Runbook ([`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md)) 4.2 / 4.4 / 5. / 6. szakaszai frissítve: a `/healthz` az elsődleges referencia, a `/api` opcionális üzleti smoke route-ként van jelölve.

## 4. Changed files

| Fájl | Változtatás |
|---|---|
| `apps/api/src/health/health.controller.ts` | Új controller, `GET /healthz`. |
| `apps/api/src/health/health.module.ts` | Új module. |
| `apps/api/src/health/health.controller.spec.ts` | Új unit teszt (3 it-cím). |
| `apps/api/test/health.e2e-spec.ts` | Új e2e teszt (2 it-cím, a prefix-kizárást is ellenőrzi). |
| `apps/api/src/app.module.ts` | `HealthModule` importálva. |
| `apps/api/src/main.ts` | `setGlobalPrefix('api', { exclude: ['healthz'] })`. |
| `infra/docker-compose.yml` | Healthcheck URL → `/healthz`, explicit exit kód, `start_period: 60s`, `retries: 10`. |
| `infra/.env.example` | `MONITOR_TARGET_URL` → `http://api:3000/healthz`. |
| `infra/monitor/watch.sh` | Default `TARGET_URL` → `/healthz`. |
| `docs/Specs/Production-Runbook.md` | 4.2 / 4.4 / 5. / 6. szakaszok + fejléc frissítve. |

## 5. Outcome and how to verify

A deploy után a dropleten az alábbi parancsok futtatandók (a Production-Runbook 4.2 / 4.4 szakaszai):

```bash
# Konténer státusza — Up + (healthy) elvárt
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a

# Liveness a konténerből
docker compose exec api wget -qO- http://127.0.0.1:3000/healthz
# Elvárt: {"status":"ok","uptime":N,"timestamp":"..."}

# Caddy-n át (külső nézet)
curl -fsS https://api.aisztens.hu/healthz && echo
# Elvárt: {"status":"ok","uptime":N,"timestamp":"..."}

# A healthcheck történeti állapota
docker inspect aisztens-api-1 --format '{{json .State.Health}}'
# Elvárt: {"Status":"healthy","FailingStreak":0,"Log":[{"exitCode":0,...}]}
```

A CI a [`pnpm --filter @callback/api test`](../../apps/api/) unit tesztjeit futtatja — a `health.controller.spec.ts` automatikusan bekerül. Az e2e teszt a lokális / deploy-time `pnpm test:e2e` futással ellenőrizhető.

## 6. Follow-ups

* Ha a jövőben readiness / liveness szétválasztás kell (pl. DB-függőség bevezetésekor), a `HealthController` `ready()` metódussal bővíthető, és a Docker `healthcheck.test` két lépcsősre cserélhető. A mostani `check()` liveness marad.
* A `/healthz` route-ot **soha ne** lássa el auth guarddal, rate limiterrel vagy validációs pipe-pal — a healthcheck mindig „nulla-függőségű" kell, hogy maradjon.
* Ha a `setGlobalPrefix` jövőben `api/v1`-re vált, a `exclude: ['healthz']` listát frissíteni kell, és ezt a Production-Runbook 6. szakasza („hibadiagnosztikai mátrix") már jelzi.
