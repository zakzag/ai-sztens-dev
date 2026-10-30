# AIS-36 — Drizzle séma és első migráció a `callback_requests` táblához (terv)

**Jira:** AIS-36 (Subtask) — szülő: AIS-29
**Dátum:** 2026-10-19
**Állapot:** jóváhagyott terv, implementáció folyamatban
**Döntések:** B) vékony migrációs runner a [`migrate.ts`](../../apps/api/src/migrate.ts:1)-ben · B2) `__drizzle_migrations` a `platform` sémában (+ AIS-35 delta)

---

## 1. Kiinduló helyzet — pre-flight ellenőrzés (lefuttatva)

| Ellenőrzés                                 | Eredmény                                                        |
| ------------------------------------------ | --------------------------------------------------------------- |
| `docker compose … ps` (DB-only stack)      | `infra-postgres-1 … Up 25 minutes (healthy)`, `5432` publikálva |
| `\dn`                                      | `callback`, `email`, `platform`, `public` — mind megvan         |
| USAGE mátrix (3 séma × 3 role)             | `9`                                                             |
| `has_schema_privilege('aisztens', …)`      | `callback` CREATE = `t`, **`platform` CREATE = `f`**            |
| `pnpm --filter @callback/api db:check`     | `Everything's fine`                                             |
| `pnpm --filter @callback/api build`        | zöld                                                            |
| `apps/api/.env.local`                      | csak `PORT=3000` — **nincs `DATABASE_URL`**                     |
| Node verzió                                | `v20.19.2` → `process.loadEnvFile` elérhető                     |
| `drizzle-orm` / `drizzle-kit` / `postgres` | `^0.45.4` / `^0.31.11` / `^3.4.9` (telepítve)                   |
| `drizzle/meta/_journal.json`               | `entries: []` (még nincs migráció)                              |

**Következtetés:** a toolchain és a DB-oldal kész, a blokkolók a következők voltak — mostanra eldöntve:

1. `db:migrate` placeholder volt → **B)** valódi, de minimál runner.
2. `__drizzle_migrations` helye a grant-mátrix miatt nem triviális → **B2)** `platform` séma, amihez az `aisztens` role-nak `CREATE` jog kell (AIS-35 delta).
3. A `drizzle.config.ts` nem tölti be a `DATABASE_URL`-t, és a fallback `postgres://aisztens:aisztens@…` rossz jelszót használ.

## 2. Döntések

| #   | Döntés                                                                                                                           | Indok                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Séma: `pgSchema('callback')`, tábla: `callback_requests`                                                                         | Az AIS-35-ben létrehozott, grantolt modulhatár                                                                                                    |
| D2  | Enum: `callback.call_status` a `CallStatus` 10 értékével                                                                         | Típusbiztonság; a unit teszt egyezteti a shared unióval                                                                                           |
| D3  | Könyvelő tábla: `platform.__drizzle_migrations` (`migrations: { schema: 'platform', table: '__drizzle_migrations' }`)            | A `platform` az üzemeltetési séma; a `callback` marad tiszta domain, a `drizzle` negyedik séma pedig ellentmondana a dokumentált 3-sémás határnak |
| D4  | AIS-35 delta: `GRANT CREATE ON SCHEMA platform` az `aisztens` role-nak                                                           | A migrátor hozza létre a könyvelő táblát; enélkül `permission denied for schema platform`                                                         |
| D5  | Migrációs runner: `drizzle-orm/postgres-js/migrator` a [`migrate.ts`](../../apps/api/src/migrate.ts:1)-ben, advisory lock nélkül | A DoD-nak megfelel; a lock + `lock_timeout`/`statement_timeout` a Story 3 feladata, a script neve nem változik                                    |
| D6  | `DATABASE_URL` feloldás a configban: env → `apps/api/.env.local` → `infra/.env.local`-ból komponálva → hibaüzenet                | Nulla új dependency (`process.loadEnvFile`), és nem marad néma rossz-jelszó fallback                                                              |
| D7  | A `callback_requests` `CREATE SCHEMA` sort a generált SQL-ben `IF NOT EXISTS`-re javítjuk, ha szükséges                          | A séma AIS-35 óta létezik, a migrációnak idempotensnek kell lennie egy már bootstrappelt DB-n                                                     |

## 3. Tábla-terv

| Oszlop       | Típus                  | Null     | Default                              | Forrás                                             |
| ------------ | ---------------------- | -------- | ------------------------------------ | -------------------------------------------------- |
| `id`         | `uuid`                 | NOT NULL | `gen_random_uuid()` (PG16 beépített) | `CallbackRequest.id`                               |
| `name`       | `varchar(120)`         | NOT NULL | —                                    | DTO `@MaxLength(120)`                              |
| `email`      | `varchar(254)`         | NOT NULL | —                                    | DTO `@MaxLength(254)`                              |
| `phone`      | `varchar(20)`          | NOT NULL | —                                    | DTO regex `{6,20}`                                 |
| `reason`     | `varchar(1000)`        | NOT NULL | —                                    | DTO `@MaxLength(1000)`                             |
| `status`     | `callback.call_status` | NOT NULL | `'queued'`                           | `CallStatus`                                       |
| `created_at` | `timestamptz`          | NOT NULL | `now()`                              | `CallbackRequest.createdAt` (ISO string a API-ban) |

