# AIS-37 — Callback requests repository + unit tesztek (terv)

**Jira:** AIS-37 (Subtask) — szülő: AIS-29
**Dátum:** 2026-10-21
**Státusz:** terv, jóváhagyásra vár

## Kiinduló állapot

| Elem | Állapot |
|---|---|
| [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) | kész (AIS-36): `callbackRequests`, `callStatusEnum`, `CallbackRequestRow`, `NewCallbackRequestRow` |
| `apps/api/drizzle/0000_pretty_bromley.sql` | kész, `db:migrate` alkalmazza |
| repository | **nincs** — a `Map` alapú store még a [`callback-requests.service.ts:12`](../../apps/api/src/callback-requests/callback-requests.service.ts:12)-ben él |
| DI a DB-hez | **nincs** (nincs `database.module.ts`, nincs injection token) |
| Jest | `ts-jest` ESM, `rootDir: src`, `testRegex: .*\.spec\.ts$` → a mockoknak a `src` alatt kell lenniük |
| Meglévő séma-teszt | [`schema.spec.ts`](../../apps/api/src/db/schema.spec.ts) — DB nélkül fut, `getTableConfig()`-al |

## Scope

Repository létrehozása (`create`, `findAll`, `findOne`) + teljes unit teszt lefedettség, DB nélkül futó tesztekkel.

**Nem része ennek a tasknak** (AIS-38): a `Map` cseréje, a `CallbackRequestsService` átírása, `database.module.ts` provider bekötése az `AppModule`-be, row → view-model mapper, e2e tesztek.

## Döntések

| # | Döntés | Miért |
|---|---|---|
| D1 | A repository **DB sort** ad vissza (`CallbackRequestRow`), nem shared view-modelt | A `Date → ISO string` mapping a szolgáltatás réteg dolga (AIS-38); a repository ne ismerje a HTTP-szerződést |
| D2 | `findOne` hiányzó id-re **saját hibát dob** (`CallbackRequestNotFoundError`), nem `null`-t ad | A task explicit ezt kéri; a Nest `NotFoundException`-re fordítás AIS-38 feladata, így a `db` réteg framework-független marad |
| D3 | Érvénytelen uuid → `InvalidCallbackRequestIdError`, a DB-hez **nem megy ki query** | Determinisztikus, gyors hiba; a Postgres `22P02` helyett olvasható üzenet |
| D4 | DB hiba **változatlanul továbbterjed** (nincs wrappelés) | A task ezt kéri; a hívó (AIS-38) dönt a leképezésről, a `cause` lánc nem sérül |
| D5 | `findAll` `created_at DESC` rendezéssel | A későbbi admin lista determinisztikus sorrendet vár; az `ORDER BY` a repository szerződése |
| D6 | A DI tokent (`DATABASE`) és a `Database` típust **most** vezetjük be, a Nest modult **nem** | A repository konstruktorának injektálható típusa kell a teszthez; a provider bekötése AIS-38 (addig az app boot DB nélkül is fut) |
| D7 | A mockok `apps/api/src/db/test/mocks/` alatt | A `jest` `rootDir: src`, a `apps/api/test/mocks/` kívül esne; a `.roo` szabály szellemében (feature mellett, nem a tesztfájlban) tartjuk |
| D8 | Nincs valódi DB a tesztekben | Coding standard: mindent mockolunk; a valódi SQL-t a `db:migrate` + AIS-38 e2e bizonyítja |

## Fájlok

