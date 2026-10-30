# AIS-36 — Drizzle séma és első migráció (implementáció)

**Dátum:** 2026-10-19
**Jira:** AIS-36 (Subtask) — szülő: AIS-29
**Terv:** [`2026-10-19--23-20-00-ais-36-drizzle-schema-first-migration-plan.md`](2026-10-19--23-20-00-ais-36-drizzle-schema-first-migration-plan.md)
**Milestone:** [`2026-10-19--23-30-00-callback-requests-schema-and-migration-runner.milestone.md`](../milestones/2026-10-19--23-30-00-callback-requests-schema-and-migration-runner.milestone.md)

## Kiinduló állapot (pre-flight)

| Ellenőrzés                            | Eredmény                                             |
| ------------------------------------- | ---------------------------------------------------- |
| DB-only stack                         | `infra-postgres-1 Up (healthy)`, `5432`              |
| `\dn`                                 | `callback`, `email`, `platform`, `public`            |
| USAGE mátrix                          | `9`                                                  |
| `has_schema_privilege('aisztens', …)` | `callback` CREATE = `t`, `platform` CREATE = **`f`** |
| `db:check` / `build`                  | zöld / zöld                                          |
| `apps/api/.env.local`                 | csak `PORT=3000`, **nincs `DATABASE_URL`**           |
| Node                                  | `v20.19.2` → `process.loadEnvFile` elérhető          |

## Változások

