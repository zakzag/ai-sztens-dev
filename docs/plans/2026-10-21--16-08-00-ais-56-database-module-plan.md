# AIS-56 — Újrafelhasználható `DatabaseModule` (terv)

**Jira:** AIS-56 (Subtask) — szülő: AIS-29
**Dátum:** 2026-10-21
**Státusz:** jóváhagyásra vár
**Előzmény:** AIS-64 (a callback kontextus törlése) — a `Database` típus és a `DATABASE` token megvan, de **nincs hozzá provider**

## 1. Kiinduló állapot

| Elem | Állapot |
|---|---|
| [`database.const.ts`](../../apps/api/src/db/database.const.ts:10) | `DATABASE = 'DRIZZLE_DATABASE'` token — **nincs provider** hozzá |
| [`database.interface.ts`](../../apps/api/src/db/database.interface.ts:16) | `export type Database = PostgresJsDatabase<typeof schema>` |
| [`schema.ts`](../../apps/api/src/db/schema.ts:1) | szándékosan üres (AIS-64 után); AIS-39 tölti fel `platform.apiKeys`-szel |
| [`database-url.ts`](../../apps/api/src/db/database-url.ts:1) | URL-feloldás CLI-eszközöknek (`drizzle-kit`, `migrate.ts`) — az **API** ezt nem használja |
| [`app.module.ts`](../../apps/api/src/app.module.ts:33) | `ConfigModule.forRoot({ isGlobal: true })` — a per-env fájlokat ez tölti |
| [`migrate.ts`](../../apps/api/src/migrate.ts:31) | referenciaminta: `postgres(url, { max: 1, onnotice })` → `drizzle(client)` → `client.end({ timeout: 5 })` |
| Tesztek | Jest ESM + `ts-jest`, `rootDir: src`, mockok `src/**/test/mocks/` alatt, `@jest/globals` import |

## 2. Scope

NestJS modul, amely a `DATABASE` tokenhez egy **schema-aware Drizzle handle**-t ad, a
`DATABASE_URL`-t a `ConfigService`-ből olvassa, hangosan elhasal, ha az URL hiányzik, és
leállításkor lezárja a klienst. **Nincs** repository, nincs tábla, nincs HTTP végpont.

**Nem scope:** `platform.api_keys` séma/migráció (AIS-39), api-keys modul (AIS-40),
migrációs lock / deploy-pipeline futtatás (AIS-43/AIS-46).

## 3. Döntések

| # | Döntés | Miért |
|---|---|---|
| D1 | **Két token:** `DATABASE` (Drizzle handle) + `DATABASE_CLIENT` (`postgres.Sql` kliens) | A lezáráshoz a nyers kliens kell (`client.end()`); a Drizzle handle nem ad erre API-t. A repository csak a `DATABASE`-ot látja |
| D2 | A modul **nem** `@Global()` — exportálja a providereket, a fogyasztó importálja | Elrejtett globális függőség helyett explicit import; a coding standard is ezt kéri |
| D3 | Az URL forrása a **`ConfigService`**, nem a `process.env` | `ConfigModule.forRoot({ isGlobal: true })` már betölti a per-env fájlokat; így a `database-url.ts` CLI-logikája nem duplikálódik az appban |
| D4 | Hiányzó/üres `DATABASE_URL` → `DatabaseConfigurationError` **a factory-ban**, azaz boot hiba | A ticket kifejezetten hangos hibát kér; csendes in-memory fallback nincs (ez volt az AIS-64 előtti állapot problémája) |
| D5 | A kapcsolat **lusta** (postgres.js default): bootkor csak a konfigurációt validáljuk, socketet nem nyitunk | A konténer akkor is elindul, ha a Postgres pár másodpercig még nem fogad; az első query hibázik, nem a boot akad végtelenül |
| D6 | Pool: `max = DATABASE_POOL_MAX` (default **10**), érvénytelen értékre default; `onnotice` némítva | A migrátor mintáját követi; a NOTICE-ok a normál futást hibának láttatnák |
| D7 | Lezárás `OnApplicationShutdown`-ben, `client.end({ timeout: 5 })`; hiba **logolva**, nem dobva | Leállás közben nem szabad a processzt hibával kilőni; a `timeout` megakadályozza a lógó leállást |
| D8 | Az e2e/boot tesztek `overrideProvider(DATABASE)` / `overrideProvider(DATABASE_CLIENT)`-tel futnak | A `Test.createTestingModule().overrideProvider()` lecseréli a providert, így a factory (és vele az URL-check) nem fut le — teszthez nem kell `DATABASE_URL` |
| D9 | `drizzle(client, { schema })` (nem `drizzle(client)`) | Csak így marad a `Database` típus pontosan `PostgresJsDatabase<typeof schema>`, ami az AIS-39-től schema-aware `select().from(...)` overloadokat ad |

## 4. Fájlok

