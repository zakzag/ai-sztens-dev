# Terv: `pnpm-native` OOM a 400 MB api konténerben — végtelen restart loop

**Dátum:** 2026-09-28 (CEST)
**Szerző:** Zoo (code mode)
**Állapot:** terv, jóváhagyásra vár
**Előzmény:** [`2026-09-29--00-34-28-api-healthcheck-fail-impl.md`](2026-09-29--00-34-28-api-healthcheck-fail-impl.md) (lokálban commitolva, de a dropletre soha nem került fel), [`2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md`](../milestones/2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md), [`2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md`](../milestones/2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md)

---

## 1. Tünet (a user `top` kimenete)

A dropleten a user `top` pillanatában:

```
Tasks: 135 total,   1 running, 134 sleeping,   0 stopped,   0 zombie
%Cpu(s): 43.5 us, 29.1 sy,  0.0 ni,  0.0 id, 23.1 wa,  0.0 hi,  1.3 si,  3.0 st
MiB Mem :    961.5 total,    232.1 free,    555.2 used,    349.4 buff/cache

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
  61752 do-agent  20   0  900760 122520  28168 S  61.3  12.4   0:01.85 pnpm-native
    ...
  61707 do-agent  20   0 1245840  54084  41496 S   0.7   5.5   0:00.28 node
```

A `top` magas **user CPU** (43.5%), **system CPU** (29.1%) és **I/O wait** (23.1%) értékeket mutat, és a process-listán egy `pnpm-native` (61% CPU, 12% RAM) dominál. A korábbi milestone-ok alapján a user már kétszer is jelentette, hogy „belassult a rendszer", és mindkét alkalommal egy konténer restart loop volt a valódi ok.

---

## 2. A dropleten mért tények

| Forrás | Mért érték | Jelentés |
|---|---|---|
| `docker ps` | `aisztens-api-1` státusza `Restarting (1) Less than a second ago` | Az api konténer most is restart-loopban van |
| `docker inspect aisztens-api-1` | `State.ExitCode: 1`, `OOMKilled: false`, `StartedAt: 2026-09-28T23:03:29.953377626Z` | A konténer nem OOM-kill miatt halt meg (a cgroup szintű OOM külön esemény) |
| `journalctl -u docker --since '-12h'` `grep restartCount` | `restartCount=226`, ~8–60 másodperc/ciklus | Az elmúlt ~1 órában 226-szor indult újra |
| `dmesg --since '-12h' \| grep oom` | `oom-kill: ... task=pnpm-native,pid=63879/64232/64587/64987,...` ismétlődve, `anon-rss: 380116kB`, `cgroup: docker-46e301dbfc4cf7aa...scope` | A kernel OOM-killer **belül a 400 MB cgroup-ban** öli a `pnpm-native` folyamatot, mielőtt a Node elindulhatna |
| `docker image inspect aisztens/api:latest` | `Created: 2026-09-28T19:01:38`, `Cmd: ["pnpm","--filter","@callback/api","start:prod"]` | A futó image 6 órája készült, és a `pnpm` wrapperen keresztül indítja a Node-ot |
| `docker logs aisztens-api-1 --tail 200` | Folyamatosan ismétlődik: `Scope: all 3 workspace projects` / `Verifying lockfile against supply-chain policies (741 entries)...` / `Progress: resolved 0, reused N, downloaded 0, added 0` / `apps/api \| [WARN] deprecated eslint@9.39.5...` | A Node **soha** indul el; a pnpm `pnpm-native` segédprocessze a lockfile-ellenőrzésnél meghal |
| `/opt/aisztens/infra/.env` a dropleten | `MONITOR_TARGET_URL=http://api:3000/api` (a régi érték) | A korábbi healthcheck-fail javítás csak lokálban lett commitolva, a dropleten **nem futott le a deploy** |
| `apps/api/src/main.ts:20` lokálban | `app.setGlobalPrefix('api', { exclude: ['healthz'] })` | A `/healthz` dedikált endpoint a lokálban már létezik, de a dropleten futó image-ban még nincs benne |

---

## 3. Gyökérok

### 3.1 A Dockerfile CMD-je pnpm-wrapperen keresztül indítja a Node-ot

[`infra/app/Dockerfile:76`](../../infra/app/Dockerfile) utolsó sora:

```dockerfile
CMD ["pnpm", "--filter", "@callback/api", "start:prod"]
```

A [`apps/api/package.json`](../../apps/api/package.json)-ban:

```json
"start:prod": "node dist/main"
```

