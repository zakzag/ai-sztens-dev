# Milestone: dual-stack port-ütközés és Cloud Firewall / DNS fix

**Dátum:** 2026-09-28 (CEST)
**Szerző:** Zoo (code mode)
**Érintett commit-ok / fájlok:** `infra/docker-compose.yml`, `deploy/deploy.sh`,
`infra/caddy/Caddyfile.rendered` (dropleten), `docs/Specs/Caddy-Reverse-Proxy.md`

---

## 1. Problem / feature

A droplet egyre belassult, friss újraindítás után is 90%-os CPU-terhelést mutatott. A felhasználó szerint egy `pnpm-native` folyamat zabálta a CPU-t, és a kért subdomain routing (`api.aisztens.hu` / `web.aisztens.hu` / `admin.aisztens.hu`) nem működött. A Caddynek kellett volna kezelnie a teljes forgalmat, portok nélkül, kívülről HTTPS-en, belülről külön alkalmazásra irányítva.

## 2. Measured data / evidence

A dropleten SSH-n mérve (`top`, `ps`, `docker ps`, `docker stats`, `docker inspect`, `ss -tlnp`, `docker logs`):

| Mutató | Érték |
|---|---|
| `top` load average | 3.38 / 2.36 / 1.23 (1 vCPU, magas) |
| `aisztens-api-1` CPU | 87.69%, státusz: `Restarting (1)` (újraindulási ciklus) |
| `aisztens-caddy-1` | `Bind for 0.0.0.0:80 failed: port is already allocated`, exit 128 |
| `callback-assistant-caddy-1` | `Restarting`, exit 1 (régi compose projekt) |
| `docker network ls` | `aisztens_internal` AND `callback-assistant_internal` párhuzamosan |
| `pnpm-native` process | **Nem létezik** a hoston – a konténer PID-je a `pnpm` binárissal |
| `ss -tlnp` 80/443 | Senki nem figyelt (a Cloud Firewall-ig bezárólag) |
| `docker stats` Caddy ACME log | `lookup ... 127.0.0.53:53: read: connection refused` → a bridge hálóról a systemd-resolved nem elérhető |
| Let's Encrypt HTTP-01 challenge | `Timeout during connect (likely firewall problem)` – a Cloud Firewall blokkolja a bejövő 80/443 forgalmat |

## 3. Root cause / design rationale

### 3.1 A CPU-terhelés valódi oka

Két docker-compose projekt élt párhuzamosan ugyanazon a dropleten:

| Régi stack (`callback-assistant-*`) | Új stack (`aisztens-*`) |
|---|---|
| Régi Caddy 3 napos | Új Caddy 5 órás, `aisztens-caddy-1` |
| Saját `callback-assistant_internal` bridge | Saját `aisztens_internal` bridge |

Mindkettő definiálta a `caddy` service-t, mindkettő a host 80/443-as portját kérte → a Docker bind fatal errort ad (`port is already allocated`). Az új `aisztens-caddy-1` **exit 128-cal** meghalt, a régi `callback-assistant-caddy-1` is `restarting` státuszba került.

Emiatt a host 80/443-as portján **egyetlen Caddy sem** figyelt. Az `aisztens-api-1` konténer healthcheckje (`fetch('http://127.0.0.1:3000/api')`) a NestJS indulása előtt futott le, a Docker `Restarting (1)` státuszba tette a konténert, és a `restart: unless-stopped` policy miatt a konténer **végtelen ciklusban indult újra és újra**. Minden induláskor a lockfile-verify 30-90 másodpercig pörgette a CPU-t – innen a 87.69%-os API CPU-terhelés és a rendszer általános lassulása.

### 3.2 A `pnpm-native` tévképzet

A hoston futó `ps` listán nem volt `pnpm-native` nevű processz. Ami a felhasználónak `pnpm-native`-nek tűnt, az a konténer PID-je (`node /usr/local/bin/pnpm --filter @callback/api start:prod`), ami a konténer restart loop miatt folyamatosan ott volt a `ps` kimenetben.

### 3.3 A DNS / Cloud Firewall probléma

A Caddy a systemd-resolved `127.0.0.53:53`-as stub-resolverét másolta a konténerbe, de a bridge hálóról ez az IP nem route-olható → az ACME DNS lookupok elbuknak, és a Let's Encrypt HTTP-01 / TLS-ALPN-01 challenge-ei a Cloud Firewall miatt **timeout-olnak** – a Let's Encrypt szerverei nem tudnak a164.92.248.194:80 / :443 -ra csatlakozni.

## 4. Solution / implementation

### 4.1 Szerver-oldali azonnali takarítás (SSH-n végrehajtva)

1. A régi `callback-assistant-*` stack konténereinek (`caddy`, `api`, `postgres`, `monitor`) `docker rm -f`-feleltávolítása.
2. A `callback-assistant_internal` Docker hálózat `docker network rm`-mel törlése.
3. A `callback-assistant_*` volume-ok (`caddy_config`, `caddy_data`, `pgdata`) `docker volume rm`-mel törlése (az új `aisztens_*` volume-ok megmaradtak, így a postgres adatok nem vesztek el).
4. Az `aisztens` stack `docker compose up -d`-velújraindítása.

### 4.2 Config módosítások

