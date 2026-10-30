# Production Runbook — éles verifikáció deploy után

**Státusz:** Élő
**Deploy metadata frissítés:** 2026-10-12 — a `/healthz` válasz `deployDate` +
`commitHash` mezőkkel bővült, és a `web` / `admin` SPA front-oldalán megjelenik
egy build-info sor (telepítés dátuma + commit hash). Lásd §4.2 és
[`docs/history/2026-10-12--13-20-00-deploy-meta-version-display.md`](../history/2026-10-12--13-20-00-deploy-meta-version-display.md).
**Utolsó frissítés:** 2026-10-21 (AIS-64: a teljes callback funkció törlése — a `POST /api/callback-requests` végpont, a `callback` séma és a hozzá tartozó oldalak megszűntek; a §7 lifecycle smoke szövege ennek megfelelően frissült. Korábban 2026-10-19 (AIS-35): a §7 nem állítja, hogy a suite `callback_requests` sort hoz létre — a suite csak megfigyel; a lokális DB bootstrapje a [`Database-Local.md`](Database-Local.md) specben van.)
**Korábbi frissítés:** 2026-10-13 (deploy-process konzisztencia takarítás: a §9.1 `deploy.yml` leírás a 2-elemű `matrix` helyett a **`plan` job** modellt írja le — `.github/scripts/deploy-plan.sh`, `needs.plan.outputs.*`, `workflow_run` / `workflow_dispatch` trigger, nincs `push` trigger és nincs `matrix`; a §6 pnpm-native OOM sora már nem javasol `--build`-et a dropleten, hanem CI-oldali image-újrabuildet; a §6.1 banner-minta `[stage=upload_rsync]` → `[stage=upload_files]`, és az rsync-mirror bekezdés helyett a 3 fájlos `scp` leírás szerepel. Az image-based deploy (2026-10-08) óta a droplet nem buildel és nem kap forráskódot.)
**Kapcsolódik:** [`docs/Specs/Caddy-Reverse-Proxy.md`](Caddy-Reverse-Proxy.md), [`deploy/deploy.sh`](../../deploy/deploy.sh), [`infra/docker-compose.yml`](../../infra/docker-compose.yml), [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile), [`docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md), [`docs/milestones/2026-09-28-api-healthcheck-fail.milestone.md`](../milestones/2026-09-28-api-healthcheck-fail.milestone.md)

---

## 1. Mire való ez a runbook?

Miután a `deploy/deploy.sh up dev` (vagy `up prod`) sikeresen lefutott a lokális gépen, a dropleten **kötelező** az alábbi verifikációs lépéseket végrehajtani, mielőtt a release-t késznek tekintenénk. A runbook célja:

1. **Megbizonyosodni róla, hogy minden konténer valóban `Up`**, nem csak `Created` — a `docker compose ps` kimenete néha megtévesztő, ha a stack indítása félbeszakadt (ez az 1.2-es pont részletezi).
2. **Végigmérni a külső végpontokat** (apex + két subdomain + API health) Caddy-n keresztül — ez az, amit a látogató és a VAPI webhook hív.
3. **Időben észrevenni az OOM-ot, ACME-hibát és mount-problémákat** — ezek a `logs --tail=200` kimenetében azonnal látszanak.
4. **Egységes, reprodukálható lépéseket adni** minden operátornak, hogy ne függjön a fejben tartott tudástól.

---

## 2. Mikor kell lefuttatni?

- **Minden `deploy/deploy.sh up <target>` után** a lokális gépen.
- **Minden alkalommal, amikor a `infra/docker-compose.yml`, a Caddyfile vagy az `infra/.env` változik**.
- **Havonta egyszer** megelőző karbantartásként (tanúsítvány-lejárat, lemezterület, memória trendek).
- **Incidens után**, ha a stack-et újra kellett indítani (pl. OOM-kill, host reboot, Docker daemon crash).

---

## 3. Belépés és előfeltételek

```bash
# A lokális gépen (Git Bash / WSL / Linux / macOS)
ssh deployer@<HOST>             # a deploy/.env.dev HOST változója (dev target);
                                # SSH_USER=deployer — ugyanaz a felhasználó, mint a CI-é
cd /opt/aisztens                # a deploy.sh REMOTE_DIR alapértelmezettje
```

> A `deployer` a `docker` csoportban van, ezért a `docker compose` parancsok
> `sudo` nélkül futnak. root-os belépésre csak két esetben van szükség, mindkettő
> egyszeri: friss droplet bootstrapje (`SSH_USER=root ./deploy/deploy.sh bootstrap`)
> és a `/opt/aisztens` tulajdonjogának javítása, ha a deploy preflight ezzel elhasal
> (`chown -R deployer:deployer /opt/aisztens`).

A dropleten legyenek elérhetők:

- `docker` + `docker compose` v2
- A droleten a `deploy/.env` (a lokálisan kiválasztott `deploy/.env.<target>` másolata, amit a `deploy.sh` scp-z át) és az `infra/.env` fájlok a `/opt/aisztens` alatt
- A `/opt/aisztens/infra/caddy/Caddyfile.rendered` (a `deploy.sh:render_caddyfile()` generálja)

---

## 4. A verifikáció lépései

### 4.1 Konténerek állapota — a „Created ≠ Up" csapda

A `docker compose ps` **alapértelmezetten csak a futó konténereket mutatja**. Ha a stack indítása félbeszakadt, a hiányzó service-ek `Created` státuszban maradnak (létrejön a konténer, de soha nem indul el). Ez az 1. fázisú prod-deploy egyik tanulsága.

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a
```

**Elvárt kimenet** (mind a hat sor `Up`, a postgresnél `(healthy)`):

```
NAME                    IMAGE                                                SERVICE    STATUS
aisztens-postgres-1     postgres:16-alpine                                   postgres   Up X minutes (healthy)
aisztens-api-1          ghcr.io/<owner>/aisztens-api:sha-<short>             api        Up X minutes
aisztens-web-1          ghcr.io/<owner>/aisztens-web:sha-<short>             web        Up X minutes
aisztens-admin-1        ghcr.io/<owner>/aisztens-admin:sha-<short>           admin      Up X minutes
aisztens-caddy-1        caddy:2-alpine                                       caddy      Up X minutes
aisztens-monitor-1      ghcr.io/<owner>/aisztens-monitor:sha-<short>         monitor    Up X minutes
```

Az image nevek a deploy workflow által kiírt `IMAGE_TAG` értéket tükrözik
(a `git short SHA` a `images.yml` futásából). A `docker compose ps
--format '{{.Service}} {{.Image}}'` parancsot a CI deploy workflow
utolsó lépésben is ellenőrzi (`Verify every service is running
IMAGE_TAG`), így egy régi, leállított image-en ragadt konténer azonnal
látszik.

```bash
# A pontos hiba a service logban van
docker compose --env-file infra/.env -f infra/docker-compose.yml logs --tail=200 <service>

# Image-based deploy: a droplet nem buildel. Húzd újra a GHCR image-et
# és erőltesd a konténer újraindítását. A `--force-recreate` biztosítja,
# hogy az új image vagy compose file módosítás tényleg érvényesüljön.
docker compose --env-file infra/.env -f infra/docker-compose.yml pull
docker compose --env-file infra/.env -f infra/docker-compose.yml \
  up -d --remove-orphans --force-recreate
```

A 4-es fejezet „Hibadiagnosztikai mátrix" szekció részletezi, mit jelentenek az egyes hibaállapotok.

---

### 4.2 Health endpointok a Caddy-n keresztül (külső nézet)

Ez az a réteg, amit a látogató böngészője és a VAPI webhook hív — ha ez nem megy, a release bukott, még ha minden konténer `Up` is.

A NestJS-nek **két root-szintű route-ja** van:

- `GET /healthz` — dedikált liveness endpoint (a globális `api` prefix
  alól kivéve; implementáció: [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts)). Erre megy a Docker
  healthcheck ÉS a monitor watchdog. A Caddy a `/healthz` útvonalat **nem**
  proxyzza külön, de a Fastify automatikusan kiszolgálja a NestJS saját
  listenerén, tehát a Caddy-n át közvetlenül is elérhető.

  A válasz a liveness mezők mellett a **beégetett build metadatát** is
  visszaadja, amivel egy futó konténer egy konkrét revízióhoz köthető:

  ```json
  {
    "status": "oks",
    "deployDate": "2026-10-12T12:34:56Z",
    "commitHash": "0123456789abcdef0123456789abcdef01234567",
    "uptime": 1234,
    "timestamp": "2026-10-12T12:55:00.000Z"
  }
  ```

  A `deployDate` / `commitHash` értékeket az `images.yml` build-time
  argumentumként adja át (`DEPLOY_DATE` / `COMMIT_HASH`, lásd
  [`infra/app/Dockerfile`](../../infra/app/Dockerfile)), tehát az image
  építésének pillanatában rögzülnek és **nem** felülírhatók futásidőben.
  Lokális (`start:dev`, `scripts/dev-stack.sh`) futtatásnál nincs ilyen build
  arg, ezért mindkét mező `null` — ez nem hiba, hanem a graceful degradáció.
  A healthcheck (`process.exit(r.ok?0:1)`) és a monitor watchdog kizárólag a
  HTTP státuszkódra támaszkodik, ezért a mezők hozzáadása a liveness
  kontraktust nem érinti.

- `GET /api` — az `AppController.getHello()` üzleti smoke-route (a
  globális `api` prefix alatt). Ezt csak a frontend smoke tesztek és a
  deploy sanity-check hívja; **nem** a healthcheck.

```bash
# Apex domain (HTTP 307 → web subdomain, amíg nincs landing page)
curl -fsSI https://<DOMAIN>/ | head -n1

# Web SPA
curl -fsSI https://web.<DOMAIN>/ | head -n1

# Admin SPA
curl -fsSI https://admin.<DOMAIN>/ | head -n1

# API liveness endpoint (dedikált, prefix-mentes) + beégetett build metadata
curl -fsS  https://api.<DOMAIN>/healthz && echo

# A deployolt revízió azonosítása (egyeznie kell a kiadott SHA-val)
curl -fsS  https://api.<DOMAIN>/healthz | grep -o '"commitHash":"[^"]*"'

# API üzleti smoke route (opcionális, deploy sanity check)
curl -fsS  https://api.<DOMAIN>/api && echo
```

| Végpont                                            | Elvárt státuszkód                                                            | Megjegyzés                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://<DOMAIN>/`                                | `HTTP/2 307`                                                                 | Apex → web subdomain redirect                                                                                                                |
| `https://web.<DOMAIN>/`                            | `HTTP/2 200`                                                                 | SPA `index.html`                                                                                                                             |
| `https://admin.<DOMAIN>/`                          | `HTTP/2 200`                                                                 | Admin SPA `index.html`                                                                                                                       |
| `https://api.<DOMAIN>/healthz`                     | `HTTP/2 200` + JSON `{"status":"oks","deployDate":"…","commitHash":"…",...}` | Dedikált liveness endpoint (Docker healthcheck + monitor watchdog) + a deployolt revízió azonosítója                                         |
| `https://web.<DOMAIN>/`, `https://admin.<DOMAIN>/` | `HTTP/2 200` + a lap alján `Telepítve: … · Verzió: <40 hex>`                 | A SPA build-info sora ugyanazt a dátumot + hash-t mutatja, mint a `/healthz` (azonos `github.sha`, azonos `images.yml` futás)                |
| `https://api.<DOMAIN>/api`                         | `HTTP/2 200` + `text/plain "Hello Beautiful World!"`                         | Üzleti smoke route — a NestJS root controller greetingje ([`apps/api/src/app.service.ts:6`](../../apps/api/src/app.service.ts)) (opcionális) |

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
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-aisztens_db}"