| Fájl | Új/mód. | Tartalom |
|---|---|---|
| [`apps/api/src/db/database.const.ts`](../../apps/api/src/db/database.const.ts:1) | mód | `DATABASE_CLIENT` token + `DATABASE_POOL_MAX` env-név + `DEFAULT_DATABASE_POOL_MAX = 10` |
| `apps/api/src/db/database.errors.ts` | új | `DatabaseConfigurationError extends Error` (`name`, actionable message) |
| `apps/api/src/db/database.providers.ts` | új | `createDatabaseClient(config): Sql`, `createDatabase(client): Database`, `resolvePoolMax(raw): number`, `databaseProviders` tömb |
| `apps/api/src/db/database-lifecycle.service.ts` | új | `@Injectable() class DatabaseLifecycleService implements OnApplicationShutdown` — `client.end({ timeout: 5 })`, `Logger` |
| `apps/api/src/db/database.module.ts` | új | `@Module({ providers: [...databaseProviders, DatabaseLifecycleService], exports: [DATABASE, DATABASE_CLIENT] })` |
| [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts:33) | mód | `DatabaseModule` importálása a `ConfigModule` után |
| `apps/api/src/db/database.providers.spec.ts` | új | factory + pool-max tesztek (lásd 5.) |
| `apps/api/src/db/database.module.spec.ts` | új | modul-feloldás + shutdown teszt |
| `apps/api/src/db/test/mocks/postgres.mock.ts` | új | `createPostgresMock()`: `postgres()` factory spy + `end` mock + scriptelhető hibák |
| `apps/api/src/db/test/mocks/config.mock.ts` | új | `createConfigServiceMock({ DATABASE_URL?, DATABASE_POOL_MAX? })` |

Nem változik: `schema.ts`, `database.interface.ts`, `database-url.ts`, `migrate.ts`, a migrációk.

## 5. Tesztmátrix

| Fájl | Eset | Elvárás |
|---|---|---|
| `database.providers.spec.ts` | érvényes URL | `postgres(url, { max: 10, onnotice })` hívódik; a visszaadott érték a `drizzle` eredménye |
| | hiányzó URL | `DatabaseConfigurationError`, üzenetben `DATABASE_URL` + `docs/Specs/Database-Local.md` hivatkozás |
| | üres / whitespace URL | ugyanaz a hiba |
| | `DATABASE_URL` szóközökkel | trim-elve kerül a kliensbe |
| | `DATABASE_POOL_MAX` = `25` | `max: 25` |
| | `DATABASE_POOL_MAX` hiányzik | `max: 10` |
| | `DATABASE_POOL_MAX` = `abc` / `0` / `-3` | `max: 10` (defenzív default, nem dob) |
| `database.module.spec.ts` | modul fordul | `DATABASE` és `DATABASE_CLIENT` feloldható |
| | `app.close()` | `client.end` **egyszer** hívódik, `{ timeout: 5 }`-tel |
| | `end` elutasít | a hiba logolva, a `close()` **nem** dob |
| | URL nélkül | a modul létrehozása `DatabaseConfigurationError`-ral bukik |

Minden teszt mockolt `postgres`-szel — nincs socket, nincs `DATABASE_URL`, nincs Docker.

## 6. Lépések

1. Tokenek + hibásztály + pool-max helper.
2. `database.providers.ts` factory-k (`postgres` import egy helyen).
3. `DatabaseLifecycleService` (shutdown).
4. `database.module.ts` + bekötés az [`app.module.ts`](../../apps/api/src/app.module.ts)-be.
5. Mockok a `src/db/test/mocks/` alá, majd a két spec.
6. Dokumentáció: [`Database-Local.md`](../Specs/Database-Local.md) §9 (DatabaseModule megvan, AIS-38 cancelled), `Utolsó frissítés` bump; [`Local-Development.md`](../Specs/Local-Development.md) megjegyzés.
7. `docs/history/` bejegyzés (+ milestone, ha a boot-viselkedés döntései indokolják — igen: boot-fail politikát rögzít).

## 7. Verifikáció

```bash
pnpm --filter @callback/api test          # új spec-ek + a meglévő 74 teszt
pnpm --filter @callback/api build
pnpm --filter @callback/api test:e2e      # AppModule boot (Node >= 24.9; alatta skip)
pnpm --filter @callback/api lint
```

Manuális boot-próba:

```bash
# 1) URL nélkül → hangos hiba, nem csendes indulás
cd apps/api && DATABASE_URL= node dist/main.js
# Elvárt: DatabaseConfigurationError, non-zero exit

# 2) URL-lel (a lokális Postgres fut) → indul
cd apps/api && node dist/main.js
# Elvárt: "API up — APP_ENV=... " banner, /healthz 200
```

## 8. Kockázatok

| Kockázat | Kezelés |
|---|---|
| Az API mostantól `DATABASE_URL` nélkül **nem indul** | Ez a kért viselkedés (D4); a compose és a `.env.local` már tartalmazza; a hibaüzenet a doksira mutat |
| Az `app-boot.e2e-spec` / `app.e2e-spec` a valódi `AppModule`-t bootolja | D8: `overrideProvider` a tesztben; lokálisan a `.env.local` miatt amúgy is van URL, CI-ben e2e nem fut |
| A `schema.ts` üres → a `drizzle(client, { schema })` típusa `PostgresJsDatabase<{}>` | Szándékos: AIS-39 tölti fel; a `select().from()` csak tábla után használható, addig nincs fogyasztó |
| Két token félreköthető (ki mit injektál) | A repository-k csak a `DATABASE`-ot injektálják; a `DATABASE_CLIENT`-et kizárólag a lifecycle service használja (JSDoc-ban rögzítve) |
| Pool méret elszállítása a 2 GB-os droplet-en | Default 10 + env-felülírás; a Postgres `max_connections`-éhez képest bőven alatta marad |