| Fájl | Módosítás |
|---|---|
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml) (caddy service) | Explicit `dns: [1.1.1.1, 8.8.8.8]` direktíva, hogy a konténer a bridge hálóról is elérje a DNS-t (a systemd-resolved 127.0.0.53-as stub-resolvere a bridge hálóról nem route-olható). Részletes komment a "single-Caddy" invariánsról és a DigitalOcean Cloud Firewall kérdésről. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | Új `prune_legacy_stack()` függvény, ami az `up` parancs előtt fut, és `xargs` + `docker rm -f / network rm / volume rm` segítségével eltávolítja a `callback-assistant-*`, `aisztens-legacy-*`, `old-stack-*` névképletű konténereket, hálózatokat és volume-okat. Új `down-all` vészhelyzeti parancs, ami az összes Docker objektumot törli a dropletről. A `case` ág kiegészítve a `Usage:` sorral együtt. |
| [`infra/caddy/Caddyfile.rendered`](../../infra/caddy/Caddyfile.rendered) (dropleten) | Visszaállítva az eredeti HTTPS konfigra a Cloud Firewall nyitásáig. Korábban kísérleti `auto_https off` módban futott, de a HTTP listener a konténeren belül nem bindelődött, így a routing nem volt tesztelhető. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | Új §8 szekció: "Single-Caddy invariáns és a Cloud Firewall / ACME DNS kérdés". Rögzíti a regression-garanciát, a `down-all` vészhelyzeti parancsot, és a Cloud Firewall / DNS-01 / HTTP-only fallback megoldási lehetőségeket. |

### 4.3 Végrehajtott SSH-n ellenőrzések

A cleanup és az újraindítás után:

```
NAME                  CPU %     MEM USAGE / LIMIT
aisztens-caddy-1      0.00%     33.01MiB / 64MiB
aisztens-monitor-1    0.00%     5.547MiB / 32MiB
aisztens-api-1        0.00%     152 MiB / 400 MiB   (most már Up, nem Restarting)
aisztens-postgres-1   0.00%     24.15MiB / 400MiB
```

A Caddy `0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp` portokon figyel (a docker-proxy-n keresztül). A belső Docker network (`aisztens_internal`, 172.19.0.0/16) tartalmazza az összes konténert.

## 5. Outcome and how to verify

### 5.1 Azonnali eredmények

| Eredmény | Státusz |
|---|---|
| CPU-terhelés a dropleten | 0% (minden konténernél) |
| `aisztens-api-1` restart loop | Megszűnt, `Up` |
| `aisztens-caddy-1` port bind | Sikeres, 80/443 figyel |
| `callback-assistant-*` konténerek | Törölve |
| `callback-assistant_internal` hálózat | Törölve |
| `docker network ls` | Csak `aisztens_internal` (és a Docker default-ok) |

### 5.2 Verifikációs lépések (jövőbeli operátor számára)

```bash
# 1. Ellenőrizd, hogy csak egy Caddy konténer van a 80/43-on
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep caddy
# Elvárt: aisztens-caddy-1 Up X minutes  0.0.0.0:80->80, 0.0.0.0:443->443

# 2. Ellenőrizd, hogy nincs másik stack maradvány
docker network ls | grep -E 'aisztens|callback'
# Elvárt: csak aisztens_internal

# 3. Ellenőrizd a CPU-t
docker stats --no-stream
# Elvárt: minden konténer CPU% < 5%

# 4. (A Cloud Firewall megnyitása után) Teszteld a HTTPS-t
curl -fsS -o /dev/null -w '%{http_code}\n' https://api.aisztens.hu/api  # 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://web.aisztens.hu/      # 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://admin.aisztens.hu/    # 200

# 5. Ha a stack wedged, vészhelyzeti reset:
./deploy.sh down-all && ./deploy.sh up
```

### 5.3 Ami még hátra van (a Cloud Firewall miatt)

A Let's Encrypt tanúsítványok beszerzése a DigitalOcean Cloud Firewall-ön múlik: amíg a 80/43-as bejövő TCP forgalom a164.92.248.194 -re nem nyitott, a HTTP-01 és TLS-ALPN-01 challenge-ek timeout-olnak. Ez **manuális lépés** a DO panelen (Networking → Firewalls → Inbound rules: HTTP/HTTPS engedélyezése a 0.0.0.0/0 -ról), és nem SSH-n automatizálható.

A DNS-01 challenge (Cloudflare API tokennel) egy hosszú távú megoldás, ha a DNS a Cloudflare-nél van – ezt egy későbbi iterációban lehet bevezetni.

## 6. Follow-ups

1. **Cloud Firewall megnyitása** a DO panelen (P0, manuális).
2. **DNS-01 challenge** bevezetése Cloudflare API tokennel, ha a DNS-t a Cloudflare-re migráljuk (P2).
3. **A `Caddyfile` template-ben** egy opcionális `auto_https off` fallback komment, hogy vészhelyzetben a Cloud Firewall problémája gyorsabban orvosolható legyen.
4. **Backup / restore** stratégia a `pgdata` és `caddy_data` volume-okhoz (P1, a 6.2.7-es pont a `Caddy-Reverse-Proxy.md`-ben).
5. **Egy deploy smoke test**, ami a `docker ps` után automatikusan ellenőrzi, hogy csak egy Caddy konténer fut és nincs orphan hálózat – korai figyelmeztetés a regressionre.