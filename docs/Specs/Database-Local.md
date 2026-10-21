# Database — Local Postgres (AIsztens)

**Státusz:** Élő

**Utolsó frissítés:** 2026-10-21 (AIS-37: elkészült a `CallbackRequestsRepository` szerződés és a Drizzle implementáció DB nélkül futó unit tesztekkel; a repository-t az `AppModule` még **nem** köti be, az API továbbra is a memóriabeli `Map`-et használja. AIS-36: a `db:migrate` már létrehozza a `callback.callback_requests` táblát és a `platform.__drizzle_migrations` könyvelő táblát, ehhez a `platform` séma `CREATE` jogot kapott; AIS-35: a lokális Postgres bootstrap sémákra és grantokra bővült — `02-schemas.sh`. A dokumentum a bootstrap, verifikáció, reset és a jelenlegi korlátok egyetlen helye)

**Kapcsolódik:** [`docs/Specs/Local-Development.md`](Local-Development.md), [`docs/Specs/Infrastructure-Docker.md`](Infrastructure-Docker.md) §6.2, [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml), [`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml), [`infra/postgres/init/`](../../infra/postgres/init/), [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh), [`scripts/README.md`](../../scripts/README.md)

> **Hatókör.** Ez a doksi a **fejlesztői gépen** futó PostgreSQL-ről szól: hogyan
> bootstrappeled, ellenőrzöd, reseteled, és mi az, ami még *nincs* benne. A droplet
> oldali üzemeltetés a [`Production-Runbook.md`](Production-Runbook.md) és az
> [`Infrastructure-Docker.md`](Infrastructure-Docker.md) §6.2 hatóköre.

---

## 1. Kétféle lokális Postgres — ne futtasd egyszerre

| | **DB-only stack** | **Teljes lokális stack** |
|---|---|---|
| Compose | [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml) | [`infra/docker-compose.yml`](../../infra/docker-compose.yml) + [`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml) |
| Indítás | `pnpm db:up` | `scripts/dev-stack.sh up` |
| Volume (compose kulcs) | `pgdata_local` (külön!) | `pgdata` |
| Tényleges Docker volume | `infra_pgdata_local` | `aisztens_pgdata` |
| Konténer neve | `infra-postgres-1` | `aisztens-postgres-1` |
| Host port | `5432` | `5432` |
| Mire való | csak az API fut a hoston (`pnpm --filter @callback/api start:dev`) | api + web + admin konténerben, Caddy kikapcsolva |
| Init scriptek | ugyanaz a bind mount | ugyanaz a bind mount |

