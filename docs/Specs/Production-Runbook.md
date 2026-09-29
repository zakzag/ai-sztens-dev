# Production Runbook — éles verifikáció deploy után

**Státusz:** Élő
**Utolsó frissítés:** 2026-09-28 (pnpm-native-oom-restart-loop impl: a runtime image a Node-ot közvetlenül indítja, kikerülve a pnpm wrappert; lásd 4.2 / 4.4 / 5. / 6. szakasz + a `docs/milestones/2026-09-29--01-30-00-pnpm-native-oom-restart-loop.milestone.md` összefoglaló)
**Kapcsolódik:** [`docs/Specs/Caddy-Reverse-Proxy.md`](Caddy-Reverse-Proxy.md), [`deploy/deploy.sh`](../../deploy/deploy.sh), [`infra/docker-compose.yml`](../../infra/docker-compose.yml), [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile), [`docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md), [`docs/milestones/2026-09-28-api-healthcheck-fail.milestone.md`](../milestones/2026-09-28-api-healthcheck-fail.milestone.md)

---

## 1. Mire való ez a runbook?

Miután a `deploy/deploy.sh up` sikeresen lefutott a lokális gépen, a dropleten **kötelező** az alábbi verifikációs lépéseket végrehajtani, mielőtt a release-t késznek tekintenénk. A runbook célja:

1. **Megbizonyosodni róla, hogy minden konténer valóban `Up`**, nem csak `Created` — a `docker compose ps` kimenete néha megtévesztő, ha a stack indítása félbeszakadt (ez az 1.2-es pont részletezi).
2. **Végigmérni a külső végpontokat** (apex + két subdomain + API health) Caddy-n keresztül — ez az, amit a látogató és a VAPI webhook hív.
3. **Időben észrevenni az OOM-ot, ACME-hibát és mount-problémákat** — ezek a `logs --tail=200` kimenetében azonnal látszanak.
4. **Egységes, reprodukálható lépéseket adni** minden operátornak, hogy ne függjön a fejben tartott tudástól.

---

## 2. Mikor kell lefuttatni?

- **Minden `deploy/deploy.sh up` után** a lokális gépen.
- **Minden alkalommal, amikor a `infra/docker-compose.yml`, a Caddyfile vagy az `infra/.env` változik**.
- **Havonta egyszer** megelőző karbantartásként (tanúsítvány-lejárat, lemezterület, memória trendek).
- **Incidens után**, ha a stack-et újra kellett indítani (pl. OOM-kill, host reboot, Docker daemon crash).

---

## 3. Belépés és előfeltételek

```bash
# A lokális gépen (Git Bash / WSL / Linux / macOS)
ssh root@<HOST>                 # a deploy/.env HOST változója
cd /opt/aisztens                # a deploy.sh REMOTE_DIR alapértelmezettje
```

A dropleten legyenek elérhetők:
- `docker` + `docker compose` v2
- A `deploy/.env` és `infra/.env` fájlok a `/opt/aisztens` alatt (a `deploy.sh` scp-zi fel)
- A `/opt/aisztens/infra/caddy/Caddyfile.rendered` (a `deploy.sh:render_caddyfile()` generálja)

---

## 4. A verifikáció lépései

### 4.1 Konténerek állapota — a „Created ≠ Up" csapda

A `docker compose ps` **alapértelmezetten csak a futó konténereket mutatja**. Ha a stack indítása félbeszakadt, a hiányzó service-ek `Created` státuszban maradnak (létrejön a konténer, de soha nem indul el). Ez az 1. fázisú prod-deploy egyik tanulsága.

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a
```

**Elvárt kimenet** (mind a négy sor `Up`, a postgresnél `(healthy)`):

```
NAME                    IMAGE                     SERVICE    STATUS
aisztens-postgres-1     postgres:16-alpine        postgres   Up X minutes (healthy)
aisztens-api-1          aisztens/api:latest       api        Up X minutes
aisztens-caddy-1        caddy:2-alpine            caddy      Up X minutes
aisztens-monitor-1      aisztens/monitor:latest   monitor    Up X minutes
```

**Ha bármelyik `Created`, `Exited` vagy `Restarting`:**

```bash
# A pontos hiba a service logban van
docker compose --env-file infra/.env -f infra/docker-compose.yml logs --tail=200 <service>

# Majd indítsd újra a stacket
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --build
```

A 4-es fejezet „Hibadiagnosztikai mátrix" szekció részletezi, mit jelentenek az egyes hibaállapotok.

---

### 4.2 Health endpointok a Caddy-n keresztül (külső nézet)

Ez az a réteg, amit a látogató böngészője és a VAPI webhook hív — ha ez nem megy, a release bukott, még ha minden konténer `Up` is.

A NestJS-nek **két root-szintű route-ja** van:

* `GET /healthz` — dedikált liveness endpoint (a globális `api` prefix
  alól kivéve; implementáció: [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts)). Erre megy a Docker
  healthcheck ÉS a monitor watchdog. A Caddy a `/healthz` útvonalat **nem**
  proxyzza külön, de a Fastify automatikusan kiszolgálja a NestJS saját
  listenerén, tehát a Caddy-n át közvetlenül is elérhető.
* `GET /api` — az `AppController.getHello()` üzleti smoke-route (a
  globális `api` prefix alatt). Ezt csak a frontend smoke tesztek és a
  deploy sanity-check hívja; **nem** a healthcheck.

```bash
# Apex domain (HTTP 307 → web subdomain, amíg nincs landing page)
curl -fsSI https://<DOMAIN>/ | head -n1

# Web SPA
curl -fsSI https://web.<DOMAIN>/ | head -n1

# Admin SPA
curl -fsSI https://admin.<DOMAIN>/ | head -n1

# API liveness endpoint (dedikált, prefix-mentes)
curl -fsS  https://api.<DOMAIN>/healthz && echo

# API üzleti smoke route (opcionális, deploy sanity check)
curl -fsS  https://api.<DOMAIN>/api && echo
```

| Végpont | Elvárt státuszkód | Megjegyzés |
|---|---|---|
| `https://<DOMAIN>/` | `HTTP/2 307` | Apex → web subdomain redirect |
| `https://web.<DOMAIN>/` | `HTTP/2 200` | SPA `index.html` |
| `https://admin.<DOMAIN>/` | `HTTP/2 200` | Admin SPA `index.html` |
| `https://api.<DOMAIN>/healthz` | `HTTP/2 200` + JSON `{"status":"ok",...}` | Dedikált liveness endpoint (Docker healthcheck + monitor watchdog) |
| `https://api.<DOMAIN>/api` | `HTTP/2 200` + `text/plain "Hello World!"` | Üzleti smoke route (opcionális) |

Ha bármelyik `502` / `503` / `504`: a Caddy nem éri el a belső service-t. Lásd 4.7 „Hibadiagnosztikai mátrix".

---

### 4.3 ACME / Let's Encrypt tanúsítványok

```bash
# A Caddy logjában keresd a certificate acquisition/renewal sorokat
docker compose logs --tail=50 caddy | grep -E 'certificate|ACME|challenge'

# Teljes tanúsítvány-lista (a Caddy admin API nélkül, a lemezről)
docker compose exec caddy caddy list-certificates
```

**Elvárt:**

- `obtained certificate for <DOMAIN>` és/vagy `renewing certificate` sorok.
- A `list-certificates` kilistázza mind a négy hosztnevet: `<DOMAIN>`, `web.<DOMAIN>`, `api.<DOMAIN>`, `admin.<DOMAIN>`.

**Hiba esetén** (`http-01 challenge failed`, `unauthorized`, `rate-limited`): a DNS A rekordok és a Cloud Firewall szabályok (80/443 nyitva) ellenőrzése az első lépés.

---

### 4.4 Belső service-ek ellenőrzése (compose hálózatról)

```bash
# Postgres readiness
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-callback}"

# A monitor watchdog éri-e el az API-t? (a watchdog /healthz-t hív)
docker compose exec monitor sh -c 'wget -qO- http://api:3000/healthz || echo "MONITOR FAILED"'

# A NestJS liveness endpoint közvetlenül a konténerből
docker compose exec api wget -qO- http://127.0.0.1:3000/healthz
```

**Elvárt:**

- `pg_isready`: `accepting connections`
- A monitor belső wget-je: `{"status":"ok","uptime":N,"timestamp":"..."}`
- A NestJS konténerből: ugyanaz a JSON body

---

### 4.5 Renderelt Caddyfile konzisztencia

A `deploy.sh:render_caddyfile()` minden deploy során legenerálja a renderelt fájlt, és sanity check-et is futtat (`grep -q '<DOMAIN>'`). Ha a deploy nem ezt a függvényt használta (pl. manuális SCP), a placeholder benne maradhat, és a Caddy konténer `subject does not qualify for certificate` hibával indul újra a végtelen ciklusban.

```bash
# A dropleten tárolt renderelt fájl ellenőrzése
grep -E '<DOMAIN>|<ACME_EMAIL>' /opt/aisztens/infra/caddy/Caddyfile.rendered

# A Caddy konténer által ténylegesen mountolt fájl ellenőrzése
docker compose exec caddy cat /etc/caddy/Caddyfile | grep -E '<DOMAIN>|<ACME_EMAIL>'
```

**Elvárt:** mindkét parancs **üres kimenetet** ad. Ha bármit találsz, a renderelés nem futott le — nézd meg a `docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md` milestone-t.

---

### 4.6 SPA bundle mountok

A Caddy a [`docker-compose.yml`](../../infra/docker-compose.yml) szerint bind-mountolja az `apps/{web,admin}/dist` mappákat a `/srv/web` és `/srv/admin` útvonalakra. Ha ezek a mappák üresek (vagy nem léteznek) a dropleten, a Caddy konténer `failed to mount` hibával kilép.

```bash
# A dropleten
ls -la /opt/aisztens/apps/web/dist    | head -20
ls -la /opt/aisztens/apps/admin/dist  | head -20

# A Caddy konténerben mountolva
docker compose exec caddy ls -la /srv/web   | head -10
docker compose exec caddy ls -la /srv/admin | head -10
```

**Elvárt:** mindkét mappa tartalmazza az `index.html`-t és az `assets/` almappát.

Ha a lokális mappák üresek, a `deploy.sh:build_spas()` kimaradt — tipikusan azért, mert a `pnpm` nem volt a lokális PATH-on a deploy idején.

---

### 4.7 Erőforrás-használat

```bash
docker stats --no-stream
```

**Elvárt (a [`docker-compose.yml`](../../infra/docker-compose.yml) `mem_limit` értékei):**

| Service | mem_limit | Tipikus RSS |
|---|---|---|
| `postgres` | 400 MB | ~150 MB |
| `api` | 400 MB | ~120 MB |
| `caddy` | 64 MB | ~30 MB |
| `monitor` | 32 MB | ~5 MB |

Ha bármelyik eléri a limitet, a kernel OOM-ölheti — ez volt a [`2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md) trigger eseménye.

---

## 5. Egyszerűsített „minden oké?" pipeline (copy-paste)

Ha a `<DOMAIN>` és `<HOST>` változókat kitöltöd, ez egy szkriptként is futtatható a deploy végén:

```bash
DOMAIN=<your-apex-domain>
ssh root@<HOST> "cd /opt/aisztens && bash -s" <<EOF
set -e
echo '=== 1. Container status ==='
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a
echo
echo '=== 2. External endpoints ==='
echo -n 'apex:    '; curl -fsSI "https://${DOMAIN}/"            | head -n1 || echo FAIL
echo -n 'web:     '; curl -fsSI "https://web.${DOMAIN}/"        | head -n1 || echo FAIL
echo -n 'admin:   '; curl -fsSI "https://admin.${DOMAIN}/"      | head -n1 || echo FAIL
echo -n 'api:     '; curl -fsS  "https://api.${DOMAIN}/healthz" && echo || echo FAIL
echo
echo '=== 3. Internal services ==='
docker compose exec -T postgres pg_isready -U aisztens -d callback
echo
echo '=== 4. Rendered Caddyfile (must be empty) ==='
grep -E '<DOMAIN>|<ACME_EMAIL>' infra/caddy/Caddyfile.rendered && echo 'PLACEHOLDER LEAK!' || echo 'Caddyfile clean.'
echo
echo '=== 5. Resource usage ==='
docker stats --no-stream
EOF
```

Ha bármelyik lépés `FAIL` vagy `PLACEHOLDER LEAK!` kiírást ad, a `docker compose logs -f --tail=200 <service>` szinte mindig megadja a gyökérokot.

---

## 6. Hibadiagnosztikai mátrix

| Tünet | Valószínű ok | Teendő |
|---|---|---|
| `ps -a` mutatja a konténert, de státusz `Created` | A `docker compose up -d --build` nem futott le, vagy a build hibázott | Futtasd: `docker compose ... up -d --build`, majd `logs --tail=100 <service>` |
| `api` `Restarting` / `Exited (1)` healthcheck `exitCode: 1` | A NestJS még nem áll kész (`start_period: 60s` sem volt elég), VAGY a `/healthz` route nem érhető el. Ellenőrizd: `docker compose exec api wget -qO- http://127.0.0.1:3000/healthz` | Ha a NestJS lassan indul, növeld a `start_period`-et; ha a route 404, a `main.ts` `exclude` listája elvesztette a `healthz`-t |
| `api` `Restarting` / `Exited (1)` típusú egyéb hiba | `DATABASE_URL` connect hiba — jellemzően `AISZTENS_DB_PASSWORD` üres az `infra/.env`-ben (a jelenlegi kódban nincs DB driver, tehát ez a hiba csak a jövőben aktiválódik) | `grep -E '^(POSTGRES_PASSWORD\|AISZTENS_DB_PASSWORD)=' infra/.env` — töltsd ki |
| `caddy` `Restarting` / `Exited (1)` | A renderelt Caddyfile placeholdert tartalmaz (`<DOMAIN>`) | Futtasd újra a deploy-t, vagy manuálisan: `sed -i 's\|<DOMAIN>\|$DOMAIN\|g' infra/caddy/Caddyfile` |
| `caddy` `Exited (1)` `open /srv/web: no such file or directory` | A SPA dist mappa nincs a dropleten | Ellenőrizd az `apps/{web,admin}/dist` tartalmát; ha üres, a `deploy.sh:build_spas()` kimaradt |
| `caddy` log: `http-01 challenge failed` | DNS A rekord nem a droplet IP-jére mutat, vagy a 80-as port zárva | `dig +short <DOMAIN>` + Cloud Firewall 80/443 szabályok |
| `ps` OK, de `https://api.<DOMAIN>/healthz` → `502` | Caddy nem éri el a belső `api:3000`-et (rossz network vagy konténer leállt) | `docker compose exec caddy wget -qO- http://api:3000/healthz` |
| `monitor` `Restarting` | Az api konténer még nem indult el (`start_period: 60s`) | Várj 60-90 másodpercet, vagy ellenőrizd az api logot; ha a `/healthz` route-ot a NestJS nem szolgáltatja, a watchdog is `down` alertet küld |
| A konténer `killed` / `OOMKilled` | Memóriakorlát elérve | Lásd [`docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md) |
| `api` `Restarting` rövid ciklusokban (5-60 mp), `top`-ban `pnpm-native` 60+ % CPU, `dmesg`-ben `Memory cgroup out of memory: Killed process ... (pnpm-native)` | A runtime image a `pnpm --filter … start:prod` wrappert használja, aminek a `pnpm-native` lockfile-verify helperje ~380 MB RSS-sel jár, és átlépi a 400 MB `mem_limit`-et. A kernel OOM-killere megöli, mielőtt a Node elindulna. | Ellenőrizd, hogy az image a `node apps/api/dist/main.js` CMD-t használja-e (lásd [`infra/app/Dockerfile`](../../infra/app/Dockerfile)). Ha a régi `pnpm …` CMD fut, frissítsd a CMD-et és rebuildelj: `docker compose ... up -d --build`. Teljes diagnózis: [`docs/history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md`](../history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md) |
| A `docker compose ps` önmagában csak a postgres-t mutatja | A többi service `Created` státuszban van, mert a stack indítása félbeszakadt | Lásd 4.1 — futtasd a `ps -a` flag-gel, majd ha kell, `up -d --build` |
| `healthcheck exitCode: 1` a `fetch('/healthz')` Node scriptben | A `node -e` parancs `process.exit(r.ok?0:1)` exit kódot ad, de a Docker ezt 0-nak tekinti, ha a fetch sikeres volt. Ha a `r.ok` `false`, a Node 1-es kóddal lép ki — ez a NestJS nem-elérhetőség tünete (még nem indult el, vagy a route nem él) | Lásd fentebb, `api Restarting` sor |

---

## 7. Opcionális: teljes lifecycle smoke

A repo-ban van egy kézzel futtatható smoke-szkript, amely a teljes callback-flow-t végigjátssza (form → API → DB → webhook):

```bash
# Lokálisan, az éles rendszerrel szemben
bash scripts/test/stack-smoke.sh https://<DOMAIN> https://api.<DOMAIN>
```

**Éles környezetben csak saját, nem ügyfél telefonszámmal futtasd** — a szkript valódi `callback_requests` sort hoz létre az adatbázisban. A szkript részleteit lásd: [`scripts/test/stack-smoke.sh`](../../scripts/test/stack-smoke.sh) és [`scripts/test/README.md`](../../scripts/test/README.md).

---

## 8. Rollback / vészhelyzeti stop

Ha a release kritikus hibát okoz és gyorsan vissza kell állni:

```bash
# Csak az adott service rollbackje az előző image-re
docker compose --env-file infra/.env -f infra/docker-compose.yml pull <service>
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --no-deps <service>

# Teljes stack leállítás (a Caddy is leáll → a domain elérhetetlenné válik)
docker compose --env-file infra/.env -f infra/docker-compose.yml down

# Csak a Caddy leállítása (a belső service-ek futnak tovább)
docker compose --env-file infra/.env -f infra/docker-compose.yml stop caddy
```

A `pgdata` és `caddy_data` named volume-ok ilyenkor is megmaradnak — nem veszik el az adat.

---

## 9. Kapcsolódó dokumentumok

### 9.1 Közvetlenül kapcsolódó fájlok

- [`deploy/deploy.sh`](../../deploy/deploy.sh) — a deploy szkript (upload + build + render + up)
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml) — a stack definíciója
- [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) — a Caddy template
- [`infra/caddy/Caddyfile.rendered`](../../infra/caddy/Caddyfile.rendered) — a renderelt Caddyfile (gitignored)
- [`infra/.env.example`](../../infra/.env.example) — az `infra/.env` környezeti változói
- [`scripts/test/stack-smoke.sh`](../../scripts/test/stack-smoke.sh) — teljes lifecycle smoke

### 9.2 Specifikus deep-dive-ok

- [`docs/Specs/Caddy-Reverse-Proxy.md`](Caddy-Reverse-Proxy.md) — a Caddy konténer részletes dokumentációja (TLS, reverse proxy, ACME)
- [`docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md) — a Caddy restart-loop hiba és a mem_limit-ek tanulságai

---

## 10. Karbantartási szabály

Ez a dokumentum **élő**: ha a deploy flow, a [`docker-compose.yml`](../../infra/docker-compose.yml) service blokkjai, vagy a verifikációs lépések megváltoznak (új service, új health endpoint, új domain), a runbookot is frissíteni kell. A frissítési kötelezettséget a [`.roo/rules/instructions.md`](../../.roo/rules/instructions.md) „Specs doksik karbantartása" szekciója rögzíti.