A pnpm 9.x CLI minden egyes script-futtatáskor (még `--filter X script` formában is) **spawnol egy `pnpm-native` nevű segédprocesszt** a lockfile és a függőségi supply-chain policy ellenőrzésére. Ez a helper a pnpm 9 beépített része (Rust bináris, nem a Node pnpm CLI), és a függőségi gráf méretétől függően akár több száz MB RSS-t is foglalhat cold startkor.

### 3.2 A 400 MB `mem_limit` és a `pnpm-native` ütközése

A [`infra/docker-compose.yml:28`](../../infra/docker-compose.yml) az api konténer memóriakorlátja:

```yaml
mem_limit: 400m
```

A `dmesg` bizonyítja, hogy a `pnpm-native` önmagában ~380 MB `anon-rss`-re tesz szert (`Memory cgroup out of memory: Killed process 63879 (pnpm-native) total-vm:1150364kB, anon-rss:380116kB`). Amint a Rust heap + a lockfile-verify munkamemória átlépi a 400 MB-os cgroup limitet, a kernel OOM-killere beavatkozik, és a `pnpm-native` SIGKILL-t kap. A `pnpm` Node wrapper ezt kilépési hibaként érzékeli, a `start:prod` script **soha nem fut le**, a konténer `exit 1`-gyel távozik, és a `restart: unless-stopped` policy azonnal újraindítja. A ciklus átlagosan 8–60 másodperc, és minden egyes iterációban a pnpm újra ellenőrzi a teljes 741 bejegyzéses lockfile-t — ez termeli a `top`-ban látott magas `wa` (23.1%) és a `pnpm-native` 61%-os CPU-ját.

### 3.3 A korábbi „healthcheck-fail fix" soha nem került deploy-ra

A [`2026-09-29--00-34-28-api-healthcheck-fail-impl.md`](2026-09-29--00-34-28-api-healthcheck-fail-impl.md) dokumentálja, hogy a `/healthz` dedikált endpoint és a `process.exit(r.ok?0:1)` healthcheck-parancs lokálban commitolva van. A dropleten futó image azonban `2026-09-28T19:01:38`-kor épült (4 órával az impl előtt), és a `/opt/aisztens/infra/.env` is a régi `MONITOR_TARGET_URL=http://api:3000/api` értéket tartalmazza. Vagyis az előző „fix" commitolva van, de **a dropletre sosem került fel**, és azóta is a régi, OOM-loop-os image fut.

### 3.4 A `do-agent` user a `top`-ban: a konténer PID-je, nem host-process

A `top` user oszlopa `do-agent`-et mutat, valójában a konténer PID namespace-én belüli user (`uid=999 = nodeapp`). A korábbi milestone-ok (lásd [`2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md`](../milestones/2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md) §3.2) már rámutattak, hogy ez a félreértés; a tényleges ellenség a konténer restart loop, nem a DigitalOcean ügynök.

---

## 4. A terv – javítási lehetőségek

Három alternatíva mérlegelése, kockázat és hatás alapján.

### 4.1 „A" opció: a CMD megváltoztatása `node dist/main`-re (ajánlott)

A [`infra/app/Dockerfile`](../../infra/app/Dockerfile) utolsó `CMD` sorát átírni:

```diff
-CMD ["pnpm", "--filter", "@callback/api", "start:prod"]
+CMD ["node", "apps/api/dist/main.js"]
```

**Előnyök:**

* A runtime image **nem tartja életben a pnpm wrappert**, így a `pnpm-native` lockfile-verify sosem fut le induláskor. A Node indulás memóriaigénye messze a `mem_limit: 400m` alatt marad (cold start ~80–120 MB RSS, steady state ~150–200 MB, a `--max-old-space-size=384` V8 kupak véd a runaway heap ellen).
* Visszaállíthatatlan kockázat nincs: ha a `start:prod` scriptet a jövőben bármi másra cserélné a csapat (pl. `node --inspect dist/main`), a Dockerfile CMD-et is frissíteni kell — ez ugyanaz a fegyelmezettség, mint eddig.
* A `pnpm install --frozen-lockfile` és a workspace symlink-ek a **build stage**-ben maradnak (azok futnak a `pnpm install` és `pnpm --filter @callback/api build` sorokban, lásd Dockerfile 27–48. sor). A runtime stage csak a kész `node_modules`-t és a lefordított `dist/`-t kapja meg.
* Minimális lokális kódváltoztatás: 1 sor Dockerfile + 1 deploy a dropletre.

**Hátrányok / kockázatok:**