| Fájl                                                                                                                                                                                   | Változás                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts)                                                                                                                         | valódi séma: `callbackSchema`, `CALL_STATUS_VALUES` (`satisfies readonly CallStatus[]`), `callStatusEnum`, `callbackRequests` (7 oszlop), `CallbackRequestRow` / `NewCallbackRequestRow`  |
| [`apps/api/src/db/database-url.ts`](../../apps/api/src/db/database-url.ts)                                                                                                             | `DATABASE_URL` feloldás: env → `apps/api/.env.local` → `infra/.env.local`-ból komponálva → hiba; `tryResolve` (offline toolokhoz) és `resolve` (csatlakozó processekhez)                  |
| [`apps/api/drizzle.config.ts`](../../apps/api/drizzle.config.ts)                                                                                                                       | a fenti resolvert használja, `migrations: { schema: 'platform', table: '__drizzle_migrations' }`, `strict`, `verbose`; némán nem csatlakozik rossz URL-re                                 |
| [`apps/api/drizzle/0000_pretty_bromley.sql`](../../apps/api/drizzle/0000_pretty_bromley.sql)                                                                                           | generált migráció; a `CREATE SCHEMA "callback"` **kézzel `IF NOT EXISTS`-re javítva** (a séma AIS-35 óta létezik)                                                                         |
| `apps/api/drizzle/meta/0000_snapshot.json`, `meta/_journal.json`                                                                                                                       | generált snapshot + journal (commitolva)                                                                                                                                                  |
| [`apps/api/src/migrate.ts`](../../apps/api/src/migrate.ts)                                                                                                                             | valódi runner: `postgres` kliens (`max: 1`, `onnotice` elnyelve), `drizzle-orm/postgres-js/migrator`, `./drizzle` + `platform.__drizzle_migrations`, `try/finally` `end()`, hiba → exit 1 |
| [`apps/api/src/db/schema.spec.ts`](../../apps/api/src/db/schema.spec.ts)                                                                                                               | új unit teszt: séma/tábla név, 7 oszlop sorrendje, típusok/widthök, nullability, PK, defaultok, enum-értékek egyezése a shared unióval                                                    |
| [`infra/postgres/init/02-schemas.sh`](../../infra/postgres/init/02-schemas.sh), [`01-roles.sh`](../../infra/postgres/init/01-roles.sh)                                                 | **AIS-35 delta:** `GRANT CREATE ON SCHEMA platform` az `aisztens` role-nak (a könyvelő táblához)                                                                                          |
| [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh)                                                                                     | `platform` CREATE assertek + a smoke CREATE query elvárása 2                                                                                                                              |
| [`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh)                                                                                                   | `postgres-schema-create` elvárás 1 → 2                                                                                                                                                    |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md), [`Infrastructure-Docker.md`](../Specs/Infrastructure-Docker.md), [`Local-Development.md`](../Specs/Local-Development.md) | grant-mátrix, §9 „mi van / mi nincs”, verifikációs számok                                                                                                                                 |

## Döntések

- **B) vékony runner** a `migrate.ts`-ben (nem `drizzle-kit migrate`): a `db:migrate` script neve és hívási útja nem változik többet, a lock/timeout Story 3-ban kerül bele.
- **B2) könyvelő tábla a `platform` sémában**: a `callback` marad tiszta domain, és nem keletkezik negyedik (`drizzle`) séma a dokumentált 3-sémás határon kívül. Ehhez kellett a `platform` CREATE grant.
- **Enum** (`callback.call_status`) a `text` + CHECK helyett: a `CallStatus` unió kód-szintű igazsága a DB-be is átkerül; a bővítés (`ALTER TYPE … ADD VALUE`) külön migrációt kap, ezt a `schema.ts` kommentálja.
- **Nincs index** még: a valós lekérdezések (státusz, időrend) az AIS-38-cal ismertek meg.
- **`drizzle.config.ts` nem dob offline**: `db:generate` / `db:check` URL nélkül is fut; ha nincs URL, egy szándékosan használhatatlan sentinel kerül a configba, hogy bármi, ami csatlakozni akar, azonnal és érthetően bukjon el.

## Bizonyíték / verifikáció

```
pnpm --filter @callback/api db:generate   → drizzle/0000_pretty_bromley.sql (1 table, 7 columns)
pnpm --filter @callback/api build         → OK
pnpm --filter @callback/api db:check      → Everything's fine
pnpm --filter @callback/api test          → 10 suites / 75 tests passed (új: schema.spec.ts)
pnpm --filter @callback/api db:migrate    → [db:migrate] migrations applied (bookkeeping: platform.__drizzle_migrations)
pnpm --filter @callback/api db:migrate    → ugyanaz, NO NOTICE; platform.__drizzle_migrations count = 1 (idempotens)
bash scripts/test/_postgres-init-schemas-test.sh → PASS: 29  FAIL: 0
```

DB-oldali ellenőrzés a futó konténeren:

```
\d callback.callback_requests
 id uuid NOT NULL DEFAULT gen_random_uuid()  (PK)
 name varchar(120) / email varchar(254) / phone varchar(20) / reason varchar(1000)  NOT NULL
 status callback.call_status NOT NULL DEFAULT 'queued'
 created_at timestamptz NOT NULL DEFAULT now()

SELECT count(*) FROM callback.callback_requests → 0
INSERT … RETURNING id, status, created_at  → uuid | queued | timestamptz  (majd ROLLBACK)
```

## Megjegyzés a lintről

`pnpm --filter @callback/api lint` **28 pre-existing hibát** jelez, kizárólag a
[`vapi-signature.guard.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts)
és a [`vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts)
fájlokban (`jest` globális típusa nem oldódik fel → `no-unsafe-*`). Ezek nem ehhez
a taskhoz tartoznak és a `HEAD`-en is fennállnak; az AIS-36 fájljai tiszták
(`eslint src/db/*.ts src/migrate.ts` → 0 hiba). Külön takarítási taskot érdemel.

## Következő lépések

- **AIS-38**: repository + a `Map` cseréje; ekkor kell a `DATABASE_URL` az
  `apps/api/.env.local`-ba, és tisztázni kell az `APP_ENV` default (`dev`) vs
  `.env.local` precedenciát, hogy a helyi API ne a dev droplet DB-jére írjon.
- **Story 3**: advisory lock + `lock_timeout` / `statement_timeout` a `migrate.ts`-ben,
  és a migráció futtatása a deploy pipeline-ban.
