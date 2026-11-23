# Milestone — customer activities and the audit-log read (AIS-178/f)

**Date:** 2026-11-23 · **Ticket:** AIS-178 (subtask of AIS-14) · **Plan:**
[`docs/plans/2026-11-23--19-12-00-ais-178-f-activities-and-audit-log-read-plan.md`](../plans/2026-11-23--19-12-00-ais-178-f-activities-and-audit-log-read-plan.md)

## 1. Problem / feature

Every audited mutation had been writing `audit.audit_logs` since AIS-177, but **nothing could read
it**, and there was no way to write a single free-text remark about a customer — `customer.customers`
has no `note` column by design (AIS-16 `D9`), so the activity feed *is* the remark store and it had no
endpoint. Two consequences were visible in the product: `customers.last_activity_at` was `null`
everywhere (so `?sort=lastActivityAt` sorted a value that could never move), and the AIS-14
definition-of-done chain *create → list → detail → activity → ledger row* was not expressible at all.

## 2. Measured data / evidence

- `customer.activities` and `audit.audit_logs` existed with their indexes
  (`activities_customer_created_idx`, `audit_logs_customer_occurred_idx`) and with the append-only
  triggers from `0007_audit_immutability.sql`, which grant `SELECT` on the ledger **precisely so it can
  be read** — a read path was the missing piece, not a schema change.
- The e2e suites that assert the ledger had to `count` rows directly through SQL; no HTTP route existed.
- `activity.activities.updated_at` is **nullable** and has no `$onUpdate`, so any naive `updated_at`
  compare would have rejected the first edit of every entry (found during pre-flight, plan `F4`/`P9`).

## 3. Root cause / design rationale

Not a bug: a deliberate gap left for the last slice. The decisions that shaped the fix:

| # | Decision | Why |
| --- | --- | --- |
| F2 | The ledger **read** lives in the `customers` feature, not in `audit` | `audit` is write-only by its own contract; the list contract belongs to the resource that publishes it |
| F3 | The activity author comes from `AUDIT_ACTOR_PROVIDER` | one seam for "who did it"; AIS-73/74 swaps a binding and both feed and ledger follow |
| F4 | Concurrency token = `updatedAt ?? createdAt`, write sets `updated_at = now` | `updated_at` is nullable ("never edited"), so the first edit needs the creation instant |
| F5 | `DELETE` is a soft delete | the feed and `lastActivityAt` fall back to the previous live entry |
| F6/F7 | No `q` on either list; no `sort` on the feed | the ledger is machine data and the feed has exactly one meaningful order; `q` is *removed* from the schema, not accepted and ignored |
| F8 | `from > to` → `422` with `path: "from"` | shape-valid, content-impossible: not a silent empty page |
| F9 | `occurred_at` + `id` tie-breaker, `id` following the requested direction | `id` is the identity sequence, so in `desc` it *is* the append order |
| F10 | The ledger repository exposes `SELECT` only | a write path from this module cannot even be expressed, and the triggers would refuse it |

## 4. Solution / implementation

Five endpoints, each with its registry entry, controller, service, repository and client method:

`customers.listActivities` · `customers.createActivity` · `customers.updateActivity` ·
`customers.removeActivity` · `customers.listAuditLogs`.

| File(s) | Change |
| --- | --- |
| `packages/shared/src/contract/customers/*` | enum tuple moved to shared (`AUDIT_LOG_TABLE_VALUES`), activity id param, two list schemas, three payload array schemas, five OpenAPI query parameters, two fixtures, five registry entries, exports, registry samples |
| `apps/api/src/customers/customers-activities.*` | const, errors, interface, filter, pure mapper, repository (interface + Drizzle), service, controller |
| `apps/api/src/customers/customers-audit-logs.*` | the same layering, with a **read-only** repository (`customerExists`, `findPage` only) |
| `apps/api/src/customers/customers-json.logic.ts` | one pure `jsonb → Record<string, unknown> | null` narrowing shared by both mappers |
| `apps/api/src/audit/audit.const.ts` | `AUDIT_TABLE_NAMES` re-exports the shared tuple (one list, one type) |
| `apps/api/src/customers/customers.module.ts` | two controllers, two repository tokens |
| `apps/api/src/common/openapi/zod-openapi.ts` (+ spec) | six component names: `Activity`, `ActivityList`, `CreateActivity`, `UpdateActivity`, `AuditLog`, `AuditLogList` |
| `packages/api-client/src/customers/*`, `src/index.ts` | three paths, three builders, five methods |
| specs + mocks | 9 unit specs, 2 mock modules, 2 e2e suites |
| `docs/Specs/API-Convention.md` §12.3, `docs/Specs/Database-Local.md` §10.1 | the contract and the ledger purge recipe |

## 5. Outcome and how to verify

An operator can now record, list, edit (with a token that moves) and soft-delete an activity, and
`customers.lastActivityAt` follows all four; the ledger of a customer is readable with four filters and
a stable order, and remains **unwritable** through the API.

```bash
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test
pnpm --filter @callback/api test
pnpm --filter @callback/api test:e2e -- customer-activity customer-audit-logs
pnpm quality && pnpm typecheck && pnpm build
```

The e2e proof: `test/customer-activity.e2e-spec.ts` (lastActivityAt moves and moves back after the
delete) and `test/customer-audit-logs.e2e-spec.ts` (the DoD chain plus the four filters, `422` for an
inverted window, `400` for an unknown table). Both self-skip on Node < 24.9 through `app-module-gate`;
use `pnpm start` + curl there.

## 6. Follow-ups

- **Admin UI** for the two tabs — AIS-181.
- **Auth** (AIS-73/74): until then every activity and every ledger row says `system`, and that period is
  not backfillable because the ledger is append-only.
- No ledger export, no retention policy, no activity attachments, no `q` search — each is its own ticket.
- `GET /api/admin/tags` (the tag catalogue read deferred in slice `e`) is still open.
