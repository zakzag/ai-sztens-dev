# 2026-09-28 — Production runbook + `docker compose ps` „Created ≠ Up" csapda

## Összefoglaló

A mai napon két, egymáshoz kapcsolódó fejlesztés történt:

1. A `deploy/deploy.sh up` utáni éles verifikáció eddig nem volt dokumentálva — készítettem egy átfogó **Production Runbook**-ot ([`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md)), amely a teljes konténer- + végpont- + ACME- + erőforrás-ellenőrzést lefedi.

2. A runbook készítése közben derült ki, hogy a `deploy/deploy.sh up` után a dropleten **csak a postgres konténer volt `Up`** — az `api`, `caddy` és `monitor` mind `Created` státuszban. A `docker compose ps` (a `-a` flag nélkül) ezt a kritikus hibát elrejti, és csak a futó konténereket mutatja. A `docker compose up -d --build` manuális újrafuttatásával a stack teljesen elindult.

## Mi történt pontosan?

A dropleten a felhasználó lefuttatta a `docker compose --env-file infra/.env -f infra/docker-compose.yml ps` parancsot, és az alábbi kimenetet kapta:

```
NAME                  IMAGE                COMMAND                  SERVICE    CREATED         STATUS                   PORTS
aisztens-postgres-1   postgres:16-alpine   "docker-entrypoint.s…"   postgres   3 minutes ago   Up 3 minutes (healthy)   5432/tcp
```

Ez első ránézésre „csak a postgres fut, a többi még nem" benyomását keltette. A valóságban a helyzet az volt, hogy a `deploy/deploy.sh up` utolsó lépése (`docker compose $COMPOSE_ARGS up -d --build`) valamilyen oknál fogva nem hajtódott végre a deploy során, így a postgres image (amelyik pull-olva volt a korábbi futásokból) elindult, de a többi konténer **létrejött** (`docker compose create` lefutott az `up` során), de **soha nem indult el**.

A `-a` (vagy `--all`) flag nélküli `ps` kimenetéből ez nem derült ki — a `Created` státuszú konténerek teljesen láthatatlanok.

## A megoldás

1. **Diagnózis**: `docker compose ... ps -a` kimutatta, hogy mind a 4 konténer `Created` állapotban van.
2. **Javítás a dropleten**: `docker compose ... up -d --build` — a teljes stack elindult, minden konténer `Up` lett.
3. **Dokumentáció**: a runbookban explicit szerepel, hogy a verifikáció **mindig** a `ps -a` flag-gel kezdődjön, mert különben a `Created` állapotú konténerek láthatatlanok maradnak.

## Miért fontos ez?

Ez egy tipikus „silent failure" minta:

- A `deploy.sh` exitkódja 0 volt (a `set -euo pipefail` ellenére is, mert az `up` parancs nem futott le).
- A postgres azért indult el, mert az image kéznél volt a daemon cache-ben.
- Az operátor a `ps` kimenetét látva azt hitte, „megy a postgres, a többi talán még bootol" — és percekig várt volna, mielőtt észreveszi a problémát.

A jövőben a runbook 4.1-es szekciója ezt explicit tanítja, és a 6-os „Hibadiagnosztikai mátrix" tartalmazza a tünet → ok → teendő hármast.

## Változások a fájlokban

- **Új fájl**: [`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md) — a teljes éles verifikációs checklist, másolható parancsokkal, hibadiagnosztikai mátrixszal és rollback útmutatóval.
- **Módosítandó (a szabály szerint)**: [`docs/Specs/Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md) — `Utolsó frissítés` dátum frissítése és a runbook-ra mutató link a „Kapcsolódik" sorban.

## Kapcsolódó milestone

A téma megér egy milestone-t: [`docs/milestones/2026-09-28-production-runbook-and-compose-ps-gotcha.milestone.md`](../milestones/2026-09-28-production-runbook-and-compose-ps-gotcha.milestone.md) — részletezi a döntés hátterét (miért kell runbook), a tanulságot (`ps -a` kötelező) és a verifikációs lépéseket.

## Tanulságok

1. **`docker compose ps` soha nem elég** — mindig `ps -a` a teljes képhez.
2. **A `deploy.sh` exitkódja nem garancia** — ha a stack indítása bármiért kimarad (timeout, network glitch, lemez megtelt), a deploy sikeresnek tűnik, de a konténerek nem futnak.
3. **A runbooknak tartalmaznia kell a hibadiagnosztikai mátrixot** — az operátor ne fejből keresse a mintákat.