* Ha valaki a jövőben hozzáad egy `apps/api/package.json`-beli lifecycle scriptet (pl. `prebuild`, `postinstall`), a runtime image-be az nem kerül be — ez eddig is így volt (csak a `dist/main.js` van a runtime stage-ben).
* A `pnpm --filter … start:prod` élményét a `deploy/deploy.sh` `up` szkriptje lokálban továbbra is használja (a CI-ban, nem a dropleten). A Dockerfile CMD csak a **runtime** viselkedését írja le.

### 4.2 „B" opció: a `mem_limit` megemelése 700 MB-ra

A [`infra/docker-compose.yml:28`](../../infra/docker-compose.yml) értékét `400m` → `700m`-re emelni.

**Előnyök:** egyetlen sor, a pnpm-native-nak lesz elég helye.

**Hátrányok:**

* A droplet összesen 961 MB RAM, és a többi konténer (postgres 400 MB + caddy 64 MB + monitor 32 MB + do-agent ~600 MB a host névtérben) már most is szűkös. +300 MB az api-nak garantáltan elfogyasztja a host teljes fizikai memóriáját, és elindul a `kswapd0` swap-thrash, ami a 2026-09-27-es esethez hasonló tüneteket produkál.
* A korábbi mem_limit-terv ([`2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md`](2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md)) konkrétan az ellenkezőjét javasolta: „hard cap so a runaway heap cannot starve the host". Ezt az elvet nem szabad megszegni anélkül, hogy a dropletet ne egy magasabb szintű tier-re upgrade-elnénk.

### 4.3 „C" opció: `pnpm_config_*` env-ekkel kikapcsolni a verify-t

A Dockerfile-ban `ENV pnpm_config_verify_deps_before_run=false` és hasonlókat beállítani.

**Előnyök:** nincs kódváltoztatás.

**Hátrányok:**

* A pnpm 9 dokumentációja szerint ezek a config-kulcsok instabilnak minősülnek (a 9.x minor release-ekben többször átnevezték őket); egy pnpm frissítés után a környezeti változók hatástalanná válhatnak.
* A lockfile-verify kikapcsolása ellentmond a projekt kifejezetten dokumentált döntésének: a supply-chain hardening a pnpm 9 beépített funkciója, és a `2026-09-29--00-30-10-api-healthcheck-fail-plan.md` §1 is hivatkozik rá, mint a `Verifying lockfile against supply-chain policies (741 entries)...` üzenet forrására.
* Nem oldja meg a „pnpm wrapper feleslegesen indul a runtime-ban" koncepcionális problémát — csak elnyomja a tünetet.

### 4.4 Döntés: az „A" opció + a korábban commitolt `/healthz` javítás együttes deploy-ja

A legkisebb kockázatú, leginkrobb „a gyökeret célozza" megoldás az „A" opció. Mivel a korábbi healthcheck-fail javítás (`/healthz` endpoint, `setGlobalPrefix` exclude, healthcheck-parancs) **lokálban már commitolva van**, egyetlen deploy két problémát is megold:

1. A pnpm-wrapper eltávolítása megszünteti a `pnpm-native` OOM-loopot.
3. A `/healthz` endpoint aktiválódik, és a Docker healthcheck sikeres lesz.
4. A `MONITOR_TARGET_URL` a `infra/.env`-ben `/healthz`-re vált, így a monitor watchdog is a helyes endpointot hívja.

---

## 5. Akcióterv (lépésenként, jóváhagyásra vár)

### 5.1 Kód-módosítások (lokálban)

1. **[`infra/app/Dockerfile`](../../infra/app/Dockerfile)** – a runtime stage utolsó sora:
   ```diff
   -CMD ["pnpm", "--filter", "@callback/api", "start:prod"]
   +CMD ["node", "apps/api/dist/main.js"]
   ```
   A `WORKDIR /workspace` már beállítja a munkakönyvtárat, így a relatív útvonal helyes.

2. **[`infra/app/Dockerfile`](../../infra/app/Dockerfile)** – kiegészítő megjegyzés a CMD fölött: „The runtime stage intentionally bypasses the pnpm wrapper. Pnpm 9 spawns a `pnpm-native` helper for lockfile verification that consumes ~380 MB RSS on cold start, which breaches the 400 MB container `mem_limit` and triggers an OOM-kill death-spiral. Since the build stage has already produced a complete `node_modules` and compiled `dist/`, we can run Node directly."

3. **[`infra/docker-compose.yml:149`](../../infra/docker-compose.yml)** – a `MONITOR_TARGET_URL` alapértékének szinkronizálása a `.env.example`-lel:
   ```diff
   -      TARGET_URL: ${MONITOR_TARGET_URL:-http://api:3000/api}
   +      TARGET_URL: ${MONITOR_TARGET_URL:-http://api:3000/healthz}
   ```
   Ez csak a fallback érték — a tényleges konfiguráció a `/opt/aisztens/infra/.env`-ben van, és azt a deploy szkript frissíti (lásd 5.3).

