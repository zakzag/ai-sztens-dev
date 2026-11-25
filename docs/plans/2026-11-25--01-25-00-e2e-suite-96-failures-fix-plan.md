# E2E suite: 96 failing tests — diagnosis and fix plan

**Status:** implemented on 2026-11-25 — see
[`docs/history/2026-11-25--01-55-00-e2e-suite-96-failures-fix.md`](../history/2026-11-25--01-55-00-e2e-suite-96-failures-fix.md)
**Created:** 2026-11-25 01:25 (Europe/Budapest)
**Scope:** [`apps/api`](../../apps/api/package.json:1) e2e suites, Jest config, customer number allocation, audit-count assertions
**Command under investigation:** `pnpm test:e2e` → `pnpm --filter @callback/api test:e2e`

---

## 1. Symptom

On a developer machine (and in CI, which uses Node 24) the API e2e run reports:

```text
Test Suites: 9 failed, 9 passed, 18 total
Tests:       96 failed, 44 passed, 140 total
```

On this project's default IDE shell — which happens to run **Node 20.19.2** — the same
command reports `18 passed, 140 passed`, because every suite that needs the real
`AppModule` self-skips. That difference is the reason the failure looked invisible for
a while: the green run was a **fully skipped** run, not a passing one.

---

## 2. Evidence

| Observation                         | Value                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Node version in the failing run     | `v24.22.2` (fnm default; CI uses `node-version: 24`)                                                             |
| Node version in the "green" run     | `v20.19.2` (WebStorm-bundled Node first on `PATH`)                                                               |
| Failure type in the 96 failures     | **192 ×** `Exceeded timeout of 5000 ms` (each failure repeats it in the `Cause:` block)                          |
| Assertion failures among the 96     | **0** — no `Expected:` / `Received:` lines in that run                                                           |
| Single suite, `--testTimeout=60000` | `health.e2e-spec.ts` passes; first test (which boots the app) takes **3525 ms**                                  |
| Full suite, `--testTimeout=60000`   | `128 passed, 12 failed` in 2 suites; wall clock **9 s**                                                          |
| Failing hook example                | [`customer-users.e2e-spec.ts:98`](../../apps/api/test/customer-users.e2e-spec.ts:98) — `beforeAll` → `bootApp()` |
| Failing test example                | [`openapi.e2e-spec.ts:36`](../../apps/api/test/openapi.e2e-spec.ts:36) — test body calls `loadAppModuleOrSkip()` |

The app-module gate explains the version split:

- [`apps/api/test/lib/app-module-gate.ts:36`](../../apps/api/test/lib/app-module-gate.ts:36)
  requires Node `>= 24.9` before it will `import('../../src/app.module.js')`; below that it
  warns and returns `null`, and every suite returns early (a _loud skip_, by design).

So on Node 20 the e2e run proves nothing; on Node 24 it bootstraps the real Nest
application in **18 parallel Jest workers**.

---

## 3. Root causes

### R1 — Jest's 5 s default timeout is too small for a parallel Nest bootstrap (P0, 96 failures)

Every app-module suite boots the whole application inside the test/hook:

- dynamic `import()` of `../../src/app.module.js` → ts-jest has to transform the **entire**
  application graph (~200 modules) inside that worker at that moment (no prior transform);
- `Test.createTestingModule({ imports: [AppModule] }).compile()`;
- `createNestApplication(...)` + `app.init()` — which builds the OpenAPI document, the
  Swagger UI, the response validator and the DB module.

Measured cost of that sequence: **~3.5 s on an idle machine**. With 18 workers doing it at
the same time on the same CPU budget, the same work exceeds **5 s**, so `beforeAll` and the
first test time out. No assertion ever runs — hence 96 timeouts and zero assertion failures.

### R2 — Customer-number allocation is a `MAX()+1` race with a single retry (P0, 10 of the 12 residual failures)

Behind the timeout, with 60 s allowed, `customer-audit-logs.e2e-spec.ts` fails like this:

