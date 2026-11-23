# AIS-14 — the customer data layer (story-level)

**Date:** 2026-11-23 · **Story:** AIS-14 `Admin - cég adatbázis` · **Sub-branch:** `AIS-14-company-admin`
**Subtasks:** AIS-16 (contract) · AIS-17 (screen contract, AIS-15) · AIS-18 (DB) · AIS-177 (ledger) · AIS-178 (API)

## 1. Problem

The admin had no customer master data at all. Every incoming remark ("call back the Szabó company,
they asked about invoicing") had to become a row somewhere, and the tempting shortcut — one `note`
text column on the customer — would have produced a record that cannot be filtered, audited,
attributed or paginated. The story therefore had to deliver a *layer*: schema, contract, API, client
and an audit trail, with the guarantee that no admin screen (AIS-15) can later invent its own truth.

## 2. Design rationale

- **Four schemas, one boundary each**: `platform` (cross-cutting: API keys, migration bookkeeping),
  `customer` (the aggregate: company, contacts, tags), `iam` (our operators, the customers' login
  users), `activity` (the feed) plus `audit` (the ledger). A composite foreign key that includes
  `customer_id` makes a cross-customer reference *impossible*, not merely unlikely.
- **Invariants live in the database** and are classified by constraint name: partial unique indexes
  ("one live tax number"), the `primary` contact slot, the single active `owner` login user, the
  e-mail uniqueness. Each maps to a `409`/`422` catalogue code; an unrecognised `23505` stays a `500`
  on purpose — a fabricated business answer would hide a real bug.
- **The ledger is append-only by construction.** Triggers from `0007` refuse `UPDATE`/`DELETE`/`TRUNCATE`
  even for the table owner, and the module exposes `findPage` only. One transaction = one business
  write + exactly one audit row, written through `AuditWriter`.
- **`updatedAt` is a token, never a field to write.** The client sends back the value it was shown;
  a mismatch is `409 STALE_WRITE`. Activities use `coalesce(updated_at, created_at)` because their
  `updated_at` is `NULL` until the first edit.
- **No `note` column, no billing columns.** Narrative belongs to the activity feed; billing was
  excluded by AIS-16 `D4`/`D9` and is tracked as AIS-176.
- **Rejected alternative:** a per-resource Nest module per child (contacts, tags, users, activities).
  One `CustomersModule` with six feature folders keeps the route prefix, guards and envelope wiring in
  one place while the folders stay independently testable.

## 3. Implementation map

| Layer | Where |
| --- | --- |
| Schema + migrations | `apps/api/src/db/schema.ts`, `apps/api/drizzle/0005`–`0007` |
| Shared contract | `packages/shared/src/contract/customers/*` — 21 registered operations, Zod single source of truth |
| API | `apps/api/src/customers/` — six feature folders (`customers`, `-contacts`, `-tags`, `-users`, `-activities`, `-audit-logs`), one SQL-bearing repository each |
| Audit | `apps/api/src/audit/` — `AuditWriter`, actor provider, immutability triggers |
| Client | `packages/api-client/src/customers/*` + the AIS-110 operation-coverage gate |
| Docs | `API-Convention.md` §4.3/§4.3.1/§12, `Database-Schema.md` (generated), `Customers-Admin-Screens.md` (AIS-17) |

## 4. Evidence (measured 2026-11-23, HEAD of the branch)

| Gate | Result |
| --- | --- |
| `pnpm quality` / `pnpm test:quality` | 0 violations / 124 self-tests |
| `pnpm typecheck` / `pnpm build` | every workspace clean |
| `pnpm test` | **3059** — shared 403 · api-client 296 · notifications 270 · ui 519 · admin 562 · api 1010 |
| `pnpm test:e2e` (real Postgres) | **18 suites / 140 tests** |
| `pnpm db:diagram:check` | generated schema doc up to date |

The gate sweep itself was the most valuable step: it found five defects that unit tests with mocked
`Database` handles could not see — an ambiguous column in the list projection (`42702`, every list
request was a `500`), a derived timestamp arriving as text (`toISOString is not a function`),
`statusChangedAt` written from a second clock, a `Date` bound inside a raw `sql` parameter (which
skips the column encoder), and a 5xx log line that hid the driver's `cause`. All five are fixed, and
two of them left reusable helpers (`qualifiedColumn`, the widened `toNullableIsoString`).

## 5. Outcome and how to verify

```bash
set "PATH=C:\Progs\nodejs;%PATH%"                       # Node >= 24.9 (.node-version: 24.22.2)
set "DATABASE_URL=postgres://postgres:…@localhost:5432/aisztens_db"
pnpm --filter @callback/api db:migrate
cd apps/api && node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --config ./test/jest-e2e.json --runInBand             # 18 suites / 140 tests
```

Before an e2e run, purge the ledger rows the previous run left behind
(`Database-Local.md` §10.1) — the table is append-only, so the `countAuditRows(null, …)` assertions
double otherwise. `--runInBand` is required: with the default worker pool unrelated suites hit jest's
5 s hook timeout on a loaded machine.

## 6. Known limitations

- **The audit actor is `system`.** Until admin authentication lands (AIS-73/74) every ledger row says
  `actor_type = 'system'`; the period cannot be backfilled (decision `D6`).
- **Duplicate `customerNumber` is unit-tested only.** The value is generated from
  `customer.number_counters`, so a collision cannot be triggered through the public API without forging
  a counter row (decision `D3`).
- **No admin UI yet.** Screens are AIS-15 / AIS-179, starting with the customer list (AIS-19).
- **No subscriptions, services or modules** (AIS-176); no committed OpenAPI baseline and drift gate
  (AIS-99).
