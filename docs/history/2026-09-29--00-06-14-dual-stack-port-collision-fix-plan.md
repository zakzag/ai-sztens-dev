# Terv: dual-stack port-ütközés és CPU-terhelés megszüntetése a dropleten

**Dátum:** 2026-09-28 (CEST)
**Szerző:** Zoo (code mode)
**Állapot:** terv, jóváhagyásra vár

---

## 1. Tünet (a felhasználó jelzése)

- A droplet akár friss újraindítás után is belassul.
- Állítólag egy `pnpm-native` folyamat falja a CPU-t.
- A kért subdomain routing (`api.`, `web.`, `admin.`) még nem működik, és a user
  azt szeretné, ha a Caddy egyedül intézné a teljes forgalmat.

## 3. Mért adatok a dropletről (SSH-n ellenőrizve)

Parancsok: `top`, `ps`, `docker ps`, `docker stats`, `docker inspect`, `ss -tlnp`,
`docker logs`, `docker network ls`.

| Mutató                                        | Érték                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Uptime                                        | 7 perc (friss boot)                                                                    |
| Load average                                  | 3.38 / 2.36 / 1.23 (1 vCPU, magas)                                                     |
| Host CPU                                      | `aisztens-api-1` 87.69%, `aisztens-caddy-1` exit 128                                   |
| Host memória                                  | 524 MB használt / 961 MB összes (54%)                                                   |
| `pnpm-native` process a hoston                | **NINCS** – a user által említett néven futó processz nem létezik                      |
| `aisztens-caddy-1`                            | `Bind for 0.0.0.0:80 failed: port is already allocated`, exit 128, dead                |
| `callback-assistant-caddy-1`                  | `Restarting`, exit 1                                                                   |
| `aisztens-api-1`                              | `Restarting (1)`, healthcheck ExitCode 1 minden próbálkozásnál                         |
| `aisztens-postgres-1`                         | Up, healthy                                                                            |
| Host 80/443 port                              | **senki nem figyeli** (`ss -tlnp` kimutatta)                                            |
| Docker network-ök                             | `aisztens_internal` (új) ÉS `callback-assistant_internal` (régi) párhuzamosan élnek    |

## 4. Gyökérok

**A. Két docker-compose stack él párhuzamosan, és mindkettőben van Caddy, ami
80/443 host portokat kér.** A Docker bind-szinten fatal errort ad
(`port is already allocated`), ezért:

* az új `aisztens-caddy-1` **nem tud elindulni** (exit 128),
* a régi `callback-assistant-caddy-1` is `restarting` státuszban van (exit 1),
* így egyik Caddy sem szolgálja ki a subdomaineket → a host 80/443 üres.

**B. Mivel a Caddy nem megy, az API konténer healthcheckje `fetch('http://127.0.0.1:3000/api')`
ténylegesen a NestJS-t hívná, de a `start_period: 30s` alatt a NestJS nem mindig
áll készen, a Docker `Restarting (1)` státuszba rakja, és a `restart: unless-stopped`
újra és újra elindítja.** Minden egyes újraindításkor a `pnpm --filter @callback/api start:prod`
újra felépíti a workspace symlinkjeit és a lockfile-ot ellenőrzi, ami ~30–90 másodpercig
tart és folyamatosan 60–90%-on pörgeti a CPU-t.

**C. A `pnpm install` üzenetek a logokban nem a konténerből jönnek.** A `Dockerfile`
CMD-je `pnpm --filter @callback/api start:prod` (nincs `docker-entrypoint.sh`,
nincs `pnpm install` a runtime stage-ben). A `docker logs` kimenetben látható
"Verifying lockfile against supply-chain policies" sorok a **korábbi deploy
CI-futtatás** lokális build lépéséből származnak (a `deploy.yml` GitHub Action
a lokális runner-en futtatja a `pnpm install --frozen-lockfile`-t), és a Docker
log bufferében keverednek a konténer tényleges kimenetével.

**D. A user által említett `pnpm-native` processz a hoston nem létezik** – ez
valószínűleg a felhasználó félreértelmezése a `node /usr/local/bin/pnpm` névről,
ami a konténer PID-je (15244/15264), nem a host natív processze. A tényleges CPU-zabáló
az API konténer restart loopja.

## 5. A kért subdomain routing már a helyén van

A `infra/caddy/Caddyfile` (és a belőle renderelt `infra/caddy/Caddyfile.rendered`)
**már most is pontosan azt csinálja, amit a user kér**:

| Hoszt               | Viselkedés                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| `api.aisztens.hu`   | `reverse_proxy api:3000` (NestJS Fastify)                                    |
| `web.aisztens.hu`   | SPA statikus szolgáltatás `apps/web/dist`-ből + `/api/*` safety-net          |
| `admin.aisztens.hu` | SPA statikus szolgáltatás `apps/admin/dist`-ből + `/api/*` safety-net        |
| `aisztens.hu`       | `307 → https://web.aisztens.hu{uri}` (apex redirect)                         |

* Kívülről **kizárólag** a443-as HTTPS porton keresztül érhető el,
  a belső alkalmazásportok (3000, 5432) rejtve vannak (`expose:` a `ports:`
  helyett, csak a docker belső hálón).
* A host 80/443-at csak a Caddy konténer publikálja.

Tehát **a routing config módosítása nem szükséges** – a baj kizárólag az, hogy
a Caddy nem tud elindulni a port-ütközés miatt.