4. **Nincs szükség** a [`apps/api/src/main.ts`](../../apps/api/src/main.ts), [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts), [`apps/api/src/health/health.module.ts`](../../apps/api/src/health/health.module.ts), [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts) módosítására — ezek a korábbi impl-ből már rendben vannak.

5. **Nincs szükség** a [`infra/docker-compose.yml:41-55`](../../infra/docker-compose.yml) healthcheck blokkjának módosítására — a `/healthz` URL és az explicit `process.exit(r.ok?0:1)` már ott van.

### 5.2 Tesztek

6. **`apps/api/test/health.e2e-spec.ts`** és **`apps/api/src/health/health.controller.spec.ts`** — ezek a fájlok a korábbi impl-ből már megvannak. A CI a `pnpm --filter @callback/api test` és `pnpm --filter @callback/api test:e2e` parancsokkal futtatja. Ha bármelyik elbukik, a deploy előtt javítani kell.

7. **A Dockerfile módosítás hatását lokálban ellenőrizni** (opcionális, de ajánlott):
   ```bash
   docker build -f infra/app/Dockerfile -t aisztens/api:test .
   docker run --rm --memory=400m aisztens/api:test
   # Elvárt: a konténer ~2-3 mp alatt elindul, és a Node figyel a 3000-es porton,
   # dmesg-ben nincs OOM-kill a konténerben.
   ```

### 5.3 Deploy a dropletre

8. A [`deploy/deploy.sh up`](../../deploy/deploy.sh) parancsot futtatni lokálban. Ez:
   * rsync-eli a forrást a dropletre,
   * lefuttatja a `pnpm install --frozen-lockfile`-t a dropleten (vagy a CI build-ben),
   * újraépíti az `aisztens/api:latest` image-et,
   * újraindítja a `compose` stack-et,
   * a renderelt Caddyfile-t feltolja.

9. **A `/opt/aisztens/infra/.env` frissítése a dropleten** (a deploy szkript ezt megteszi, ha az `infra/.env` template-ben a `MONITOR_TARGET_URL` értéke `/healthz`):
   ```
   MONITOR_TARGET_URL=http://api:3000/healthz
   ```
   A `deploy/deploy.sh` `up` ága SCP-zi a lokális `infra/.env`-t a dropletre (vagy a `.env.example`-ből származtatja). Ellenőrizni kell, hogy a deploy szkript ezt a sort valóban felülírja-e; ha nem, kézzel kell szerkeszteni a dropleten `sed`-del.

### 5.4 A korábbi impl-ek visszavonása

Nincs szükség visszavonásra — a [`2026-09-29--00-34-28-api-healthcheck-fail-impl.md`](2026-09-29--00-34-28-api-healthcheck-fail-impl.md) commitjai (a `/healthz` controller, a `setGlobalPrefix` `exclude`, a docker-compose healthcheck blokk, a `MONITOR_TARGET_URL` alapérték a `.env.example`-ban) mind érvényben maradnak. Ez a terv csak kiegészíti őket a Dockerfile CMD-módosítással és a docker-compose monitor-default szinkronizálással.

### 5.5 Specs doksi frissítése

10. **[`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md)** „Utolsó frissítés" dátum frissítése, és a 4.2 / 4.4 szakaszokhoz egy rövid megjegyzés: „A runtime image 2026-09-29-től a Node-ot közvetlenül indítja (`CMD ["node", "apps/api/dist/main.js"]`), nem a pnpm wrapperen keresztül. Ennek oka, hogy a pnpm 9 `pnpm-native` lockfile-verify helperje ~380 MB RSS-sel jár, ami átlépi a 400 MB-os konténer memóriakorlátot."

11. **[`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md)** „Utolsó frissítés" dátum frissítése, ha a memóriakontó táblázatban az api sor változik. (Nem változik — a `mem_limit: 400m` marad, csak a tényleges felhasználás csökken.)

### 5.6 History + milestone

12. **`docs/history/2026-09-29--01-00-00-pnpm-native-oom-restart-loop-impl.md`** – a megvalósítás részletes leírása (a deploy utáni állapottal, konténer státusszal, dmesg OOM-kill-ek számával, healthcheck logokkal).