```text
● the DoD chain: create the customer, then add an activity
  expect(received).toBe(expected)
  Expected: 201
  Received: 409
```

The POST body carries only `type` and `legalName`, so the only 409 that can be produced is
`CUSTOMER_NUMBER_CONFLICT` (the tax-number conflict needs a `taxNumber`). The allocation is:

1. [`customers.repository.ts:363`](../../apps/api/src/customers/customers.repository.ts:363) —
   `select max(customer_number) where customer_number like 'AIS-YYYYMM-%'` **inside** the write transaction;
2. `toNextCustomerNumber(prefix, max)` → `…-001`, `…-002`, …;
3. insert; a `23505` on `customers_customer_number_key` aborts the Postgres transaction, so
   [`customers.service.ts:148`](../../apps/api/src/customers/customers.service.ts:148) retries
   in a **fresh** transaction.

`CREATE_ATTEMPTS = 2` ([`customers.const.ts:62`](../../apps/api/src/customers/customers.const.ts:62)),
i.e. exactly **one** retry. With 6–8 customer suites creating rows simultaneously on the same
month prefix, two consecutive collisions are routine. The constant's own docblock names the
correct fix and records that it was not built:

> A `pg_advisory_xact_lock` per month would remove collisions entirely and is documented as
> the alternative, not built.

Measured state confirming the race conditions are real: `customer.customers` was **empty**
after the run while `audit.audit_logs` held **17** `customers/insert` rows — each suite deletes
its own rows in `afterAll`, so every parallel create starts from `MAX = NULL` and races for
`-001`.

### R3 — `countAuditRows(null, …)` aggregates across runs and suites (P1, 2 of the 12 residual failures)

[`customer-contacts.e2e-spec.ts:136`](../../apps/api/test/customer-contacts.e2e-spec.ts:136)
builds its ledger filter as:

```ts
and(
  recordId === null
    ? eq(auditLogs.tableName, tableName) // no record filter at all
    : eq(auditLogs.recordId, recordId),
  eq(auditLogs.tableName, tableName),
  eq(auditLogs.operation, operation),
  eq(auditLogs.userAgent, AUDIT_TAG), // constant literal, identical on every run
);
```

The ledger is **append-only** ([`customer-contacts.e2e-spec.ts:121`](../../apps/api/test/customer-contacts.e2e-spec.ts:121)),
`AUDIT_TAG` is a hard-coded string
([`customer-contacts.e2e-spec.ts:65`](../../apps/api/test/customer-contacts.e2e-spec.ts:65)),
and `contact_roles` rows are written without a `record_id`, so lines
[`201`](../../apps/api/test/customer-contacts.e2e-spec.ts:201) and
[`327`](../../apps/api/test/customer-contacts.e2e-spec.ts:327) count **every** `contact_roles`
insert/delete this suite has ever written. The expected `1` becomes `3`, `5`, … on each re-run.
The same suite passes on a virgin database — which is why it looked healthy on the first run.

The sibling suites do not have this defect: `customer-users`, `customer-tags` and
`customer-activity` scope their counts by `customerId` (unique per run), and
`customers.e2e-spec.ts:539` only asserts `toBeGreaterThan(0)`.

### R4 — Two different database gates; one of them can never see the database (P2, false negative)

[`audit-immutability.e2e-spec.ts:221`](../../apps/api/test/audit-immutability.e2e-spec.ts:221)
skips when `process.env['DATABASE_URL']` is undefined. But `DATABASE_URL` is not in the
process environment — it comes from `apps/api/.env.local`, loaded by
`ConfigModule.forRoot()` when `AppModule` is imported
([`app.module.ts:29`](../../apps/api/src/app.module.ts:29)). `audit-immutability` never imports
`AppModule`, so the check runs **before** any env file is loaded and the suite skips on every
developer machine, even though the other DB suites are running against that very database.
The suite's own `resolveDatabaseUrl()` (line 230) would have found the URL — but the earlier
`process.env` guard returns first, making it dead code in the happy path.

Consequence: the append-only ledger guarantee is currently **not verified locally at all**,
while six DB suites happily write to the same database.