## 6. Akcióterv (lépésenként, jóváhagyásra vár)

### 6.1 Azonnali szerver-oldali takarítás (SSH-n végrehajtandó)

1. **A régi `callback-assistant` stack leállítása és konténereinek törlése**:
   ```bash
   docker compose -p callback-assistant \
     --env-file /opt/aisztens/infra/.env \
     -f /opt/aisztens/infra/docker-compose.yml down --remove-orphans
   ```
   (A régi compose projekt ugyanazt a `infra/docker-compose.yml`-t használta,
   csak `-p callback-assistant` néven. Ha a régi compose fájl nem érhető el,
   akkor `docker rm -f callback-assistant-caddy-1 callback-assistant-api-1
   callback-assistant-postgres-1 callback-assistant-monitor-1` + `docker network
   rm callback-assistant_internal` a biztos.)

2. **Az új `aisztens` stack konténereinek újraindítása**, hogy a Caddy megkapja a
   80/443 host portokat:
   ```bash
   cd /opt/aisztens
   docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
   ```

3. **Ellenőrzés**:
   * `docker ps` – minden konténer `Up`, a Caddynek `0.0.0.0:80->80`,
     `0.0.0.0:443->443` PORTS oszloppal kell rendelkeznie.
   * `curl -fsS https://api.aisztens.hu/api` – 200 + JSON válasz.
   * `curl -fsS https://web.aisztens.hu` – 200 + HTML (SPA).
   * `curl -fsS https://admin.aisztens.hu` – 200 + HTML (SPA).
   * `docker stats --no-stream` – az API CPU-ja < 5%.

### 6.2 Visszatérésgátló config-módosítások (lokálban, commitolandó)

A jövőben ne fordulhasson elő, hogy a deploy újraéleszti a régi stacket:

1. **`infra/docker-compose.yml`**: a `caddy` service-nél explicit port-megkötés,
   és megjegyzés, hogy **egyetlen Caddy konténer lehet a hoston**, különben port-ütközés.
2. **`deploy/deploy.sh`**: az `up` parancs **elejére** beilleszteni egy
   `docker compose -p callback-assistant down --remove-orphans 2>/dev/null || true`
   lépést, hogy a régi projekt maradványai mindig takarítódjanak.
3. **`deploy/bootstrap.sh`**: biztosítani, hogy a bootstrap után a `name: aisztens`
   direktíva a `docker-compose.yml`-ben legyen az egyetlen compose projekt a dropleten.

### 6.3 Specs doksi frissítése

* `docs/Specs/Caddy-Reverse-Proxy.md`: a "Mit szolgál ki" táblázat frissítése az
  aktuális hosztokra és egy explicit "single-Caddy" szabály hozzáadása.
* `docs/Specs/Production-Runbook.md` (ha van ilyen): a runbook-hoz hozzáadni egy
  "Ha két Caddy konténer jelenik meg" troubleshooting lépést.

### 6.4 History + milestone

* `docs/history/2026-09-28-dual-stack-port-collision-fix-plan.md` (ez a fájl).
* `docs/milestones/2026-09-28-dual-stack-port-collision-fix.milestone.md` – a
  milestone a döntés szintje: miért fontos, hogy csak egy Caddy legyen a dropleten,
  és hogyan kerüljük el a jövőben.

## 7. Nem változtatunk

* **A `Caddyfile` tartalma** – már most is helyes routingot csinál.
* **A `docker-compose.yml` service-portok és hálózat** – csak a Caddy bind-ját
  kommenteljük, mást nem nyúlunk.
* **A healthcheck** – a `start_period: 30s` és a `fetch('http://127.0.0.1:3000/api')`
  marad, mert ha a Caddy port-ütközés megszűnik, az API-nak lesz ideje felállni.

## 8. Siker-kritériumok

| Kritérium                                                          | Hogyan ellenőrizzük                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| A droplet CPU-terhelése < 10%                                      | `docker stats --no-stream` és `top`                                  |
| Csak egy Caddy konténer fut a 80/443 host portokon                 | `docker ps` (PORTS oszlop) és `docker network ls`                    |
| `https://api.aisztens.hu/api` 200-as JSON-t ad                    | `curl -i https://api.aisztens.hu/api` (kívülről)                    |
| `https://web.aisztens.hu` a SPA-t szolgáltatja                    | `curl -I https://web.aisztens.hu` → 200 + `text/html`                |
| `https://admin.aisztens.hu` a SPA-t szolgáltatja                   | `curl -I https://admin.aisztens.hu` → 200 + `text/html`              |
| A belső alkalmazásportok (3000, 5432) kívülről nem érhetők el      | `curl http://aisztens.hu:3000` (kívülről) → connection refused        |
| A deploy script automatikusan takarítja a régi stacket             | `deploy/deploy.sh up` parancs futtatása után `docker network ls`     |

## 9. Kockázatok / visszafordíthatóság

* **Ha bármi elromlik**, a régi Caddy konténerek eltávolítása után már nincs
  visszaút – de a régi stack 5 órás, a Caddy amúgy sem fut, és a configok
  verziókezeltek, így a rollbackhez elég `git revert` + redeploy.
* A `docker compose -p callback-assistant down` parancs **nem veszélyes**:
  csak a konténereket és a hálózatot törli, a `pgdata` volume-ot nem (ha külön
  volume volt, megmarad). Ha a régi és új postgres adatbázis más séma alatt fut,
  az adatvesztés kockázata nulla.