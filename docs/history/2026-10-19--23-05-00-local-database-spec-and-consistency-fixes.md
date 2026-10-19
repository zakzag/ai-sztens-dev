# Lokális Postgres specs + specs-konzisztencia javítás

**Dátum:** 2026-10-19
**Kapcsolódó:** AIS-35 (per-context Postgres sémák), AIS-36/AIS-38 (még nem készült el)
**Érintett fájlok:** [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) (új),
[`docs/Specs/Local-Development.md`](../Specs/Local-Development.md),
[`docs/Specs/Infrastructure-Docker.md`](../Specs/Infrastructure-Docker.md),
[`docs/Specs/Three-Env-Verification.md`](../Specs/Three-Env-Verification.md),
[`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md)

## Kiinduló probléma

A lokális Postgres bootstrapje (env kulcsok, bootstrap lépések, verifikációs query-k,
reset/wipe) négy doksi között szóródott szét, és nem volt egyetlen végigvihető
runbook. Emellett két specs **tárgyi pontatlanságot** tartalmazott a DB-ről.

## Amit hozzáadtam

### Új specs: `Database-Local.md`

A lokális (fejlesztői gépi) PostgreSQL egyetlen leírása:

| Fejezet | Tartalom |
|---|---|
| §1 | A két lokális Postgres (DB-only vs. teljes stack), tényleges Docker volume- és konténernevekkel, plus a **5432 portütközés** |
| §2–3 | Előfeltétel; a `infra/.env.local` kötelező kulcsai és defaultjai |
| §4 | Bootstrap: a két init script, grant-mátrix, `DO $$` tilalom, idempotencia |
| §5 | Indítás/leállítás, `down -v`, init-lefutás ellenőrzése a logból |
| §6 | Verifikáció: `\dn`, role-ok, USAGE ×9, `CREATE` a `callback`-re — elvárt kimenetekkel |
| §7 | Kapcsolódás (konténerből, hostról, GUI-ból, API `DATABASE_URL`) |
| §8 | Meglévő volume esete: re-apply vagy `down -v` |
| §9 | **Ami még nincs:** `callback_requests`, `__drizzle_migrations`, működő `db:migrate`, tábla-grantok |
| §10 | Hibadiagnosztika (portütközés, password auth, role hiány, permission denied, „shutting down") |
| §11 | Karbantartási szabály |

### `Local-Development.md` §2b kiegészítése

Új alfejezetek a korábban hiányzó elemekkel: **2b.1** kötelező env kulcsok,
**2b.2** a két stack nem futhat egyszerre (5432 + külön volume),
**2b.3** verifikációs query-k elvárt kimenettel + a `PASS: 23` teszt,
**2b.4** init first-run-only (meglévő tartalom, áthelyezve),
**2b.5** stop vs. wipe, tényleges volume-nevekkel. Plusz hivatkozás a
`Database-Local.md`-ra a §6 „See also”-ban.

## Javított ellentmondások (ellenőrizve)

| Hol | Mi volt a hiba | Javítás |
|---|---|---|
| [`Three-Env-Verification.md`](../Specs/Three-Env-Verification.md) §2.7 | `SELECT count(*) FROM callback_requests` — ilyen tábla **nincs** (a store in-memory `Map`, [`callback-requests.service.ts:12`](../../apps/api/src/callback-requests/callback-requests.service.ts:12)) | A szekció role/séma-bootstrapot ellenőriz (`current_user`, `\dn`, `has_schema_privilege`), és kimondja, hogy a sor-szintű check AIS-38-cal jön; a §7-es hibasorok is átírva |
| [`Production-Runbook.md`](../Specs/Production-Runbook.md) §7 | azt állította, hogy a smoke suite „valódi `callback_requests` sort hoz létre az adatbázisban” | A suite csak megfigyel (a kódban nincs ilyen POST); a szöveg ezt írja le, plusz a tábla hiányát |
| [`Infrastructure-Docker.md`](../Specs/Infrastructure-Docker.md) §6.2 | nem hivatkozott a lokális nézetre | Egy bekezdés + link a `Database-Local.md`-ra |

Emellett a `Production-Runbook.md` §4.4 blokk-idézete után **stray code fence**
maradt (páratlan fence-szám, emiatt a §4.5-től elcsúszott a renderelés) — ezt
eltávolítottam; most minden módosított specs fence-száma páros.

Ezen kívül ellenőriztem, hogy a grant-mátrix (**3 séma × 3 role = 9 USAGE**,
`CREATE` csak `aisztens`-nek a `callback`-ben) szó szerint ugyanaz a
`Database-Local.md`, a `Local-Development.md`, az `Infrastructure-Docker.md`
és a [`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh)
checkjeiben.

## Verifikáció

```text
FENCES docs/Specs/Database-Local.md = 18 (OK, páros)
FENCES docs/Specs/Local-Development.md = 14 (OK, páros)

link targets of Database-Local.md:
  OK  docs/Specs/Local-Development.md
  OK  docs/Specs/Infrastructure-Docker.md
  OK  docs/Specs/Production-Runbook.md
  OK  infra/docker-compose.db.yml / .local.yml / docker-compose.yml
  OK  infra/postgres/init/01-roles.sh / 02-schemas.sh
  OK  scripts/test/_postgres-init-schemas-test.sh
  OK  scripts/test/lib/20-cross-service.sh
  OK  scripts/README.md
  OK  apps/api/src/callback-requests/callback-requests.service.ts
  OK  apps/api/src/db/schema.ts / apps/api/src/migrate.ts
  OK  apps/api/.env.example / infra/.env.example
  OK  .roo/rules/instructions.md

soft-hyphens in Database-Local.md = 0   (egy U+00AD tisztítva)
```

Tényellenőrzés a kódból (nem a doksiból):

- `docker compose -f infra/docker-compose.db.yml config` → projekt **`infra`**,
  volume **`infra_pgdata_local`** (a fájl nem ad `name:`-et);
- [`infra/docker-compose.yml:25`](../../infra/docker-compose.yml:25) → `name: aisztens`
  → volume **`aisztens_pgdata`**;
- `apps/api/src/**` nem tartalmaz `DATABASE_URL`/`drizzle` fogyasztást, a séma
  placeholder, a `migrate.ts` placeholder → a §9 „még nincs" tábla helyes.

## Következmény

A lokális DB-t érintő tudás most **egy** helyen van (`Database-Local.md`), a
`Local-Development.md` pedig a napi munkafolyamathoz szükséges minimumot adja.
A specs-karbantartási szabály szerint a `Database-Local.md` §11 listája mondja meg,
mikor kell újra frissíteni (compose postgres blokk, init scriptek, `db:*` scriptek,
vagy a §9 sorainak megvalósulása).
