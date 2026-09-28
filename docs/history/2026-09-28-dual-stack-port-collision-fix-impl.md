# Implementáció: dual-stack port-ütközés és Cloud Firewall / DNS fix

**Dátum:** 2026-09-28 (CEST)
**Előzmény:** [`docs/history/2026-09-28-dual-stack-port-collision-fix-plan.md`](2026-09-28-dual-stack-port-collision-fix-plan.md)
**Kapcsolódó milestone:** [`docs/milestones/2026-09-28-dual-stack-port-collision-fix.milestone.md`](../milestones/2026-09-28-dual-stack-port-collision-fix.milestone.md)

---

## Összefoglaló

A droplet 90%-os CPU-terheléssel futott, és a kért subdomain routing nem működött. A
diagnózis: két docker-compose projekt (`callback-assistant-*` és `aisztens-*`) élt
párhuzamosan, mindkettőben Caddy konténer próbálta bindelni a host 80/443-as portját,
így egyik sem tudott elindulni → az API konténer healthcheckje a NestJS indulása előtt
futott, a konténer `Restarting (1)` státuszba került, és a `restart: unless-stopped`
végtelen újraindulási ciklust okozott (87.69% CPU).

A javítás: a régi stack konténereinek, hálózatának és volume-jainak eltávolítása +
az új `aisztens` stack újraindítása + a DNS fix (explicit `dns:` direktíva a Caddy
service-en) + a deploy script kiegészítése egy `prune_legacy_stack()` függvénnyel
és egy vészhelyzeti `down-all` paranccsal.

---

## Végrehajtott lépések

### 1. Szerver-oldali takarítás (SSH-n, azonnal)

```bash
# Régi stack konténereinek törlése
docker rm -f callback-assistant-caddy-1 callback-assistant-api-1 \
              callback-assistant-monitor-1 callback-assistant-postgres-1

# Régi hálózat törlése
docker network rm callback-assistant_internal

# Régi volume-ok törlése (az új aisztens_* megmaradt, adatvesztés nélkül)
docker volume rm callback-assistant_caddy_config \
               callback-assistant_caddy_data \
               callback-assistant_pgdata
```

### 2. Az új `aisztens` stack újraindítása

```bash
cd /opt/aisztens
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

### 3. DNS-fix alkalmazása a dropleten (lokális docker-compose.yml push nélkül)

A Caddy konténerből a systemd-resolved `127.0.0.53:53` stub-resolvere nem volt
elérhető a bridge hálóról. Manuálisan szerkesztettük a `/opt/aisztens/infra/docker-compose.yml`
caddy service blokkját, és hozzáadtuk az explicit `dns: [1.1.1.1, 8.8.8.8]` direktívát.
Ezután `docker compose up -d caddy` újraindította a Caddy-t, és a HTTP/443 portok
bindelése sikeres volt.

### 4. Lokális módosítások (commitolandó)

| Fájl | Változtatás |
|---|---|
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml) | caddy service: explicit `dns:` direktíva (1.1.1.1, 8.8.8.8) + részletes komment a "single-Caddy" invariánsról és a DigitalOcean Cloud Firewall kérdésről |
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | Új `prune_legacy_stack()` függvény az `up` parancs előtt + `down-all` vészhelyzeti parancs + `Usage:` sor frissítve |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | Új §8 szekció a single-Caddy invariánsról és a Cloud Firewall / DNS kérdésről |
| [`docs/milestones/2026-09-28-dual-stack-port-collision-fix.milestone.md`](../milestones/2026-09-28-dual-stack-port-collision-fix.milestone.md) | Új milestone a döntés szintjén |

### 5. Végállapot ellenőrzése (a dropleten)

A takarítás és az újraindítás után:

```
NAME                  CPU %     MEM USAGE / LIMIT
aisztens-caddy-1      0.00%     33.01MiB / 64MiB
aisztens-monitor-1    0.00%     5.547MiB / 32MiB
aisztens-api-1        0.00%     152 MiB / 400 MiB
aisztens-postgres-1   0.00%     24.15MiB / 400MiB

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
# aisztens-caddy-1      Up X minutes   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp

docker network ls
# aisztens_internal   (csak ez a project-háló van)

ss -tlnp | grep -E ':(80|443)\b'
# docker-proxy figyel a 80/443-on
```

A CPU-terhelés **0%-ra** esett vissza. A Caddy port-bindol, de a Let's Encrypt
challenge-ek timeout-olnak a Cloud Firewall miatt (`Timeout during connect (likely
firewall problem)`). Ez **manuális DO panel-lépés**: a bejövő 80/443-as TCP
forgalmat engedélyezni kell a164.92.248.194 -re.

---

## Ami még hátra van

1. **Cloud Firewall megnyitása** a DO panelen (P0, manuális, nem SSH-n automatizálható).
2. A lokális `docker-compose.yml` és `deploy/deploy.sh` módosítások commitolása.
3. A history + milestone frissítése a végleges commit-SHA-val.
4. (Opcionális, P2) DNS-01 challenge bevezetése Cloudflare API tokennel, ha a DNS a Cloudflare-re migrálódik.