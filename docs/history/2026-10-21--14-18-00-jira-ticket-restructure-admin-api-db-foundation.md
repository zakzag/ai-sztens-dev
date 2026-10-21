# Jira ticket restructure — admin ↔ API ↔ DB alap

**Dátum:** 2026-10-21
**Típus:** Jira ticket-struktúra rendezés (terv + ticketek létrehozása)
**Terv:** [`2026-10-21--14-13-00-admin-api-db-foundation-tickets-plan.md`](../plans/2026-10-21--14-13-00-admin-api-db-foundation-tickets-plan.md)

## Mi történt

Felmérésre került, hogy mi hiányzik ahhoz, hogy az admin app DB-ig érő oldalakat lehessen fejleszteni,
majd a hiányzó részekhez a Jirába a következő ticketek készültek (a terv jóváhagyása után):

| Ticket | Típus | Szülő | Tartalom |
|---|---|---|---|
| AIS-56 | Subtask | AIS-29 | Újrafelhasználható `DatabaseModule` (`DATABASE` provider + connection lifecycle) |
| AIS-57 | Story | AIS-1 | Admin: fejlesztői alap a DB-t elérő admin oldalakhoz (api-client, UI kit, teszt harness) |
| AIS-58 | Subtask | AIS-57 | Megosztott response sémák a `packages/shared`-ben |
| AIS-59 | Subtask | AIS-57 | `packages/api-client` csomag (http-client, ApiError, service + interfész) |
| AIS-60 | Subtask | AIS-57 | Admin feature hook minta (use-callback-requests + query keys) |
| AIS-61 | Subtask | AIS-57 | `packages/ui` token primitívek (Button, Input, Card, Table, Badge, Alert) |
| AIS-62 | Subtask | AIS-57 | Admin tooling: vitest + RTL, test/mocks, eslint, valódi test/lint scriptek |
| AIS-63 | Subtask | AIS-57 | `docs/Specs/UI-Architecture.md` létrehozása |

Módosítva: **AIS-41** leírása — a „meglévő `apps/admin/src/lib/api.ts`-n keresztül” minta helyett
a `packages/api-client` service + `features/` hook + `packages/ui` primitívek használata, függőséggel
az AIS-57 storyra.

## Döntések

- A frontend-alap **nem** került bele AIS-30-ba (az a kicsi, másolható vertikális példa) és AIS-29-be
  (az DB-scope-ú) sem — új storyként jött létre AIS-57 néven.
- A `DatabaseModule` AIS-29 alá került, mert szerver-oldali perzisztencia-infra; így AIS-40 nem duplikálja.
- Az admin auth **tudatosan kimaradt** (user döntés: később); az api-client viszont opcionális
  `getToken()` injection pointot kap, hogy az auth később one-liner legyen.

## Következmények / sorrend

```
AIS-37 → AIS-38 + AIS-56 → AIS-39 → AIS-40
AIS-57 (AIS-58..AIS-63) → AIS-41
```