13. **`docs/milestones/2026-09-29--01-00-00-pnpm-native-oom-restart-loop.milestone.md`** – döntés szintű összefoglaló, miért fontos, hogy a runtime image ne a pnpm wrapperen, hanem közvetlenül a Node-on fusson, és miért marad a `mem_limit: 400m` a konténeren.

---

## 6. Nem változtatunk

* **`apps/api/package.json` `start:prod` script** – marad (`node dist/main`). A Dockerfile CMD mostantár közvetlenül hívja a `node apps/api/dist/main.js`-t, ami tartalmilag ugyanaz.
* **`apps/api/src/app.controller.ts` Hello World route** – marad (frontend smoke tesztek).
* **`mem_limit: 400m` az api konténeren** – marad. A `--max-old-space-size=384` V8 kupak is marad. A pnpm-wrapper eltávolításával a konténer hidegindítása ~80–120 MB, steady state ~150–200 MB, messze a limit alatt.
* **A Caddy, postgres, monitor service-ek mem_limitje** – változatlan.
* **`POSTGRES_SHARED_BUFFERS=128MB`, `effective_cache_size=512MB`, `work_mem=4MB`** – változatlan.

---

## 7. Siker-kritériumok

| Kritérium | Hogyan ellenőrizzük |
|---|---|
| `aisztens-api-1` státusza `Up X minutes (healthy)` | `docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a` |
| `journalctl -u docker --since '-1h' \| grep restartCount` számossága a deploy után nem nő 1 fölé | `journalctl -u docker --since '-1h' \| grep -c "restarting container.*46e301"` |
| `dmesg` az api konténer scope-jában nem mutat újabb OOM-kill-t | `dmesg --since '-1h' \| grep "docker-46e301"` üres |
| `curl http://127.0.0.1:3000/healthz` a konténerből `{"status":"ok",...}` | `docker compose exec api wget -qO- http://127.0.0.1:3000/healthz` |
| A monitor watchdog nem jelez hibát | `docker compose logs --tail=20 monitor` – nincs „API check failed" sor |
| A `top`-ban a `pnpm-native` és a `do-agent` userhez tartozó folyamatok CPU-ja <5% | `top -bn1 \| head -20` |
| A Caddy-n át `https://api.aisztens.hu/healthz` és `https://api.aisztens.hu/api` is 200 | `curl -fsS https://api.aisztens.hu/healthz` és `curl -fsS https://api.aisztens.hu/api` |
| A CI `apps/api` e2e + unit tesztek zöldek | `pnpm --filter @callback/api test` és `pnpm --filter @callback/api test:e2e` |

---

## 8. Kockázatok / visszafordíthatóság

* **A CMD-változtatás** egyetlen Dockerfile sor, és ha bármi elromlana (pl. egy jövőbeli `apps/api/dist/main.js` útvonal-változtatás), a rollback a CMD visszaírásával azonnal megoldható. A korábbi `pnpm --filter …` forma a `git log`-ban megmarad.
* **A `deploy/deploy.sh up` rizikója**: a deploy szkript az utolsó működő állapothoz képest mindig újraépíti az image-et. Ha a build valamiért elszáll (pl. lockfile drift), a korábbi `aisztens/api:latest` image a `docker image tag`-gel megmarad, és a dropleten manuálisan visszaállítható (`docker compose down && docker tag aisztens/api:backup aisztens/api:latest && docker compose up -d`).
* **A `MONITOR_TARGET_URL` váltás**: ha a `/healthz` endpoint valamiért nem érhető el, a monitor `down` alertet küld, ami operatívan azonnal látszik (nem okoz adatvesztést, csak zajt).
* **A CI futásideje**: nincs új teszt, nincs új build-lépés; a deploy idő ~3-5 perc (image build + push + dropleten restart), mint eddig.

---

## 9. Miért nem elég csak deploy-olni a korábbi `/healthz` javítást?

A kérdés jogos, mert a korábbi impl „kész, deploy-ra vár" státuszban van. Ha csak azt deploy-olnánk (az image újraépülne a `/healthz` endpointtal), **a `pnpm-native` OOM-loop továbbra is fennmaradna**, mert:

1. A `pnpm --filter @callback/api start:prod` CMD nem változik.
2. A `pnpm-native` továbbra is ~380 MB-ot foglal a lockfile-verify hidegindításakor.
3. A konténer továbbra is OOM-kill ciklusban marad, mielőtt a Node-ot egyáltalán elindítaná — a `/healthz` endpoint sosem lesz elérhető, a healthcheck sosem lesz sikeres.

A Dockerfile CMD-módosítás az **egyetlen** olyan változtatás, ami megszünteti a pnpm-wrapper futását a runtime stage-ben, és ezáltal a OOM-loopot is.