| Fájl | Új/mód. | Tartalom |
|---|---|---|
| `apps/api/src/db/database.interface.ts` | új | `export type Database = PostgresJsDatabase<typeof schema>` |
| `apps/api/src/db/database.const.ts` | új | `DATABASE` injekciós token |
| `apps/api/src/db/callback-requests.errors.ts` | új | `CallbackRequestNotFoundError`, `InvalidCallbackRequestIdError`, `CallbackRequestNotPersistedError` (mind `Error` leszármazott, `name` + adatmező) |
| `apps/api/src/db/uuid.ts` | új | `isUuid(value: string): boolean` — tiszta függvény, RFC 4122 `8-4-4-4-12` alak |
| `apps/api/src/db/callback-requests.repository.interface.ts` | új | `CallbackRequestsRepository` interfész (D1–D5 szerződés, JSDoc-kal) |
| `apps/api/src/db/callback-requests.repository.ts` | új | `DrizzleCallbackRequestsRepository implements CallbackRequestsRepository`, `@Injectable()`, `@Inject(DATABASE)` |
| `apps/api/src/db/callback-requests.repository.spec.ts` | új | a lenti tesztmátrix |
| `apps/api/src/db/uuid.spec.ts` | új | határesetek (nil uuid, rossz hossz, nem-hex, üres, SQL-szerű input) |
| `apps/api/src/db/test/mocks/callback-requests.mock.ts` | új | `buildCallbackRequestRow()` fixture-ök + `buildCreateInput()` |
| `apps/api/src/db/test/mocks/database.mock.ts` | új | `createDatabaseMock()` — láncolható `insert/values/returning`, `select/from/where/limit/orderBy` jest mockok, típusosan |

Nem változik: `schema.ts`, `schema.spec.ts`, `callback-requests.service.ts`, `app.module.ts`, `package.json`.

## Tesztmátrix — `callback-requests.repository.spec.ts`

| Metódus | Eset | Elvárás |
|---|---|---|
| `create` | happy path | a bemenet a DB-be megy, a `returning()` sora jön vissza |
| `create` | üres `returning()` | `CallbackRequestNotPersistedError` |
| `create` | DB hiba | a hiba változatlanul elutasítja a promise-t (D4) |
| `findAll` | van sor | a sorok sorrendhelyesen jönnek vissza |
| `findAll` | üres tábla | `[]` |
| `findAll` | DB hiba | továbbterjed |
| `findOne` | létező id | a sor jön vissza |
| `findOne` | nem létező id | `CallbackRequestNotFoundError`, az üzenet tartalmazza az id-t |
| `findOne` | érvénytelen uuid | `InvalidCallbackRequestIdError`, `select` **nem** hívódik (D3) |
| `findOne` | DB hiba | továbbterjed |

Minden teszt a `createDatabaseMock()`-ot használja; nincs `fetch`, nincs socket, nincs `DATABASE_URL`.

## Verifikáció

```bash
pnpm --filter @callback/api test        # minden suite zöld (jelenleg 10 suite / 75 teszt + az újak)
pnpm --filter @callback/api build       # TS strict, ESM importok .js kiterjesztéssel
npx eslint src/db                       # cwd: apps/api — 0 hiba az új fájlokon
```

Megjegyzés: a `pnpm --filter @callback/api lint` a `vapi-signature.guard.spec.ts` /
`vapi-webhooks.e2e-spec.ts` miatt pre-existing hibákat jelez (lásd
[`2026-10-19--23-30-00-ais-36-…`](../history/2026-10-19--23-30-00-ais-36-drizzle-schema-first-migration.md:69)),
ezek nem részei ennek a tasknak.

## Dokumentáció (a change része)

| Fájl | Tartalom |
|---|---|
| `docs/plans/2026-10-21--12-54-00-ais-37-repository-unit-tests-plan.md` | ez a terv |
| `docs/history/2026-10-21--<óó-pp-ss>-ais-37-repository-unit-tests.md` | megvalósítás narratívája + verifikációs kimenet |
| `docs/milestones/2026-10-21--<óó-pp-ss>-callback-requests-repository-contract.milestone.md` | a repository szerződés és a hiba-szemantika döntései (AIS-38 ezekre épít) |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) | §9: repository réteg megvan (unit tesztelt), de az API még a `Map`-et használja; `Utolsó frissítés` bump |

## Kockázatok

| Kockázat | Kezelés |
|---|---|
| A láncolható Drizzle mock törékeny (belső híváslánc) | csak a szerződés-szintű hívásokat assertáljuk, a mock factory egy helyen él |
| A repository később mást ad vissza, mint amit AIS-38 vár | a szerződés JSDoc-ban rögzített (D1–D5), AIS-38 ehhez igazodik |
| Az új teszt neveket a `testRegex` nem találja | `.spec.ts` utótag + `src` alatti elhelyezés (ellenőrizve a `package.json` Jest blokkban) |