# A monitor watchdog éri-e el az API-t? (a watchdog /healthz-t hív)
docker compose exec monitor sh -c 'wget -qO- http://api:3000/healthz || echo "MONITOR FAILED"'

# A NestJS liveness endpoint közvetlenül a konténerből
docker compose exec api wget -qO- http://127.0.0.1:3000/healthz

# A VAPI webhook védelmi vonalak ellenőrzése (Caddy 405 + NestJS HMAC).
# A Caddy pre-filter: POST X-Vapi-Signature nélkül → 405 az edge-ről.
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -d '{"message":{"id":"evt-test","type":"end-of-call-report"}}'
# Elvárt: HTTP/2 405 (a Caddy @vapi_match nem egyezik → respond "Method Not Allowed" 405)

# A NestJS HMAC guard: helyes signature-rel POST → 200, helytelen → 401.
# A secret az infra/.env VAPI_WEBHOOK_SECRET sorából jön, SOHA ne dump-old log-ba.
SECRET="$(grep VAPI_WEBHOOK_SECRET /opt/aisztens/infra/.env | cut -d= -f2)"
BODY='{"message":{"id":"evt-test-001","type":"end-of-call-report","call":{"id":"call-test-001"}}}'
TS="$(date +%s)"
SIG="$(printf '%s' "${TS}.${BODY}" | openssl dgst -sha256 -hmac "${SECRET}" | sed 's/^.*= //')"

curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -H "X-Vapi-Timestamp: ${TS}" \
  -H "X-Vapi-Signature: sha256=${SIG}" \
  -d "${BODY}"
# Elvárt: HTTP/2 200 + JSON {"received":true,"id":"<uuid>"}

# Helytelen signature-rel ugyanaz a payload → 401 (NestJS guard).
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -H "X-Vapi-Timestamp: ${TS}" \
  -H "X-Vapi-Signature: sha256=deadbeef" \
  -d "${BODY}"
# Elvárt: HTTP/2 401 (VapiSignatureGuard HMAC mismatch)
```

> **Automatizált változat:** ugyanez a három ellenőrzés fut a smoke suite 5. és 6. checkjeként (`pnpm test:stack`); a suite dokumentációja:
> [`scripts/README.md`](../../scripts/README.md). A `WEBHOOK_TARGET`
> (`https://api.$DOMAIN`) és a `VAPI_WEBHOOK_SECRET` értékét a szkript automatikusan az
> `infra/.env`-ből olvassa — de csak akkor futtatja a checkeket, ha a compose projektben fut
> `caddy` konténer (a `local` override letiltja a Caddy-t, ott nincs mit tesztelni).
>
> **Fontos (2026-10-06):** a dev droplet még a VAPI előtti image-et futtatja, ezért a fenti
> curl-ek `404`-et adnak, amíg a módosított API image és a renderelt Caddyfile ki nincs
> telepítve. Ez nem regresszió, hanem a deploy hiánya — részletek:
> [`docs/history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md`](../history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md).