PK: `id`. Index: egyelőre nincs (a `status`/`created_at` lekérdezések az AIS-38/status-machine story-kkal jönnek — ott, a valós query-k ismeretében érdemes indexet felvenni).

## 4. Lépések

1. **AIS-35 delta** — `GRANT CREATE ON SCHEMA platform` az `aisztens`-nek:
   [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:1) (a `CREATE` grant VALUES listája `('callback'), ('platform')`),
   [`01-roles.sh`](../../infra/postgres/init/01-roles.sh:1) guardolt blokkja, a
   [`_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh:1) és a
   [`20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh) elvárásai (a `CREATE` count 1 → 2),
   valamint a grant-mátrix a [`Infrastructure-Docker.md`](../Specs/Infrastructure-Docker.md) §6.2-ben és a
   [`Database-Local.md`](../Specs/Database-Local.md) §4-ben.
2. **`apps/api/src/db/schema.ts`** — `callbackSchema`, `callStatusEnum`, `callbackRequests` tábla, `CallbackRequestRow`/`NewCallbackRequestRow` típusok, JSDoc.
3. **`apps/api/drizzle.config.ts`** — `DATABASE_URL` feloldás (D6), `migrations: { schema: 'platform', table: '__drizzle_migrations' }`, `verbose: true`, `strict: true`.
4. **`db:generate`** — a generált SQL review-ja, `CREATE SCHEMA` → `IF NOT EXISTS` ha kell, majd commit `drizzle/0000_*.sql` + `meta/`.
5. **`apps/api/src/migrate.ts`** — runner: `DATABASE_URL` kötelező (ugyanaz a feloldás, mint a configban), `postgres()` kliens, `migrate(db, { migrationsFolder: 'drizzle', migrationsSchema: 'platform', migrationsTable: '__drizzle_migrations' })`, `try/finally` `sql.end()`, hiba → `process.exitCode = 1`.
6. **`apps/api/src/db/schema.spec.ts`** — unit teszt `getTableConfig`-gal: séma/tábla nevek, 7 oszlop neve+típusa+nullability+defaultja, PK, enum-értékek egyezése a `CallStatus` unióval.
7. **DoD verifikáció** — `db:up` → `build` → `db:migrate` → `\d callback.callback_requests` → `SELECT count(*)` → insert/rollback → `db:migrate` újra (no-op).
8. **Teljes ellenőrzés** — `test`, `lint`, `build`, `db:check`; a meglévő e2e változatlanul zöld (a store még in-memory).
9. **Dokumentáció** — `Database-Local.md` §9 (mi van már meg), grant-mátrix, `docs/history` bejegyzés, milestone.
10. **Commit + Jira** — conventional commit `AIS-36` hivatkozással.

## 5. Fájlok

| Fájl                                                                  | Változás                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `infra/postgres/init/02-schemas.sh`                                   | `CREATE` grant a `platform` sémára is                     |
| `infra/postgres/init/01-roles.sh`                                     | ugyanaz a guardolt blokkban                               |
| `scripts/test/_postgres-init-schemas-test.sh`                         | `platform` CREATE = t várakozás (összesen 2 CREATE grant) |
| `scripts/test/lib/20-cross-service.sh`                                | `postgres-schema-create` elvárás 1 → 2                    |
| `apps/api/src/db/schema.ts`                                           | valódi séma (a placeholder helyett)                       |
| `apps/api/drizzle.config.ts`                                          | env-feloldás + `migrations` beállítás                     |
| `apps/api/drizzle/0000_*.sql` + `meta/`                               | generált, commitolt migráció                              |
| `apps/api/src/migrate.ts`                                             | valódi runner                                             |
| `apps/api/src/db/schema.spec.ts`                                      | új unit teszt                                             |
| `docs/Specs/Database-Local.md`, `docs/Specs/Infrastructure-Docker.md` | grant-mátrix + §9 frissítés                               |

## 6. Kockázatok

| Kockázat                                                                                  | Kezelés                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A generált SQL plain `CREATE SCHEMA "callback";`-t ír → elhasal a már létező sémán        | Review + `IF NOT EXISTS`-re javítás; a `db:migrate` kétszeri futtatása bizonyítja               |
| Az enum bővítése később `ALTER TYPE … ADD VALUE` (nem tranzakcióban) → migrációs fájdalom | A `CallStatus` bővítéskor külön, önálló migráció; a döntést a status-machine story dokumentálja |
| A `platform` séma CREATE joga sérülékenyebb, mint a `callback`-é                          | Csak az app role kapja; a `USAGE` mátrix változatlan; a teszt mindhárom role-ra ellenőriz       |
| `db:migrate` lock nélkül párhuzamosan futhat                                              | Egyelőre lokális/egyfutós használat; a lock a Story 3-ban jön, a script neve nem változik       |
| `DATABASE_URL` hiánya a `apps/api/.env.local`-ban                                         | A config `infra/.env.local`-ból komponál, és ha az sincs, érthető hibát dob                     |
| **`APP_ENV` default `dev`**, a `start:dev` a `.env.dev`-et is betölti                     | AIS-38 előtt tisztázandó (ne a dev droplet DB-jére írjon a helyi API); most csak dokumentálva   |
