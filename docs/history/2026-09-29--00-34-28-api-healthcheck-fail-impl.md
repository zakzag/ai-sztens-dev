# Implementáció: `aisztens-api-1` healthcheck ExitCode 1 javítása

**Dátum:** 2026-09-28 (CEST)
**Szerző:** Zoo (code mode)
**Terv:** [`2026-09-28-api-healthcheck-fail-plan.md`](2026-09-28-api-healthcheck-fail-plan.md)
**Állapot:** kész, deploy-ra vár

---

## 1. Összefoglaló

A dropleten a korábbi dual-stack port-ütközés megoldódott, de az `aisztens-api-1`
továbbra is `Restarting (1)` státuszban volt, mert a Docker healthcheck a
`fetch('http://127.0.0.1:3000/api')` hívással `ExitCode 1`-et adott. A terv
szerint bevezettünk egy dedikált liveness endpointot, és a healthcheck parancsot
úgy írtuk át, hogy a sikeres utat explicit `process.exit(0)`-val jelezze.

A változtatás **nem** érinti a meglévő `AppController.getHello()` üzleti
route-ot (a `/api` továbbra is 200 + `Hello World!`), csak a healthcheck
szétválasztásáról szól.

## 2. Változtatott fájlok

| Fájl | Változtatás |
|---|---|
| [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts) | **Új.** `HealthController` a `GET /healthz` route-tal. JSON `{"status":"ok","uptime":N,"timestamp":"..."}`-t ad vissza. Nincs guard, nincs pipe, nincs middleware. |
| [`apps/api/src/health/health.module.ts`](../../apps/api/src/health/health.module.ts) | **Új.** A `HealthController` modulszintű regisztrációja. |
| [`apps/api/src/app.module.ts:5,11`](../../apps/api/src/app.module.ts) | `HealthModule` importálása és az `imports` tömbbe fűzése. |
| [`apps/api/src/main.ts:16`](../../apps/api/src/main.ts) | `setGlobalPrefix('api', { exclude: ['healthz'] })` — a health route kimarad a globális prefix alól, így `/healthz` marad, nem `/api/healthz`. |
| [`apps/api/src/health/health.controller.spec.ts`](../../apps/api/src/health/health.controller.spec.ts) | **Új.** Unit teszt: a controller `check()` metódusa helyes `status`, `uptime` és `timestamp` mezőket ad. |
| [`apps/api/test/health.e2e-spec.ts`](../../apps/api/test/health.e2e-spec.ts) | **Új.** E2E teszt: `GET /healthz` 200 + JSON; `GET /api/healthz` 404 (a prefix alól valóban kimarad). |
| [`infra/docker-compose.yml:41-52`](../../infra/docker-compose.yml) | Az `api` service healthcheck `test` blokkja a `/healthz`-t hívja, és mindkét ágon explicit `process.exit(r.ok?0:1)`-t használ. `start_period: 60s`, `retries: 10`. |
| [`infra/.env.example:34-38`](../../infra/.env.example) | `MONITOR_TARGET_URL` alapértéke `http://api:3000/healthz` (volt: `/api`). |
| [`infra/monitor/watch.sh:10`](../../infra/monitor/watch.sh) | A `TARGET_URL` defaultja `http://api:3000/healthz`. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | A 4.2 / 4.4 / 5. / 6. szakaszok frissítve: a `/healthz` az elsődleges referencia, a `/api` mint opcionális üzleti smoke route van jelölve. Az „Utolsó frissítés" dátum és a kapcsolódó milestone-linkek frissítve. |

## 3. Nem változtatott fájlok (szándékosan)

* [`apps/api/src/app.controller.ts`](../../apps/api/src/app.controller.ts) — a `Hello World!` route marad (frontend smoke tesztek és deploy sanity check használja).
* [`apps/api/test/app.e2e-spec.ts`](../../apps/api/test/app.e2e-spec.ts) — a `GET /` inject teszt változatlanul átmegy, mert az e2e app nem alkalmazza a globális prefixet.
* [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) — a Caddy nem igényel új route-ot; a `/healthz` a Fastify listenerén közvetlenül elérhető a belső hálón, és a Caddy a `reverse_proxy api:3000` szabállyal mindent továbbít.
* [`infra/app/Dockerfile`](../../infra/app/Dockerfile) — nincs szükség módosításra; a runtime image Node 22-ben a `fetch` globálisan elérhető.