---

## 4. Fix plan

Order matters: R1 unblocks the ability to see R2/R3 at all; R2 is production code; R3 is test
code; R4 restores one of the skipped suites.

### Step 1 — Give the e2e run a realistic timeout (R1)

- **File:** [`apps/api/test/jest-e2e.json`](../../apps/api/test/jest-e2e.json:1)
- **Change:** add `"testTimeout": 30000` (30 s). Rationale: measured single-suite bootstrap
  3.5 s; 30 s keeps an ~8× margin while still failing fast on a genuine hang.
- **Do not** use `--runInBand`: it serialises 18 suites and hides the parallel-load class of
  bug that this fix is about.
- **Optional hardening (same file):** `"maxWorkers": "50%"` to keep CI machines with many
  cores from over-subscribing the CPU; revisit after Step 2 lands.
- **Acceptance:** `pnpm test:e2e` on Node 24 with the local DB up reports **0** timeouts.

### Step 2 — Make customer-number allocation collision-free (R2)

- **Preferred fix:** take a per-month advisory lock **inside** the allocation transaction,
  before reading `max()`:
  `select pg_advisory_xact_lock(hashtext($prefix))` — released automatically at commit/rollback.
  - **Files:** [`customers.repository.ts`](../../apps/api/src/customers/customers.repository.ts:363)
    (issue the lock in `nextCustomerNumber`, or add a dedicated
    `lockCustomerNumberPrefix(tx, prefix)` to the repository interface) and
    [`customers.repository.interface.ts`](../../apps/api/src/customers/customers.repository.interface.ts:181).
  - Keep the existing retry loop as a safety net; the lock removes the normal collision path.
- **Alternative considered and rejected:** raise `CREATE_ATTEMPTS` to 5 with jitter. It stays
  probabilistic, wastes transactions (each loser aborts), and leaves `409` reachable in
  production under load.
- **Tests:**
  - `customers.repository.spec.ts` — assert the lock statement is issued **before** the `max()`
    select (the Drizzle query-recorder mock can capture order).
  - `customers.service.spec.ts` — the existing retry/exhaustion cases keep their meaning.
  - New e2e case (optional but cheap): `N` concurrent `POST /api/admin/customers` via
    `Promise.all` → all `201`, all numbers distinct.
- **Acceptance:** repeated full e2e runs produce no `409 CUSTOMER_NUMBER_CONFLICT`.

### Step 3 — Scope the audit-count assertions to the current run (R3)

- **File:** [`apps/api/test/customer-contacts.e2e-spec.ts`](../../apps/api/test/customer-contacts.e2e-spec.ts:136)
- **Change (both parts, they are complementary):**
  1. drop the `recordId === null` branch and always filter by
     `eq(auditLogs.customerId, customerId)` — the suite's customer is unique per run, so
     `contact_roles` rows are still counted, but only this run's;
  2. make the tag unique per run:
     `const AUDIT_TAG = \`customer-contacts-e2e/1.0 (AIS-178 d) ${randomUUID()}\`;`
     so a historical ledger row can never match again, while the purge recipe keeps working
     (prefix match).
- **Acceptance:** `pnpm test:e2e` run twice in a row without touching the database → green
  both times.

### Step 4 — One database gate for every persistence suite (R4)

- **File:** [`apps/api/test/audit-immutability.e2e-spec.ts`](../../apps/api/test/audit-immutability.e2e-spec.ts:220)
- **Change:** delete the `process.env['DATABASE_URL'] === undefined` short-circuit and rely on
  the existing `resolveDatabaseUrl()` + `probeDatabase()` pair; on failure keep the loud
  `DATABASE_SKIP_REASON` warning.
- **Acceptance:** with `apps/api/.env.local` present and Postgres up, the suite executes
  (no `[audit-immutability.e2e-spec] skipped:` line) and passes.

### Step 5 — Never report green for a skipped run (P2, prevents the recurrence)

