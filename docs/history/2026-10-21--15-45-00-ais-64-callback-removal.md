# AIS-64 — Callback funkció teljes eltávolítása (implementáció)

**Dátum:** 2026-10-21
**Jira:** AIS-64 (Story) — subtaskok: AIS-65 (API), AIS-66 (DB), AIS-67 (admin), AIS-68 (docs), AIS-69 (web + shared)
**Terv:** [`2026-10-21--15-37-00-ais-64-callback-removal-plan.md`](../plans/2026-10-21--15-37-00-ais-64-callback-removal-plan.md)
**Eredmény:** a callback kontextus teljesen megszűnt (API, DB, admin, web, shared, élő docs)

## Mit tettünk

### API (AIS-65)
Törölve: `apps/api/src/callback-requests/` (controller, service, module, DTO, spec),
`apps/api/src/db/callback-requests.{repository,repository.interface,errors,repository.spec}.ts`,
`schema.spec.ts`, `db/test/mocks/callback-requests.mock.ts`, `db/test/mocks/database.mock.ts`.

Módosítva: [`schema.ts`](../../apps/api/src/db/schema.ts) (üres séma, magyarázó fejléccel),
[`app.module.ts`](../../apps/api/src/app.module.ts) (modul-regisztráció ki),
[`main.ts`](../../apps/api/src/main.ts) (kommentpélda), [`database.interface.ts`](../../apps/api/src/db/database.interface.ts)
(komment), [`vapi-webhooks.service.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.service.ts)
(a megszűnt `CallbackRequestsService`-re mutató komment).

### Adatbázis (AIS-66)
- Új migráció: [`drizzle/0001_square_kat_farrell.sql`](../../apps/api/drizzle/0001_square_kat_farrell.sql)
  (`DROP TABLE "callback"."callback_requests" CASCADE`, `DROP TYPE "callback"."call_status"`) + `meta/0001_snapshot.json` + `_journal.json`.
- [`01-roles.sh`](../../infra/postgres/init/01-roles.sh) és [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh):
  a `callback` séma kikerült a létrehozásból és a grant-mátrixból (2 séma, CREATE csak `platform`-on).
- Smoke tesztek: [`_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh)
  (3→2 séma, 9→6 USAGE, 2→1 CREATE), [`20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh) ugyanígy.

### Admin (AIS-67)
Törölve: `apps/admin/src/lib/api.ts`, `DashboardPage.tsx`. Új:
[`PlaceholderPage.tsx`](../../apps/admin/src/pages/PlaceholderPage.tsx) a `/` route-on,
a „Kérések” nav link kikerült, a session-kulcs `aisztens-admin-token`-re nevezve.

### Web + shared (AIS-69)
Törölve: `CallbackFormPage.tsx`, `ThankYouPage.tsx`, `apps/web/src/lib/api.ts`,
`packages/shared/src/schemas/callback-request.schema.ts`, `packages/shared/src/types/callback-request.ts`;
a `/callback` és `/thank-you` route, a „Visszahívást kérek” CTA-k, valamint a
`react-hook-form` / `@hookform/resolvers` / `zod` függőségek a web csomagból.

### Dokumentáció (AIS-68)
`Three-Env-Verification.md` (a `/api/callback-requests` próbák helyett `/healthz`,
§2.7 és a fejléc megjegyzés), `Database-Local.md` §9 + fejléc, `Infrastructure-Docker.md`
§6.2 grant-mátrix, `Local-Development.md`, `Production-Runbook.md` §7 + fejléc.

## As-built eltérés a tervtől (fontos)

A terv D3 szerint a migráció végén `DROP SCHEMA IF EXISTS callback CASCADE` szerepelt.
**Ez nem működik:** a séma tulajdonosa a bootstrap superuser (`POSTGRES_USER`), az
`aisztens` app role csak `USAGE + CREATE` jogot kapott, így a `DROP SCHEMA` `permission
denied`-nel elhasalt (a drizzle tranzakcióban visszagurította a teljes 0001-et).

Megoldás: a migráció csak a táblát és az enumot dobja el; a megmaradt (üres) sémát
meglévő volume-on **egyszeri superuser lépés** viszi el:

```bash
docker exec infra-postgres-1 psql -U postgres -d aisztens_db -c "DROP SCHEMA IF EXISTS callback"
```

Friss volume-on nincs teendő: a `02-schemas.sh` már csak `platform`-ot és `email`-t hoz létre.

## Verifikáció

| Parancs | Eredmény |
|---|---|
| `pnpm --filter @callback/api db:generate` | `drizzle/0001_square_kat_farrell.sql` létrejött |
| `pnpm --filter @callback/api db:migrate` | OK — `platform.__drizzle_migrations` = 2 sor |
| DB állapot | `pg_namespace`: `email`, `platform`; `to_regclass('callback.callback_requests')` → null |
| `pnpm --filter @callback/shared build` / `api build` / `web build` / `admin build` | mind zöld |
| `pnpm test` | shared 10, api 74 teszt zöld |
| `pnpm lint` | **8 pre-existing hiba** a `vapi-signature.guard.spec.ts` / `vapi-webhooks.e2e-spec.ts` fájlokban (`jest` globális típus) — nem ehhez a taskhoz tartozik, a HEAD-en is fennáll |
| `rg -i callback apps/*/src packages/shared/src` | csak `@callback/*` csomagnév és szándékos történeti komment találat |
| `bash scripts/test/_postgres-init-schemas-test.sh` | **PASS: 23  FAIL: 0** (friss init + kétszeri újrafuttatás, 2 séma / 6 USAGE / 1 CREATE) |

Nem futott le: `pnpm test:stack` (a teljes compose-stack image-eit kellene felépíteni;
a várt értékek 2/6/1-re frissítve, a logika a throwaway-konténeres teszttel igazolva).

## Következő lépések

1. AIS-56 — `DatabaseModule` (`DATABASE` provider + lifecycle), erre épül minden.
2. AIS-39/40 — `platform.api_keys` tábla + backend.
3. AIS-57 (AIS-58…AIS-63) — frontend alap `api-keys` mintával, majd AIS-41.
