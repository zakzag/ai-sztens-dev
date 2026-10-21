# AIS-56 — Újrafelhasználható `DatabaseModule` (implementáció)

**Dátum:** 2026-10-21
**Jira:** AIS-56 (Subtask) — szülő: AIS-29
**Terv:** [`2026-10-21--16-08-00-ais-56-database-module-plan.md`](../plans/2026-10-21--16-08-00-ais-56-database-module-plan.md)
**Milestone:** [`2026-10-21--17-33-30-database-module-boot-policy.milestone.md`](../milestones/2026-10-21--17-33-30-database-module-boot-policy.milestone.md)

## Mit tettünk

| Fájl | Változás |
|---|---|
| [`database.const.ts`](../../apps/api/src/db/database.const.ts) | `DATABASE` + új `DATABASE_CLIENT` token, `DATABASE_POOL_MAX_ENV`, `DEFAULT_DATABASE_POOL_MAX = 10`; JSDoc: ki melyik tokent injektálhatja |
| [`database.factory.ts`](../../apps/api/src/db/database.factory.ts) | **új** — tiszta factory-k: `resolvePoolMax`, `readDatabaseUrl`, `createDatabaseClient`, `createDatabase`; a `postgres` / `drizzle` konstruktor injektálható default paraméter |
| [`database.errors.ts`](../../apps/api/src/db/database.errors.ts) | **új** — `DatabaseConfigurationError` (`variable`, `reason`, doksira mutató üzenet) |
| [`database.providers.ts`](../../apps/api/src/db/database.providers.ts) | **új** — `databaseClientProvider` (`ConfigService` → `Sql`), `databaseProvider` (`DATABASE_CLIENT` → Drizzle handle), `databaseProviders` |
| [`database-lifecycle.service.ts`](../../apps/api/src/db/database-lifecycle.service.ts) | **új** — `OnApplicationShutdown` → `client.end({ timeout: 5 })`, hibát logol, nem dob, idempotens |
| [`database.module.ts`](../../apps/api/src/db/database.module.ts) | **új** — nem `@Global()`, a `DATABASE` és `DATABASE_CLIENT` tokent exportálja |
| [`app.module.ts`](../../apps/api/src/app.module.ts) | `DatabaseModule` import a `ConfigModule` után |
| `src/db/test/mocks/postgres.mock.ts` | **új** — `createSqlClientMock('resolve' | 'reject')` |
| `src/db/test/mocks/config.mock.ts` | **új** — `createEnvSourceMock({ DATABASE_URL, DATABASE_POOL_MAX })` |
| `src/db/database.factory.spec.ts` | **új** — 20 teszt (pool-max, URL, kliens, drizzle, hibák) |
| `src/db/database-lifecycle.service.spec.ts` | **új** — 4 teszt (end egyszer + timeout, idempotencia, hiba elnyelése, nem-`Error` reject) |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) | §9: `DatabaseModule` a „megvan” táblában, boot-politika megjegyzés, fejléc-dátum |
| [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md) | új blokk: a `DATABASE_URL` kötelező az API indulásához |

## As-built eltérés a tervtől

A terv `database.providers.ts`-be tette a factory-kat és két Nest-modul szintű
spec-et írt elő. A megvalósítás során kiderült, hogy **a Jest ESM runner Node 20-on
nem tudja betölteni a `@nestjs/config`-ot** (ugyanaz a korlát, amit a
[`test/lib/app-module-gate.ts`](../../apps/api/test/lib/app-module-gate.ts)
dokumentál az e2e-hez) — a modul-szintű spec-ek ezért `Must use import to load ES
Module` hibával elhasaltak.

Megoldás:

* a tiszta logika átkerült a [`database.factory.ts`](../../apps/api/src/db/database.factory.ts)-be,
  amely csak egy **strukturális** `DatabaseEnvSource { get(key): unknown }`
  interfészt ismer, `@nestjs/config`-ot nem importál → a factory-tesztek minden
  Node-verzión futnak;
* a `database.providers.ts` maradt az egyetlen hely, ami `ConfigService`-t ismer;
* a modul-szintű (DI-gráf + `app.close()`) ellenőrzést a **manuális boot-próba**
  és a `test:e2e` fedi (Node ≥ 24.9-en a valódi `AppModule`-t bootolja).

## Verifikáció

| Parancs / próba | Eredmény |
|---|---|
| `pnpm --filter @callback/api build` | zöld |
| `pnpm --filter @callback/api test` | **11 suite, 100 teszt zöld** (AIS-64 után 74 volt) |
| `pnpm --filter @callback/api test:e2e` | 4 suite, 14 teszt zöld (a boot-specek Node 20-on gate-tel skippelnek) |
| `npx eslint "src/db/**/*.ts"` | **0 hiba** (a repo-szintű 8 pre-existing VAPI hiba érintetlen) |
| boot `APP_ENV=prod`, URL nélkül | `DatabaseConfigurationError: DATABASE_URL is not set or blank…`, exit 1 |
| boot `APP_ENV=prod` + dummy `DATABASE_URL` | `DatabaseModule dependencies initialized`, `/healthz` → **200**, majd `Postgres client closed.` + tiszta leállás |

## Következő lépések

1. **AIS-39** — `platform.api_keys` tábla Drizzle sémában + migráció (a `schema.ts` újra feltöltődik).
2. **AIS-40** — api-keys backend, `DatabaseModule` importtal, `@Inject(DATABASE)` repository.
3. **AIS-57** (AIS-58…AIS-63) → **AIS-41** — frontend alap + első admin oldal.
