# AIS-178/f — aktivitás-napló írása és az audit-napló olvasása

**Dátum:** 2026-11-23
**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (AIS-14 al-ticket)
**Plan:** [`docs/plans/2026-11-23--19-12-00-ais-178-f-activities-and-audit-log-read-plan.md`](../plans/2026-11-23--19-12-00-ais-178-f-activities-and-audit-log-read-plan.md)
**Előzmény:** [`docs/history/2026-11-23--15-23-00-ais-14-gap-analysis.md`](2026-11-23--15-23-00-ais-14-gap-analysis.md) (M4)

## Mit hozott ez a szelet

Az AIS-178 utolsó darabja: a `customers` gyerek-erőforrásai közül eddig **egyetlen megjegyzést sem
lehetett írni** egy ügyfélhez (nincs `note` oszlop — AIS-16 `D9`), és a napló, amit minden mutáció
írt, **olvashatatlan** volt. Öt végpont készült el, a szerződéstől a kliensig:

| operationId | metódus | út |
| --- | --- | --- |
| `customers.listActivities` | `GET` | `/api/admin/customers/:id/activities` |
| `customers.createActivity` | `POST` | `/api/admin/customers/:id/activities` |
| `customers.updateActivity` | `PATCH` | `/api/admin/customers/:id/activities/:activityId` |
| `customers.removeActivity` | `DELETE` | `/api/admin/customers/:id/activities/:activityId` |
| `customers.listAuditLogs` | `GET` | `/api/admin/customers/:id/audit-logs` |

Ezzel a `customers.lastActivityAt` **elkezd mozogni**, a `?sort=lastActivityAt` végre értelmes, és az
AIS-14 DoD lánca (create → list → detail → activity → naplósor) e2e-ben lefut.

## Döntések, amiket érdemes tudni

- **A szerző sosem a kérésből jön.** A `POST` a `AUDIT_ACTOR_PROVIDER`-ből írja az
  `authorType` / `authorName` / `operatorId` / `customerUserId` négyest; ma ez `system`.

  A body `.strict()`, tehát egy `authorName` mező `400`-at ad — ezt e2e is bizonyítja.
- **A token a `updatedAt ?? createdAt`.** Az `activities.updated_at` nullable ("soha nem szerkesztett"),
  ezért az őr `coalesce(updated_at, created_at) = $token`, és az írás explicit `updated_at = now`-ot
  tesz. Egy sima `updated_at` összehasonlítás az **első** szerkesztést mindig elutasítaná.
- **A napló olvasása a `customers` modulban él**, nem az `audit`-ban: az `audit` modul írás-only maradt,
  a repository-nak **nincs** write metódusa, az `audit.audit_logs`-ot pedig trigger védi (`0007`).
- **Nincs `q`, nincs `sort`** az aktivitás-listában: a feednek egyetlen értelmes sorrendje van
  (`created_at`), a séma ezért *kiveszi* a `q`-t ahelyett hogy elfogadná és eldobná. A naplóban sincs
  szöveges keresés (`jsonb`-fölött nem tudna mit ígérni az index).
- **`from > to` → `422 SEMANTIC_VALIDATION_FAILED`**, `details[0].path = "from"` — alakra helyes,
  tartalmilag lehetetlen kérés nem lesz csendben üres oldal.
- **Az `AUDIT_TABLE_NAMES` egy forrásból jön**: a tuple átkerült a `@callback/shared`-be
  (`AUDIT_LOG_TABLE_VALUES`), mert a napló-olvasás `?tableName=` enumja ugyanez a halmaz.

## Fájlok

**Shared (`packages/shared`)** — `customers.enums.ts` (`AUDIT_LOG_TABLE_VALUES`, `auditLogTableSchema`,
`AuditLogTable`), `customers.const.ts` (`CUSTOMERS_ACTIVITY_ID_PARAM`), `customers.schema.ts`
(`activityIdSchema`, `activityListSchema`, `auditLogListSchema`), `customers.list-query.ts`
(`activityListQuerySchema`, `auditLogListQuerySchema`, öt OpenAPI paraméter, két paraméter-tömb),
`customers.fixture.ts` (`VALID_ACTIVITY_LIST`, `VALID_AUDIT_LOG_LIST`), `customers.contract.ts` (öt
registry entry), `index.ts` (exportok), `test/endpoint-registry.test.ts` (öt sample payload).

**API (`apps/api`)** — új feature-ök: `customers/customers-activities.{const,errors,interface,filter,
mapper,repository.interface,repository,service,controller}.ts` és
`customers/customers-audit-logs.{const,interface,filter,mapper,repository.interface,repository,service,
controller}.ts`, plusz a közös `customers/customers-json.logic.ts` (a `jsonb` → `Record | null`
szűkítés, amit mindkét mapper használ). Módosult: `audit/audit.const.ts` (a tuple újraexportálása),
`customers/customers.module.ts` (2 controller + 2 repository token), `common/openapi/zod-openapi.ts`
(hat komponens-név). Tesztek: 9 új spec + 2 mock fájl + 2 e2e suite.

**Kliens (`packages/api-client`)** — `customers.const.ts` (három path a registry-ből),
`customers.path.ts` (`toCustomerActivitiesPath`, `toCustomerActivityPath`, `toCustomerAuditLogsPath`),
`customers.interface.ts` / `.service.ts` (öt metódus), `index.ts` (exportok), `test/mocks/customer.mock.ts`
(fixture-ök), `test/customers.service.test.ts` (új tesztek).

**Dokumentáció** — `docs/Specs/API-Convention.md` §12.3 + a §13 kiegészítése,
`docs/Specs/Database-Local.md` §10.1 (a napló-sorok takarítási receptje e2e után), ez a bejegyzés és a
hozzá tartozó milestone.

## Hogyan ellenőrizhető

```bash
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test          # service-coverage gate is
pnpm --filter @callback/api test
pnpm --filter @callback/api test:e2e -- customer-activity customer-audit-logs
pnpm quality
```

A két e2e suite Node < 24.9 alatt az `app-module-gate` miatt magát kihagyja (a `@nestjs/config`
CommonJS-only), ilyenkor `pnpm start` + curl a kézi ellenőrzés; a napló sorai a suite fix
`user-agent`-jével azonosíthatók, a takarítás pedig a `Database-Local.md` §10.1 szerint megy.

## Ami szándékosan kimaradt

Az admin **felület** (`activity` és `Napló` fül) az AIS-181 dolga; a naplónak nincs exportja, nincs
undelete/purge job, nincs `q` keresés és nincs csatolmány — ezek külön ticketek. A `GET /api/admin/tags`
katalógus-olvasás továbbra is nyitott (slice `e` follow-up).