**Elvárt:**

- `pg_isready`: `accepting connections`
- A monitor belső wget-je: `{"status":"ok","uptime":N,"timestamp":"..."}`
- A NestJS konténerből: ugyanaz a JSON body
- A Caddy pre-filter: 405 az edge-ről, mielőtt a kérés elérné a NestJS-t
- A HMAC guard: 200 helyes, 401 helytelen signature esetén

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

### 4.6 SPA konténerek (image-based)

A `web` és `admin` site-okat a Caddy a `web:80` és `admin:80` konténerek felé proxy‑zza (lásd [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile)). A Caddy _nem_ szolgál ki statikus fájlokat — az nginx konténer teszi a [`infra/web/nginx.conf`](../../infra/web/nginx.conf) és [`infra/admin/nginx.conf`](../../infra/admin/nginx.conf) alapján. Az image-eket a [`.github/workflows/images.yml`](../../.github/workflows/images.yml) buildeli, a droplet pullolja.

```bash
# A dropleten: a `web` és `admin` konténer fut, az `index.html` az image-be van égetve
docker compose -f infra/docker-compose.yml --env-file infra/.env ps web admin
docker compose -f infra/docker-compose.yml --env-file infra/.env exec web ls -la /usr/share/nginx/html | head -10
docker compose -f infra/docker-compose.yml --env-file infra/.env exec admin ls -la /usr/share/nginx/html | head -10
```

**Elvárt:** mindkét konténer `Up`, mindkét mappa tartalmazza az `index.html`-t és az `assets/` almappát.

Ha a konténer `Restarting` / `Exited`, a pull valószínűleg 401‑et adott (privát GHCR esetén `GHCR_PAT` kell a dropleten), vagy a `IMAGE_TAG`/`GHCR_OWNER` nincs kitöltve az `infra/.env`-ben. A 2026-10-08 előtti elrendezés itt nem érvényes: a host `apps/{web,admin}/dist` mappa és a `WEB_DIST_PATH`/`ADMIN_DIST_PATH` bind mount megszűnt.

---

### 4.7 Erőforrás-használat

```bash
docker stats --no-stream
```

**Elvárt (a [`docker-compose.yml`](../../infra/docker-compose.yml) `mem_limit` értékei):**

| Service    | mem_limit | Tipikus RSS |
| ---------- | --------- | ----------- |
| `postgres` | 400 MB    | ~150 MB     |
| `api`      | 400 MB    | ~120 MB     |
| `caddy`    | 64 MB     | ~30 MB      |
| `monitor`  | 32 MB     | ~5 MB       |