A **tényleges** volume- és konténernevek a compose projektnévből jönnek: a
[`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml) nem ad `name:`-et,
ezért a projekt a könyvtár neve (`infra` → `infra_pgdata_local`), a teljes stack
viszont `name: aisztens`-t deklarál ([`infra/docker-compose.yml`](../../infra/docker-compose.yml))
→ `aisztens_pgdata`. Ellenőrzés: `docker volume ls | findstr pgdata`.

**Két következmény, amit mindig tarts szem előtt:**

1. **Portütközés.** Mindkettő a host `5432`-re publikál. Ha a teljes stack fut, a
   `pnpm db:up` `port is already allocated` hibával áll meg (és fordítva). Egy időben
   csak az egyik legyen futva.
2. **Külön adat.** A `pgdata_local` és a `pgdata` **nem** ugyanaz a volume. Egy
   DB-only stackben létrehozott sor nem látszik a teljes stack Postgres-ében.

---

## 2. Előfeltétel

```bash
docker compose version        # v2 kell (plugin), nem a régi docker-compose binary
```

Docker Desktop WSL2-integrációval (Windows) vagy natív Docker (Linux/macOS).

---

## 3. Env fájl — mit kell kitölteni

Mindkét útvonal ugyanazt a fájlt használja: **`infra/.env.local`** (gitignored).

```bash
cp infra/.env.example infra/.env.example.bak   # csak ha össze akarod hasonlítani
cp infra/.env.example infra/.env.local
```

A Postgres bootstrap **kizárólag** ezeket a kulcsokat olvassa:

| Kulcs | Default (ha hiányzik) | Ki használja |
|---|---|---|
| `POSTGRES_DB` | `aisztens_db` | compose + init scriptek |
| `POSTGRES_USER` | `postgres` | compose + init scriptek (superuser, ő futtatja az initet) |
| `POSTGRES_PASSWORD` | — (**kötelező**) | compose |
| `AISZTENS_DB_USER` | `aisztens` | [`01-roles.sh`](../../infra/postgres/init/01-roles.sh), [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) |
| `AISZTENS_DB_PASSWORD` | — (**kötelező**) | `01-roles.sh` |
| `TKOVARI_DB_PASSWORD` | — (**kötelező**) | `01-roles.sh` |
| `KRAK_DB_PASSWORD` | — (**kötelező**) | `01-roles.sh` |

`scripts/dev-stack.sh up` első futáskor magától seedeli a fájlt az
`infra/.env.example`-ből (chmod 600) és figyelmeztet a placeholder jelszavakra —
a `pnpm db:up` viszont **nem** seedel, ott a `cp` a te dolgod.

A hoston futó API ugyanezt a jelszót várja a
[`apps/api/.env.local`](../../apps/api/.env.example) `DATABASE_URL` sorában:

```
DATABASE_URL=postgres://aisztens:<AISZTENS_DB_PASSWORD>@localhost:5432/aisztens_db
```

---

## 4. Bootstrap — mi történik az első indításkor

Az `infra/postgres/init/` könyvtár a `/docker-entrypoint-initdb.d` helyre van
bind-mountolva. A hivatalos `postgres:16-alpine` entrypoint **csak üres adatkönyvtár
első inicializálásakor** futtatja a benne lévő scripteket, **lexikografikus
sorrendben**:

| Script | Mit hoz létre |
|---|---|
| [`01-roles.sh`](../../infra/postgres/init/01-roles.sh) | `aisztens` (app), `tkovari` (owner), `krak` (operátor) role; a database tulajdonosa `aisztens`; `GRANT CONNECT` az operátoroknak; séma-szintű grantok `\gexec`-guarddal (friss initen no-op, mert a sémák ekkor még nem léteznek) |
| [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) | `platform`, `callback`, `email` sémák (`CREATE SCHEMA IF NOT EXISTS`) + a grant-mátrix |

Grant-mátrix (a két script és az [`Infrastructure-Docker.md`](Infrastructure-Docker.md) §6.2
ugyanezt írja le):

| Séma | `aisztens` (app) | `tkovari` (owner) | `krak` (operátor) |
|---|---|---|---|
| `platform` | USAGE + **CREATE** | USAGE | USAGE |
| `callback` | USAGE + **CREATE** | USAGE | USAGE |
| `email` | USAGE | USAGE | USAGE |

- A `CREATE` jog azért kell, mert a Drizzle migrációs runner (`aisztens` kapcsolattal)
  a `callback` sémában hozza létre a `callback_requests` táblát, a `platform` sémában
  pedig a saját könyvelő tábláját (`platform.__drizzle_migrations`) — AIS-36.
- Az operátorok szándékosan **nem** kapnak `CREATE`-ot: olvasásra (`\dt`, `SELECT`)
  elég a `USAGE`.
- A sémák tulajdonosa a bootstrap superuser (`POSTGRES_USER`) marad; nincs ownership-átírás.
- `tkovari` / `krak` **literál role-név** két scriptben — átnevezéskor mindkettőt kell
  módosítani.

> **Tilos `DO $$ … $$` blokkba tenni a psql-változókat.** A psql a `:'var'` / `:"var"`
> helyettesítést lexikailag végzi és dollar-quote-olt stringen belül nem interpolál
> (`syntax error at or near ":"`). A feltételes DDL ezért `\gexec`-et használ.

Mindkét script **idempotens**: újrafuttatható, és kétszeri futás után sem változik a
végeredmény.

---

## 5. Indítás és leállítás

```bash
# DB-only (API a hoston)
pnpm db:up        # docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml up -d
pnpm db:down      # leállítja a konténert, a pgdata_local volume MEGMARAD

# Teljes lokális stack (api/web/admin konténerben, Caddy off)
scripts/dev-stack.sh up
scripts/dev-stack.sh down
```

Teljes törlés (adat is elvész):

```bash
# DB-only stack: a `down -v` a hozzá tartozó `infra_pgdata_local` volume-ot törli
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml down -v

# Teljes stack: a `down` megtartja a volume-ot, ezért külön kell törölni
scripts/dev-stack.sh down
docker volume rm aisztens_pgdata
```

Állapot és az init tényleges lefutása:

```bash
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml ps
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml logs postgres
# "PostgreSQL init process complete" = az init scriptek lefutottak
# "Skipping initialization"        = a volume már inicializált, az init NEM futott
```

---

## 6. Verifikáció

Psql a konténeren belül (host `psql` nem kell):

```bash
DC="docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml"

$DC exec -T postgres psql -U postgres -d aisztens_db -c '\dn'
# Elvárt: public, platform, callback, email  (+ information_schema, pg_catalog, pg_toast)

$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT rolname FROM pg_roles WHERE rolname IN ('aisztens','tkovari','krak') ORDER BY 1"
# Elvárt: aisztens, krak, tkovari

$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT count(*) FROM (VALUES ('platform'),('callback'),('email')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'USAGE')"
# Elvárt: 9  (3 séma × 3 role)

$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT count(*) FROM (VALUES ('callback'),('platform')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'CREATE')"
# Elvárt: 2   (CREATE csak az aisztens role-nak: callback + platform)

# A migráció után: a tábla és a könyvelő tábla
$DC exec -T postgres psql -U postgres -d aisztens_db -c '\d callback.callback_requests'
$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT count(*) FROM platform.__drizzle_migrations"
# Elvárt: 1  (a 0000 migráció; újrafuttatás után sem nő)
```

Automatizált ellenőrzés (nem kell hozzá futó stack, saját eldobható konténert indít):

```bash
bash scripts/test/_postgres-init-schemas-test.sh     # elvárt: PASS: 29  FAIL: 0
```

Ugyanezt a mátrixot ellenőrzi a `pnpm test:stack` is a `postgres-schemas`,
`postgres-schema-usage` és `postgres-schema-create` checkekkel
([`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh))
— azok viszont **futó** stacket igényelnek.