## 4. A healthcheck viselkedésének változása

**Régi (a deploy előtt):**
```yaml
test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:${API_PORT:-3000}/api').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
interval: 15s, timeout: 5s, retries: 5, start_period: 30s
```

**Új:**
```yaml
test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:${API_PORT:-3000}/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
interval: 15s, timeout: 5s, retries: 10, start_period: 60s
```

A két fő különbség:

1. **URL**: `/api` (üzleti Hello World) → `/healthz` (dedikált liveness). Az
   új route a globális `api` prefix alól kivéve, így a NestJS routing változásai
   (pl. `api/v1` migráció) nem érintik.
2. **Exit-kód**: a sikeres ág most explicit `process.exit(0)`, nem a Node
   alapértelmezettére épít. Ha egy jövőbeli Node verzió megváltoztatná az
   alapértelmezettet, a healthcheck nem megy tönkre.

A `start_period: 60s` és `retries: 10` kombinációval a Docker összesen
`60 + 10×15 = 210 s` grace window-t ad a hideg indulásra, mielőtt a konténert
„igazi" hibásnak minősítené.

## 5. Ellenőrzés a deploy után

A dropleten az alábbi parancsok futtatandók (a
[`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) 4.2 / 4.4
szakaszai alapján):

```bash
# 1. A konténer státusza
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a
# Elvárt: aisztens-api-1  Up X minutes (healthy)

# 2. A healthcheck közvetlenül a konténerből
docker compose exec api wget -qO- http://127.0.0.1:3000/healthz
# Elvárt: {"status":"ok","uptime":N,"timestamp":"..."}

# 3. A Caddy-n keresztül (külső nézet)
curl -fsS https://api.aisztens.hu/healthz && echo
# Elvárt: {"status":"ok","uptime":N,"timestamp":"..."}

# 4. A monitor watchdog logja
docker compose logs --tail=50 monitor
# Elvárt: nincs "API check failed" sor

# 5. A healthcheck történeti állapota
docker inspect aisztens-api-1 --format '{{json .State.Health}}'
# Elvárt: {"Status":"healthy","FailingStreak":0,"Log":[{"exitCode":0,...}]}
```

## 6. Visszagörgetési terv

Ha bármi elromlana, a változtatások egyenként, függetlenül visszafordíthatók:

1. **A `/healthz` route-ot kikapcsolni** → visszaállítani a `setGlobalPrefix('api')`
   hívást a [`main.ts:16`](../../apps/api/src/main.ts) sorban. A healthcheck parancs
   `/api`-re visszaállítható a [`docker-compose.yml:42`](../../infra/docker-compose.yml)-ban.
2. **A healthcheck parancsot visszaállítani** a régi formára. A `/healthz`
   controller bent marad, de senki nem hívja.
3. **A monitor watchdog URL-jét** visszaállítani `/api`-re a
   [`watch.sh:10`](../../infra/monitor/watch.sh) sorban.

A konténer image és a függőségek nem változtak, így a rollback kockázata
minimális.

## 7. Kapcsolódó dokumentumok

* **Terv:** [`docs/history/2026-09-28-api-healthcheck-fail-plan.md`](2026-09-28-api-healthcheck-fail-plan.md)
* **Milestone:** [`docs/milestones/2026-09-28-api-healthcheck-fail.milestone.md`](../milestones/2026-09-28-api-healthcheck-fail.milestone.md)
* **Előzmény:** [`docs/history/2026-09-28-dual-stack-port-collision-fix-impl.md`](2026-09-28-dual-stack-port-collision-fix-impl.md) — a port-ütközés javítása, ami a CPU-terhelést megoldotta, de ezt a maradék healthcheck-hibát hagyta hátra.