Ha bármelyik eléri a limitet, a kernel OOM-ölheti — ez volt a [`2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md) trigger eseménye.

---

## 5. Egyszerűsített „minden oké?" pipeline (copy-paste)

Ha a `<DOMAIN>` és `<HOST>` változókat kitöltöd, ez egy szkriptként is futtatható a deploy végén:

```bash
DOMAIN=<your-apex-domain>
ssh deployer@<HOST> "cd /opt/aisztens && bash -s" <<EOF
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
docker compose exec -T postgres pg_isready -U postgres -d aisztens_db
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

| Tünet                                                                                                                                                          | Valószínű ok                                                                                                                                                                                                                                     | Teendő                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ps -a` mutatja a konténert, de státusz `Created`                                                                                                              | A `docker compose ... up -d` futása félbeszakadt (image-pull timeout, SSH drop) — a 2026-10-08 image-based deploy óta nincs `--build` a dropleten                                                                                                | Futtasd: `docker compose --env-file infra/.env -f infra/docker-compose.yml pull && up -d --force-recreate`, majd `logs --tail=100 <service>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `api` `Restarting` / `Exited (1)` healthcheck `exitCode: 1`                                                                                                    | A NestJS még nem áll kész (`start_period: 60s` sem volt elég), VAGY a `/healthz` route nem érhető el. Ellenőrizd: `docker compose exec api wget -qO- http://127.0.0.1:3000/healthz`                                                              | Ha a NestJS lassan indul, növeld a `start_period`-et; ha a route 404, a `main.ts` `exclude` listája elvesztette a `healthz`-t                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `api` `Restarting` / `Exited (1)` típusú egyéb hiba                                                                                                            | `DATABASE_URL` connect hiba — jellemzően `AISZTENS_DB_PASSWORD` üres az `infra/.env`-ben (a jelenlegi kódban nincs DB driver, tehát ez a hiba csak a jövőben aktiválódik)                                                                        | `grep -E '^(POSTGRES_PASSWORD\|AISZTENS_DB_PASSWORD)=' infra/.env` — töltsd ki                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `caddy` `Restarting` / `Exited (1)`                                                                                                                            | A renderelt Caddyfile placeholdert tartalmaz (`<DOMAIN>`)                                                                                                                                                                                        | Futtasd újra a deploy-t, vagy manuálisan: `sed -i 's\|<DOMAIN>\|$DOMAIN\|g' infra/caddy/Caddyfile`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `caddy` `Exited (1)` `open /srv/web: no such file or directory`                                                                                                | **Legacy:** a SPA bundle-öket 2026-10-08 előtt bind mountolta a Caddy (`/srv/web`); image-based deploy óta a `web` és `admin` konténerek szolgálják ki a SPA-t, és ez az üzenet nem fordulhat elő                                                | Ha mégis előfordul, a `web` / `admin` image-ek pull-ja nem futott le — ellenőrizd a `ghcr.io/<owner>/aisztens-{web,admin}:$IMAGE_TAG` image-ek elérhetőségét a GHCR-en                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `caddy` log: `http-01 challenge failed`                                                                                                                        | DNS A rekord nem a droplet IP-jére mutat, vagy a 80-as port zárva                                                                                                                                                                                | `dig +short <DOMAIN>` + Cloud Firewall 80/443 szabályok                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ps` OK, de `https://api.<DOMAIN>/healthz` → `502`                                                                                                             | Caddy nem éri el a belső `api:3000`-et (rossz network vagy konténer leállt)                                                                                                                                                                      | `docker compose exec caddy wget -qO- http://api:3000/healthz`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `monitor` `Restarting`                                                                                                                                         | Az api konténer még nem indult el (`start_period: 60s`)                                                                                                                                                                                          | Várj 60-90 másodpercet, vagy ellenőrizd az api logot; ha a `/healthz` route-ot a NestJS nem szolgáltatja, a watchdog is `down` alertet küld                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A konténer `killed` / `OOMKilled`                                                                                                                              | Memóriakorlát elérve                                                                                                                                                                                                                             | Lásd [`docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `api` `Restarting` rövid ciklusokban (5-60 mp), `top`-ban `pnpm-native` 60+ % CPU, `dmesg`-ben `Memory cgroup out of memory: Killed process ... (pnpm-native)` | A runtime image a `pnpm --filter … start:prod` wrappert használja, aminek a `pnpm-native` lockfile-verify helperje ~380 MB RSS-sel jár, és átlépi a 400 MB `mem_limit`-et. A kernel OOM-killere megöli, mielőtt a Node elindulna.                | Ellenőrizd, hogy az image a `node apps/api/dist/main.js` CMD-t használja-e (lásd [`infra/app/Dockerfile`](../../infra/app/Dockerfile)). Ha a régi `pnpm …` CMD fut, javítsd a CMD-t, majd **buildeld újra az image-et a CI-ben** ([`.github/workflows/images.yml`](../../.github/workflows/images.yml)), és a dropleten csak `docker compose --env-file infra/.env -f infra/docker-compose.yml pull` + `up -d --force-recreate` fusson (a droplet nem buildel — nincs `--build`). Teljes diagnózis: [`docs/plans/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md`](../plans/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md) |
| A `docker compose ps` önmagában csak a postgres-t mutatja                                                                                                      | A többi service `Created` státuszban van, mert a stack indítása félbeszakadt                                                                                                                                                                     | Lásd 4.1 — futtasd a `ps -a` flag-gel, majd ha kell, `pull && up -d --force-recreate` (image-based deploy: nincs `--build`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `healthcheck exitCode: 1` a `fetch('/healthz')` Node scriptben                                                                                                 | A `node -e` parancs `process.exit(r.ok?0:1)` exit kódot ad, de a Docker ezt 0-nak tekinti, ha a fetch sikeres volt. Ha a `r.ok` `false`, a Node 1-es kóddal lép ki — ez a NestJS nem-elérhetőség tünete (még nem indult el, vagy a route nem él) | Lásd fentebb, `api Restarting` sor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 6.1 A deploy hiba bannerének olvasása (PR #1, 2026-09-29; logger-integráció 2026-10-06)

A `deploy.sh` a `set -euo pipefail` felett egy `ERR` trap-et is tartalmaz, amely minden nem nulla kilépéskor kiírja, hogy **melyik fázisban** halt el a script, és a `docker compose ps -a` + `docker compose logs --tail=20` utolsó sorait.

**2026-10-06-tól** a `deploy.sh` a [`deploy/lib/logger.sh`](../../deploy/lib/logger.sh) loggert használja: minden sor ISO-8601 időbélyeget és severity szintet kap, a stage breadcrumb pedig nem a szövegbe ágyazva, hanem `[stage=…]` tag-ként jelenik meg (a `log_stage()` állítja be). A banner formátuma:

```
2026-10-06T15:55:28+02:00 [INFO ] [deploy] [stage=upload_files] Shipping 3 files to deployer@164.92.248.194:/opt/aisztens ...
2026-10-06T15:56:15+02:00 [ERROR] [deploy] [stage=upload_files] FAILED at line=215 exit=12 after 47s
NAME                    SERVICE    STATUS
aisztens-postgres-1     postgres   Up 12 minutes (healthy)
aisztens-api-1          api        Up 12 minutes
aisztens-caddy-1        caddy      Restarting
aisztens-monitor-1      monitor    Restarting
...
2026-10-06T15:56:15+02:00 [ERROR] [deploy] ===== finished: exit=12 duration=47s log=/home/me/repo/deploy/log/deploy-20261006-155528-up.log =====
```

A stage-értékek lehetséges készlete: `init`, `upload_files`, `remote_preflight`, `up_start`, `compose_pull_up`, `compose_verify`, `done` (a `prune_legacy_stack` stage-t az image-based deploy kivezette — a `docker compose up -d --remove-orphans` már elég a konkurens konténerek eltávolítására). A `line=` a deploy.sh belső sorszám, nem a távoli parancsé — a valódi okot a távoli `ps -a` + `logs` részben kell keresni.

#### A deploy target: `dev` vagy `prod`

A `deploy.sh <command> [dev|prod] [--verbose]` második argumentuma választja ki a betöltendő env fájlt:

| Target          | Env fájl           | `APP_ENV` |
| --------------- | ------------------ | --------- |
| (nincs megadva) | `deploy/.env.dev`  | `dev`     |
| `dev`           | `deploy/.env.dev`  | `dev`     |
| `prod`          | `deploy/.env.prod` | `prod`    |

Ugyanez az érték lesz az `APP_ENV`, így az `infra/.env.<target>`, a SPA build mode és a compose `--env-file` nem tud eltérni a megcélzott droplettől. Érvénytelen érték (pl. `staging`, `local`) → használati hiba, **exit 2**; a `local` szándékosan nem célpont (a lokális stacket a [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh) indítja — lásd [`scripts/README.md`](../../scripts/README.md)).

A target a log fájl nevébe is bekerül (`deploy-<timestamp>-<command>-<target>.log`), így a `deploy/log/` listából látszik, melyik droplethez tartozik egy futás.

> A korábbi, target nélküli `deploy/.env` **megszűnt** (nincs rá visszaesés, mert az rossz dropletre deployolhatna). Migráció: `mv deploy/.env deploy/.env.dev`, majd `cp deploy/.env.example deploy/.env.prod` a prod dropletnek.

#### A teljes log: `deploy/log/`

A banner csak kivonat. **Minden futás** teljes naplót hagy a `deploy/log/` mappában; a logger `exec > >(tee -a …)` capture-je miatt az `ssh` / `scp` / `docker compose` kimenete is benne van, nem csak a script saját sorai:

```bash
tail -n 50 deploy/log/latest.log     # az utolsó futás — hibakeresésnél ezt olvasd először
bash deploy/deploy.sh up dev --verbose   # újrafuttatás DEBUG szintű log_debug / log_cmd sorokkal
```

| Útvonal                                                      | Mit tartalmaz                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `deploy/log/deploy-<YYYYmmdd-HHMMSS>-<command>-<target>.log` | egy fájl futásonként; a legutóbbi `DEPLOY_LOG_KEEP` (alapértelmezés 20) marad meg |
| `deploy/log/latest.log`                                      | mindig a legutóbbi futás — **hiba után ezt olvasd először**                       |

A `latest.log` szimbolikus link, ha a fájlrendszer támogatja; Windows-on (`ln -s` nélkül) másolat, ezért a logger a futás **végén**, a footer kiírása után frissíti — különben a másolat a headernél állna meg.

Ha a banner `stage=init`, a deploy a konfiguráció betöltése előtt halt el (jellemzően hiányzó `HOST=`). Ilyenkor a távoli `ps -a` rész **szándékosan** kimarad: a trap csak akkor hívja a dropletre, ha az ssh-tömb már inicializálva van. A hiba így is megjelenik a logban, mert a `deploy_log_init` a guardok **előtt** fut:

```
2026-10-06T15:55:28+02:00 [ERROR] [deploy] HOST is not set in deploy/.env.dev — there is nothing to deploy to.
2026-10-06T15:55:28+02:00 [ERROR] [deploy] Fix: set HOST=<droplet ip or hostname> in deploy/.env.dev (optionally SSH_USER, SSH_KEY).
2026-10-06T15:55:28+02:00 [ERROR] [deploy] Aborted before any upload or remote command was executed.
```

> **Windows — hogyan kell indítani a deploy-t.** A `deploy/deploy.sh`-t **nem** szabad duplán kattintani, és PowerShell/cmd-ből sem `deploy/deploy.sh up` formában hívni: a Windows a `.sh` kiterjesztést a Git Bash fájltársításon (`git-bash.exe --no-cd "%L" %*`) keresztül oldja fel, ami egy **új, eldobható** terminálablakot nyit, és a bash-nek egy backslash-es Windows útvonalat ad át, amit az nem tud feloldani (`E:projects…devdeploydeploy.sh: command not found`). Az ablak bezárul, mielőtt a hiba elolvasható lenne — a deploy úgy tűnik, mintha „nem csinált volna semmit, és hibát sem írt volna ki". Helyette: `.\deploy\deploy.ps1 <command>` (ajánlott Windows-on), `bash deploy/deploy.sh <command>` (PowerShell/cmd), vagy `./deploy/deploy.sh <command>` (Git Bash / WSL). A wrapper a jelenlegi konzolba streamel, hiba esetén nyitva tartja az ablakot, kiírja a `deploy/log/latest.log` utolsó sorait, és továbbadja a kilépési kódot. Részletek: [`deploy/README.md`](../../deploy/README.md) §10.

További, a PR #1 során bevezetett kisebb védelmek:

- A `render_caddyfile()` mostantól `<DOMAIN>` / `<ACME_EMAIL>` tokenekkel dolgozik (korábban a komment és a kód mást használt — lásd `docs/history/2026-09-29--15-15-00-deploy-sh-guard-hardening-pr1.md` M2). Ha a `grep '<DOMAIN>'` bármit talál a `/opt/aisztens/infra/caddy/Caddyfile.rendered` fájlban, a deploy nem indult el.
- A `deploy/.env.<target>` és az `infra/.env` scp útvonala explicit: ha a `repo/infra/.env.<APP_ENV>` és a `repo/infra/.env` egyike sem található meg, a deploy a `no infra/.env.<APP_ENV> or infra/.env found ...` üzenettel leáll, mielőtt bármit írna a dropletre.
- Az `upload()` csak három fájlt küld `scp`-vel (`infra/docker-compose.yml`, a renderelt `infra/.env`, `infra/caddy/Caddyfile.rendered`), ezért privát SSH-kulcs vagy teljes forrásfa soha nem kerülhet a dropletre — a korábbi rsync-alapú teljes-repo feltöltés (és annak `--exclude 'deploy/ssh-keys/'` szabálya) az image-based deploy (2026-10-08) bevezetésével megszűnt.

---

## 7. Opcionális: teljes lifecycle smoke

A repo-ban van egy kézzel futtatható smoke-szkript, amely az élő stacket méri fel kívülről (Caddy → api → postgres, valamint a VAPI webhook védelmi vonalak):

```bash
# Lokálisan, az éles rendszerrel szemben
bash scripts/test/stack-smoke.sh https://<DOMAIN> https://api.<DOMAIN>
```

A suite **csak megfigyel** (lásd [`scripts/test/README.md`](../../scripts/test/README.md)): nem ír az adatbázisba, és nem hoz létre sort egyetlen alkalmazás-táblában sem. A `POST /api/callback-requests` végpont az AIS-64-gyel megszűnt (a teljes visszahívás-funkcióval együtt), a `callback` Postgres séma sem létezik többé — a smoke a `/healthz`-t és a maradék két séma (`platform`, `email`) grant-mátrixát ellenőrzi. A szkript és a teljes check-lista dokumentációja: [`scripts/README.md`](../../scripts/README.md).

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

- [`deploy/deploy.sh`](../../deploy/deploy.sh) — a deploy szkript (upload 3 fájlt + render + up). Az `APP_ENV` szelektor (dev/prod) a `local_infra_env` feloldáson és a `COMPOSE_ARGS` összeállításán keresztül terjed. Image-based deploy: a szkript nem buildel, csak `docker compose pull && up -d`-t futtat a dropleten.
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — a CI deploy (nem buildel; a `images.yml` által GHCR-re pusholt image-eket pullolja). Az `INFRA_ENV_DEV` / `INFRA_ENV_PROD` titkokból rendereli az `infra/.env`-et és a `Caddyfile.rendered`-et; a `dev`/`prod` kiválasztást a **`plan` job** végzi ([`.github/scripts/deploy-plan.sh`](../../.github/scripts/deploy-plan.sh)), amely `should_deploy | app_env | image_tag | ref` kimeneteket ír a `GITHUB_OUTPUT`-ba. A `deploy` job `needs: plan` + `if: needs.plan.outputs.should_deploy == 'true'` formában fut; a GitHub Environment kötést a `needs.plan.outputs.app_env`-ből oldja fel. Trigger: `workflow_run` (az `images.yml` sikeres futása után) vagy `workflow_dispatch` — **nincs `push` trigger és nincs `matrix`**. Lásd [`docs/plans/2026-10-12--15-09-00-deploy-yml-plan-job.md`](../plans/2026-10-12--15-09-00-deploy-yml-plan-job.md).
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml) — a stack definíciója; tartalmazza az `APP_ENV: ${APP_ENV:-dev}` sort az `api.environment:` blokkban.
- [`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml) — a fejlesztői override (Caddy kikapcsolva, host portok publikusak); a [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh) ezt merge-öli (lásd [`scripts/README.md`](../../scripts/README.md)).
- [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) — a Caddy template
- [`infra/caddy/Caddyfile.rendered`](../../infra/caddy/Caddyfile.rendered) — a renderelt Caddyfile (gitignored)
- [`infra/.env.example`](../../infra/.env.example) — a per-env séma dokumentációja (local / dev / prod blokkok). A tényleges fájlok: `infra/.env.local`, `infra/.env.dev`, `infra/.env.prod` (mind gitignored).
- [`scripts/README.md`](../../scripts/README.md) — a script-index; a teljes lifecycle smoke suite itt van dokumentálva
- [`docs/Specs/Local-Development.md`](Local-Development.md) — a fejlesztői oldali workflow dokumentációja (`scripts/dev-stack.sh`, per-env fájlok, APP_ENV terjedés)
- [`docs/Specs/Three-Env-Verification.md`](Three-Env-Verification.md) — **az end-to-end manuális tesztelési útmutató**: parancsok + várt kimenet a local / dev / prod környezetek mindegyikére. Minden deploy vagy friss pull után fussa le a §1 (repo checks) és a saját env-ének megfelelő szakaszt (§2 local, §3 dev, §4 prod).
- [`docs/plans/2026-10-05--10-30-00-three-env-separation-plan.md`](../plans/2026-10-05--10-30-00-three-env-separation-plan.md) — a teljes három-env terv, ami ezt a struktúrát létrehozta

### 9.2 Specifikus deep-dive-ok

- [`docs/Specs/Caddy-Reverse-Proxy.md`](Caddy-Reverse-Proxy.md) — a Caddy konténer részletes dokumentációja (TLS, reverse proxy, ACME)
- [`docs/milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md) — a Caddy restart-loop hiba és a mem_limit-ek tanulságai

---

## 10. Karbantartási szabály

Ez a dokumentum **élő**: ha a deploy flow, a [`docker-compose.yml`](../../infra/docker-compose.yml) service blokkjai, vagy a verifikációs lépések megváltoznak (új service, új health endpoint, új domain), a runbookot is frissíteni kell. A frissítési kötelezettséget a [`.roo/rules/instructions.md`](../../.roo/rules/instructions.md) „Specs doksik karbantartása" szekciója rögzíti.
