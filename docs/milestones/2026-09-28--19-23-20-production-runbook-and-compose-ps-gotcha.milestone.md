# 2026-09-28 — Production Runbook + `docker compose ps` „Created ≠ Up" csapda

## 1. Problem / feature

A `deploy/deploy.sh up` utáni éles verifikáció nem volt dokumentálva: az operátor a saját fejében tartott tudására hagyatkozott, ami:

- nem terjedt ki a `docker compose ps` megtévesztő viselkedésére (`-a` nélkül a `Created` konténerek láthatatlanok),
- nem tartalmazott rollback / vészhelyzeti stop útmutatót,
- nem egységesítette a 4. lépéses konténerellenőrzést a külső végpontok (apex + két subdomain + API health) Caddy-n keresztüli tesztelésével.

Egy 2026-09-28-i deploy során kiderült, hogy a `docker compose ps` (a `-a` nélkül) kimenete **félrevezető lehet**: csak a postgres mutatkozott `Up`-ként, miközben az `api`, `caddy`, `monitor` mind `Created` státuszban volt — a `deploy.sh` utolsó lépése (`up -d --build`) valamilyen oknál fogva nem hajtódott végre, és a deploy mégis exit 0-val zárult.

## 2. Measured data / evidence

A dropleten a felhasználó által futtatott parancs és kimenete:

```bash
$ docker compose --env-file infra/.env -f infra/docker-compose.yml ps
NAME                  IMAGE                COMMAND                  SERVICE    CREATED         STATUS                   PORTS
aisztens-postgres-1   postgres:16-alpine   "docker-entrypoint.s…"   postgres   3 minutes ago   Up 3 minutes (healthy)   5432/tcp
```

A `ps -a` flaggel kiegészítve már láthatóvá vált a probléma:

```bash
$ docker compose ... ps -a
NAME                  IMAGE                     COMMAND                  SERVICE    CREATED         STATUS
aisztens-postgres-1   postgres:16-alpine        "docker-entrypoint.s…"   postgres   6 minutes ago   Up 6 minutes (healthy)
aisztens-api-1        aisztens/api:latest       "docker-entrypoint.s…"   api        6 minutes ago   Created
aisztens-caddy-1      caddy:2-alpine            "caddy run --config …"   caddy      6 minutes ago   Created
aisztens-monitor-1    aisztens/monitor:latest   "/app/watch.sh"          monitor    6 minutes ago   Created
```

A `docker compose ... up -d --build` manuális újrafuttatásával mind a 4 konténer `Up` állapotba került — a release sikeresen befejeződött.

## 3. Root cause / design rationale

A `docker compose ps` alapértelmezetten csak a **futó** konténereket listázza. Ha a stack indítása félbeszakad, a service-ek `Created` státuszban maradnak (a Docker daemon létrehozta a konténert, de soha nem indította el), és a `ps` kimenetéből **teljesen hiányoznak**.

A runbook-ot ezért két dolog motiválja:

1. **Operatív biztonság** — az operátor első lépése legyen egy explicit, megbízható konténerlista, és ne a `ps` „happy path" kimenetére hagyatkozzon.
2. **Dokumentált hibadiagnosztika** — a leggyakoribb tünetek (`Restarting`, `Exited`, OOM, ACME hiba) és a hozzájuk tartozó teendők legyenek kéznél, hogy ne kelljen minden incidensnél a logok mélyére ásni.

Alternatívák, amiket elvetettünk:

- **`deploy.sh` exitkód-szigorítása**: a `set -euo pipefail` ellenére a script akkor is sikeres, ha az utolsó `up` parancs valamiért kimarad (pl. egy korábbi lépés `|| true` mögé bújik). A runbook használata + a `ps -a` check olcsóbb, mint a shell-script refaktor.
- **GitHub Actions smoke lépés**: a CI-ben a [`stack-smoke.sh`](../../scripts/test/stack-smoke.sh) már lefut a deploy után, de ez lokális deploy-nál (kézzel futtatott `deploy.sh up`) kimarad. A runbook manuális deploy-hoz készült, és kiegészíti a CI-t.

## 4. Solution / implementation

| Fájl | Változás |
|---|---|
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | **Új fájl.** 10 szekció: cél, mikor kell, belépés, 4.1–4.7 verifikációs lépések (konténer / külső végpontok / ACME / belső service-ek / renderelt Caddyfile / SPA bundle / erőforrások), copy-paste „minden oké?" pipeline, hibadiagnosztikai mátrix, rollback / vészhelyzeti stop. |
| [`docs/history/2026-09-28-production-runbook-and-docker-compose-ps-gotcha.md`](../../docs/history/2026-09-28-production-runbook-and-docker-compose-ps-gotcha.md) | **Új fájl.** A chat eseményeinek narratívája: mit látott a felhasználó, hogyan diagnosztizáltuk, hogyan javítottuk. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | `Utolsó frissítés` dátum frissítése (2026-09-28), `Kapcsolódik` sor kiegészítése a runbook linkkel. |

A runbook a [`Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) §5 „Verifikáció" szekcióját egészíti ki azzal, hogy a Caddy-specifikus check-eken túl a teljes stack-re kiterjed (postgres, monitor, erőforrások, rollback).

## 5. Outcome and how to verify

A runbook akkor tekinthető hatékonynak, ha egy operátor a `deploy/deploy.sh up` után 5 percen belül:

1. `ps -a` → mind a 4 konténer `Up`,
2. `curl` a 4 külső végpontra → mind `200`/`307`,
3. ACME log → `obtained certificate`,
4. `pg_isready` + monitor belső curl → OK,
5. `docker stats` → mem_limit-ek alatt.

Azonnali verifikáció ezen a deploy-n:

```bash
ssh root@<HOST> "cd /opt/aisztens && bash -s" <<EOF
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a
EOF
```

Várt: 4 sor, mindegyik `Up`, postgres `Up (healthy)`.

## 6. Follow-ups

- A [`deploy/deploy.sh`](../../deploy/deploy.sh) `up` parancs után érdemes lenne egy **opcionális smoke lépés** beépítése a `docker compose ps -a` ellenőrzéssel — ha bármelyik konténer `Created`/`Exited`/`Restarting`, a script kilépjen hibakóddal. (P1, alacsony prioritás, mert a runbook ezt manuálisan is megfogja.)
- A `docker stats --no-stream` kimenetének eltárolása egy log-fájlba (pl. `/var/log/aisztens/snapshot-$(date).log`) a trend-analízishez — ehhez egy kis helper szkript kéne a [`scripts/`](../../scripts/) alá.
- A Caddy container `caddy list-certificates` kimenetének rendszeres archiválása — ha egy tanúsítvány lejár, abból sok incidens megelőzhető. (P2, monitor service bővítés.)
