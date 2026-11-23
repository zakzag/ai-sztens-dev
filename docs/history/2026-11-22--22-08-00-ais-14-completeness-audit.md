# AIS-14 completeness audit — is the customer data layer done?

**Date:** 2026-11-22 22:08 (Europe/Budapest)
**Ticket:** AIS-14 `Admin - cég adatbázis` (Story) · subtasks AIS-16, AIS-18, AIS-177, AIS-178
**Branch:** `AIS-14-company-admin` (HEAD `43ad31c`)
**Type:** audit (read-only; no code was changed)

## Why this entry exists

The question was whether AIS-14 — including every subtask — is finished. Jira reports the story and
all four subtasks as `To Do`, which is clearly behind the repository (three of the four landed in
commits). The audit therefore compares the Jira state, the story DoD and the actual code, and records
the one place where the repository and the board agree: **AIS-178 is not complete**, and the working
tree is currently red because of it.

## Verdict

| Ticket | Jira status | Code state | Verdict |
| ------ | ----------- | ---------- | ------- |
| **AIS-14** | `To Do` | — | **NOT DONE** |
| AIS-16 (contract schemas + decisions) | `To Do` | `packages/shared/src/contract/customers/` complete, `O1` row in `Functional-Specification.md` | **Done** (status stale) |
| AIS-18 (`customer` + `iam` schemas) | `To Do` | `schema.ts`, migration `0005`, `0007`-independent grants, `Database-Local.md`, `schema.spec.ts` | **Done** (status stale) |
| AIS-177 (`activity` + `audit` + `AuditWriter`) | `To Do` | `activity`/`audit` tables, trigger migration `0007_audit_immutability.sql`, `apps/api/src/audit/**` with 10 spec files | **Done** (status stale) |
| AIS-178 (`customers` API + client service) | `To Do` | only the **contract slice**: `customers.contract.ts` (6 operations) + conflict error codes | **IN PROGRESS — 1 of ~6 slices** |

## Evidence

| Check | Command / location | Result |
| ----- | ------------------ | ------ |
| Registry ⇄ service coverage gate (AIS-110) | `pnpm --filter @callback/api-client test service-coverage` | **FAIL** — `customers.list`, `findById`, `create`, `update`, `updateStatus`, `remove` have `reason: "missing-service"`; `createServiceFactories()` knows only `apiKeys` |
| Migration consistency | `pnpm --filter @callback/api db:check` | PASS — `Everything's fine` |
| `customers` API module | `apps/api/src/` | **missing** — no `customers/` directory, no controller, service or repository; `AppModule` imports only `ApiKeysModule` + `VapiWebhooksModule` |
| `customers` client service | `packages/api-client/src/` | **missing** — no `customers/` folder, `service.registry.ts` has one line (`apiKeys`) |
| Audit wiring | `apps/api/src/audit/` | Module + `AUDIT_WRITER` token exist, but `AuditModule` is **not** imported by `AppModule` (intentional: AIS-177 ships the seam, AIS-178 the call sites) |
| Migration files | `apps/api/drizzle/` | `0005_colossal_hobgoblin.sql` (AIS-18), `0006_magenta_chameleon.sql` + `0007_audit_immutability.sql` (AIS-177), snapshots committed |
| Working tree | `git status --short` | clean apart from two untracked `docs/temp/*` mockup files |

## Story DoD review

| AIS-14 DoD item | State |
| --------------- | ----- |
| `GET/POST/PATCH/DELETE /api/admin/customers` paged, 404/409/422 semantics | **missing** (AIS-178) |
| Contract schemas reuse the AIS-112 format schemas | **done** — `emailSchema`, `huPostalCodeSchema`, `huTaxNumberSchema`, `phoneSchema` imported by `customers.schema.ts` |
| Client service matches the registry operations (coverage test green) | **red** — see above |
| `customer`, `iam`, `activity`, `audit` schemas with the planned tables/indexes; no `note`/billing/subscription column | **done** (AIS-18 + AIS-177) |
| Every write produces exactly one `audit_logs` row; `UPDATE`/`DELETE` blocked in the DB | trigger **done**, “every write” **impossible** until AIS-178 exists |
| `409` cases tested (tax number, customer number, second `owner`, second `primary`) | **missing** (AIS-178) |
| Unit tests: repository, service, mapper, `AuditWriter`; e2e create → list → detail → activity → audit | only `AuditWriter` (+ audit repository/logic) exist; the rest is AIS-178 |
| `docs/Specs/API-Convention.md` and `Database-Local.md` updated | `Database-Local.md` done; `API-Convention.md` documents the list filters and the audit rule, but cannot document endpoints that do not exist yet |
| `pnpm test`, `pnpm lint`, `pnpm -r build` green | **red** at HEAD (coverage gate) |

## Why HEAD is red

Commit `c9754dc AIS-178: feat(shared): add customers contract and conflict codes` registered six
`customers.*` operation ids in `API_ENDPOINTS` **before** the client service and the controller
exist. The AIS-110 gate is bidirectional on purpose: a registry entry without a service method is a
documented operation nobody can call. The contract file itself is correct and its header says the
child resources land in the later slices — but the slice boundary crosses a package gate, so the
repository stays red until the AIS-178 API slice closes it.

Two ways out, both honest:

1. **Finish the slice** — add `packages/api-client/src/customers/` (service + interface + const) with
   the six methods, and a Nest `CustomersModule` wired into `AppModule`. This is the intended path.
2. **Defer the registry entries** — move `CUSTOMERS_ENDPOINTS` back behind the API slice; the AIS-16
   decision record (`D-C`) originally predicted that. Cheaper, but it throws away a correct contract.

## What remains in AIS-178

The plan ([`2026-11-22--18-50-00-ais-178-customers-api-plan.md`](../plans/2026-11-22--18-50-00-ais-178-customers-api-plan.md))
splits the ticket by resource so each slice keeps the gates green:

| Slice | Content |
| ----- | ------- |
| a ✅ | `customers` contract: list / findById / create / update / updateStatus / remove + conflict codes |
| b | `apps/api/src/customers/` — Drizzle repository, service, controller, `customer_number` generator, `AuditWriter` call sites |
| c | `packages/api-client/src/customers/` service + `service.registry.ts` line (closes the red gate) |
| d | Contacts + roles CRUD (including the AIS-18 rule: deleting a contact deletes its `contact_roles` rows) |
| e | Tags + customer users (invite flow) |
| f | Activities + `GET /:id/audit-logs`, then the e2e chain create → list → detail → activity → audit |

## Recommendations

- Mark **AIS-16, AIS-18, AIS-177** as `Done` (their DoD is satisfied and their history + milestone docs exist).
- Keep **AIS-14** and **AIS-178** open; AIS-178 is the only blocker left.
- Restore a green gate before starting the next slice (option 1 or 2 above).
- Do not start the AIS-15 UI tickets yet: their five implementation subtasks are blocked on the
  `customers.*` client service, per the screen contract `D9` (`primaryContactName` projection).
- The AIS-14 milestone (`docs/milestones/<ts>-ais-14-customer-data-layer.milestone.md`, English) is
  due **after** AIS-178 lands — it is correctly absent today.