- **File:** [`apps/api/test/lib/app-module-gate.ts`](../../apps/api/test/lib/app-module-gate.ts:36)
  and [`apps/api/test/lib/database-gate.ts`](../../apps/api/test/lib/database-gate.ts:29)
- **Change:** when `process.env['CI'] === 'true'` (or `APP_ENV` is a deployed environment),
  the gate **throws** instead of warning + returning `null`, so a runtime that cannot load
  `@nestjs/config` fails the run instead of skipping 140 tests. Keep the skip path for local
  Node < 24.9 so the documented workflow still works.
- **Also:** document in [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:1)
  that the e2e suite requires Node >= 24.9 (`fnm use 24`) and a running database
  (`pnpm db:up`), and that a run whose only output is `[app-module-gate] skipped:` is **not**
  a verification.

### Step 6 — Documentation

- Update [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:1) (test
  prerequisites, timeout, DB gate behaviour).
- Update [`docs/Specs/Database-Local.md`](../../docs/Specs/Database-Local.md:1) if the audit
  purge recipe's tag description changes (Step 3 makes the tag unique per run; the `LIKE`
  prefix stays the same).
- Milestone: `docs/milestones/2026-11-25--01-25-00-e2e-suite-timeout-and-db-isolation.milestone.md`.

---

## 5. Verification

```powershell
# 1. Node 24 + local database
fnm use 24
pnpm db:up                      # Postgres on :5432
pnpm --filter @callback/shared build

# 2. Full e2e, twice in a row (the second run proves the ledger scoping fix)
pnpm test:e2e
pnpm test:e2e

# 3. No silent skips
pnpm test:e2e 2>&1 | Select-String "skipped:|Exceeded timeout|409"
```

Expected: `Test Suites: 18 passed, 18 total`, `Tests: 140 passed`, no
`Exceeded timeout`, no `skipped:` line, no `409`.

CI check: the `e2e` job in [`.github/workflows/ci.yml:186`](../../.github/workflows/ci.yml:186)
must go green with `DATABASE_URL` provided by its Postgres service (i.e. **all** DB suites
actually execute).

---

## 6. Out of scope / follow-ups

- **Per-suite app boot cost (~3.5 s × 18).** A shared bootstrap helper that caches the
  compiled module per Jest worker would cut wall-clock time, but it must not become a
  hidden global singleton across suites. Deferred; the timeout fix is sufficient.
- **A dedicated test database.** Suites currently share the developer's local database, which
  is why the append-only ledger accumulates across runs. A per-run schema (or
  `…_test` database recreated in `globalSetup`) is the structural fix for audit-count
  assertions; deferred until the assertion scoping above proves insufficient.
- **`audit-immutability` does not use the `AppModule` gate at all** — after Step 4 it should
  be aligned with `database-gate.ts` so both gates fail/skip for the same reasons.

---

## 7. Implementation notes (2026-11-25)

All six steps shipped. Two deviations are worth recording:

1. **Step 2 kept the interface signature.** Instead of a new
   `lockCustomerNumberPrefix()` method, the lock is taken inside `nextCustomerNumber()` — the
   method already means "allocate for this month", so the interface gained documentation only.
   The DB mock gained `execute`, `executeArguments` and `callOrder`, and the repository spec
   pins `callOrder === ['execute', 'select']`.
2. **Step 4 was not sufficient on its own — a second root cause existed.** After removing the
   `process.env` pre-check, `audit-immutability` still skipped: `loadEnvFileIfPresent()` used
   `process.loadEnvFile()`, which writes into the **real** process env while Jest hands the
   spec a _copy_ of `process`. The loader now parses with `node:util`'s `parseEnv()` and
   assigns into the `process.env` the caller sees
   ([`apps/api/src/db/database-url.ts`](../../apps/api/src/db/database-url.ts:58)), covered by
   the new [`apps/api/src/db/database-url.spec.ts`](../../apps/api/src/db/database-url.spec.ts:1).

Result: `19 suites / 147 tests passed` on two consecutive runs against the same local
database, `78 suites / 1015 tests` for the API unit suite, and a clean typecheck, lint and
quality-gate run.