---

## 7. Kapcsolódás

| Honnan | Hogyan |
|---|---|
| Konténerből (ajánlott) | `docker compose ... exec -T postgres psql -U <role> -d aisztens_db` |
| Hostról, `psql` klienssel | `psql "postgres://aisztens:<AISZTENS_DB_PASSWORD>@localhost:5432/aisztens_db"` |
| Hostról, GUI-val (DataGrip, DBeaver) | host `localhost`, port `5432`, DB `aisztens_db`, user `aisztens` |
| Hoston futó API | `DATABASE_URL` a [`apps/api/.env.local`](../../apps/api/.env.example) fájlban |

Megjegyzés: a `postgres` superuser csak a bootstraphez és a diagnosztikához kell; az
alkalmazás **mindig** az `aisztens` role-lal kapcsolódik. A `postgres` role
`DATABASE_URL`-be tétele elfedné a grant-hibákat.

---

## 8. Amikor a volume már létezik (init nem fut újra)

Ez a leggyakoribb buktató: **új init script nem fut le egy meglévő volume-on.** Ha a
`pgdata_local` / `pgdata` korábban inicializálódott (pl. AIS-35 előtt), a sémák és a
`CREATE` grant hiányozni fog, és a `db:migrate` `permission denied for schema callback`
hibát ad.

```bash
# a) újrafuttatás helyben (idempotens, adat megmarad)
$DC exec -T postgres bash /docker-entrypoint-initdb.d/02-schemas.sh

# b) tiszta lap (local adat elveszik)
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml down -v
pnpm db:up
```

A teljes stacknél ugyanez a `pgdata` volume-ra igaz (a scriptek ugyanazok).

---

## 9. Mi van, és mi még nincs a lokális DB-ben (2026-10-21)

**AIS-36 óta megvan** — a `pnpm --filter @callback/api db:migrate` után:

| Dolog | Hol / hogyan |
|---|---|
| `callback.callback_requests` tábla (7 oszlop) | [`drizzle/0000_pretty_bromley.sql`](../../apps/api/drizzle/0000_pretty_bromley.sql), alkalmazva `db:migrate`-tel |
| `callback.call_status` enum (a `CallStatus` 10 értéke) | ugyanaz a migráció |
| `platform.__drizzle_migrations` könyvelő tábla | `drizzle.config.ts` `migrations` beállítás + a runner |
| működő `db:migrate` | [`apps/api/src/migrate.ts`](../../apps/api/src/migrate.ts) (lock nélkül) |
| generált SQL + snapshot | `apps/api/drizzle/0000_*.sql` + `apps/api/drizzle/meta/` |

**AIS-37 óta megvan** — kód- és tesztszinten, futó DB **nélkül**:

| Dolog | Hol / hogyan |
|---|---|
| `CallbackRequestsRepository` szerződés (`create`, `findAll`, `findOne`) | [`callback-requests.repository.interface.ts`](../../apps/api/src/db/callback-requests.repository.interface.ts) |
| Drizzle implementáció (`findAll` → `created_at DESC`, `findOne` → uuid-guard + limit 1) | [`callback-requests.repository.ts`](../../apps/api/src/db/callback-requests.repository.ts) |
| Saját hibák (`NotFound` / `InvalidId` / `NotPersisted`) | [`callback-requests.errors.ts`](../../apps/api/src/db/callback-requests.errors.ts) |
| `DATABASE` injekciós token + `Database` típus (a Nest provider AIS-38-ban jön) | [`database.const.ts`](../../apps/api/src/db/database.const.ts), [`database.interface.ts`](../../apps/api/src/db/database.interface.ts) |
| Unit tesztek mockolt Drizzle handle-lel (nincs `DATABASE_URL`, nincs socket) | [`callback-requests.repository.spec.ts`](../../apps/api/src/db/callback-requests.repository.spec.ts), [`uuid.spec.ts`](../../apps/api/src/db/uuid.spec.ts), mockok: `src/db/test/mocks/` |

**Még nincs** — ezeket ne keresd:

| Hiányzó dolog | Miért | Mikor jön |
|---|---|---|
| adat a `callback_requests`-ben az API-tesztelés után | a repository már létezik és tesztelt, de az `AppModule` még nem köti be; a store továbbra is in-memory `Map` ([`callback-requests.service.ts:12`](../../apps/api/src/callback-requests/callback-requests.service.ts:12)) | AIS-38 (DI modul + service csere + e2e) |
| tábla-szintű grantok (`SELECT`/`INSERT`) az operátoroknak | a táblát az `aisztens` hozta létre, tehát ő a tulajdonos; a `tkovari`/`krak` csak séma-szintű `USAGE`-ot kapott | későbbi read-only operátori hozzáférés |
| indexek a `callback_requests`-en | a valós query-k (státusz, időrend) még nem ismertek | AIS-38 / status-machine |
| migrációs lock, `lock_timeout`, `statement_timeout` | a runner egyelőre lock nélkül fut | Story 3 |

Ebből következik, hogy a lokális DB-ben **ma** a séma- és tábla-szintű eredmény az, amit
ellenőrizni érdemes (§6) — az API által írt sorokat nem.

---

## 10. Hibadiagnosztika

| Tünet | Ok | Megoldás |
|---|---|---|
| `port is already allocated` a 5432-n | a másik lokális stack (teljes vagy DB-only) már fut | állítsd le a másikat (`pnpm db:down` / `scripts/dev-stack.sh down`) |
| `FATAL: password authentication failed for user "aisztens"` | az `AISZTENS_DB_PASSWORD` az `infra/.env.local`-ban más, mint amivel kapcsolódsz — vagy a role-t egy korábbi, más jelszóval inicializált volume hozta létre | `$DC exec -T postgres bash /docker-entrypoint-initdb.d/01-roles.sh` (a script `ALTER ROLE … PASSWORD`-öt is futtat), vagy `down -v` + `pnpm db:up` |
| `FATAL: role "aisztens" does not exist` | az init nem futott le (nem üres volume), vagy `01-roles.sh` hibával elhalt | nézd a `logs postgres`-t; futtasd kézzel a `01-roles.sh`-t |
| `Skipping initialization` a logban | a volume már inicializált | ez nem hiba; új scripthez lásd §8 |
| `permission denied for schema callback` | hiányzik a `CREATE` grant (AIS-35 előtt inicializált volume) | §8 a) vagy b) |
| `FATAL: the database system is shutting down` | az entrypoint **ideiglenes** init-szervere áll le, miközben te már kérdezel | várj a `PostgreSQL init process complete` markerre, utána kérdezz |
| a `db:migrate` „lefut”, de a tábla nem jelenik meg | a runner a `drizzle/` mappát a **cwd**-hez képest keresi, tehát `pnpm --filter @callback/api db:migrate`-tel (cwd = `apps/api`) kell futtatni; közvetlen `node dist/migrate.js` máshonnan a repó gyökeréből nézve nem találja | futtasd `pnpm --filter @callback/api db:migrate`-tel |
| `password authentication failed for user "aisztens"` a `db:migrate`-nél | a `DATABASE_URL` nem oldható fel, és a config az `infra/.env.local`-ból komponál — de az `AISZTENS_DB_PASSWORD` más, mint amivel a volume inicializálódott | lásd a fenti sort: `01-roles.sh` újrafuttatás vagy `down -v` |

---

## 11. Karbantartási szabály

Ez a dokumentum **élő**. Frissíteni kell, ha változik:

- az [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml) `postgres`
  service bármely mezője (port, volume, init mount, env kulcsok),
- az [`infra/postgres/init/`](../../infra/postgres/init/) bármely scriptje (role-ok,
  sémák, grantok),
- a lokális DB-t érintő `package.json` script (`db:up` / `db:down` / `db:migrate`),
- az [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) vagy a generált
  `apps/api/drizzle/` tartalma (új tábla/oszlop → új szakasz a §9 „megvan” táblájában),
- vagy amikor a §9 „még nincs” tábla egy sora megvalósul (AIS-38 / Story 3).

A frissítési kötelezettséget a [`.roo/rules/instructions.md`](../../.roo/rules/instructions.md)
„Specs doksik karbantartása” szekciója rögzíti.
