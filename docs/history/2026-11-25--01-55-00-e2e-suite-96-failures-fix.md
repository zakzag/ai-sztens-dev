# 2026-11-25 01:55 — `pnpm test:e2e` 96 failures: fix

**Type:** implementation (follows the diagnosis of 2026-11-25 01:25)
**Plan:** [`docs/plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md`](../plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md)
**Milestone:** [`docs/milestones/2026-11-25--01-25-00-e2e-suite-timeout-and-db-isolation.milestone.md`](../milestones/2026-11-25--01-25-00-e2e-suite-timeout-and-db-isolation.milestone.md)

## What was changed

### 1. E2E timeout — the 96 failures (`apps/api/test/jest-e2e.json`)

`"testTimeout": 30000`. Measured bootstrap is ~3.5 s per suite on an idle machine; 18 workers
doing it in parallel exceeded the 5 s Jest default, so every app-booting hook/test timed out
before an assertion ran.

### 2. Customer-number allocation race (`apps/api/src/customers/**`)

[`customers.repository.ts`](../../apps/api/src/customers/customers.repository.ts:363)
`nextCustomerNumber()` now takes a per-month, transaction-scoped advisory lock
(`select pg_advisory_xact_lock(hashtext(${prefix}))`) **before** reading `max(customer_number)`.
The retry loop in `CustomersService.create()` stays as a safety net, but the normal collision
path (two concurrent creates deriving the same number → `23505` → one retry → `409`) is gone.

- interface doc updated (`nextCustomerNumber` is now "serialised per month"),
- `CREATE_ATTEMPTS` docblock rewritten (the lock is the fix, the retry is the net),
- `test/mocks/database.mock.ts` gained an `execute` entry point plus `executeArguments` and
  `callOrder` recorders (the mock only modelled `insert/select/update`),
- `customers.repository.spec.ts` gained one test: the lock runs **before** the `max()` read.

### 3. Ledger counts scoped to the run (`apps/api/test/customer-contacts.e2e-spec.ts`)

`countAuditRows()` now always filters on the suite's own `customerId` (the `contact_roles`
audit rows carry it, with `record_id = NULL` by design), and `AUDIT_TAG` carries this run's
uuid. The append-only ledger therefore stops inflating `contact_roles` insert/delete counts on
every re-run (`1`, `3`, `5`, …).

### 4. One DB gate, working under Jest (`audit-immutability` + `src/db/database-url.ts`)

`audit-immutability.e2e-spec.ts` no longer pre-checks `process.env['DATABASE_URL']` (nothing
loads the dotenv file in that process) and uses `resolveDatabaseUrl()` + `probeDatabase()` like
the sibling suites.

**A second root cause surfaced here:** after that change the suite _still_ skipped, because
`loadEnvFileIfPresent()` used `process.loadEnvFile()`. Jest's node environment hands the spec a
**copy** of `process`, while the native loader writes into the real process env — so the copy
the test reads stayed empty. The loader now parses with `node:util`'s `parseEnv()` and assigns
into the `process.env` the caller sees, keeping the "already exported wins" precedence. New
unit spec: `apps/api/src/db/database-url.spec.ts` (5 cases, including the unreadable-file error).

### 5. Skip policy — CI can no longer be green on a skipped run (`apps/api/test/lib/**`)

New `skip-policy.ts`: `isSkipFatal()` / `reportSkip(context, reason)` — warns locally, **throws**
when `CI=true`. `app-module-gate` and `database-gate` both delegate to it (`reportDatabaseSkip()`
keeps the `[database-gate]` tag), and all seven DB-backed specs now close the app handle before
reporting, so a CI failure does not leak a Nest instance. New e2e spec:
`apps/api/test/skip-policy.e2e-spec.ts` (7 cases, both branches of the policy).

### 6. Specs docs

- [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md) — §2.1.1 "Timeout and skip
  policy", plus the header date.
- [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) — §10.1 now documents the
  `<suite>-e2e/1.0 (<ticket>) <run-uuid>` tag and why the uuid is there.

## Verification

| Check                                                                                                                       | Result                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `jest --config test/jest-e2e.json` (Node 24.22.2, local Postgres up), run 1                                                 | **19 suites / 147 tests passed**, no `skipped:`, no `Exceeded timeout`, no `409` |
| Same command, run 2 (reused database)                                                                                       | **19 suites / 147 tests passed** — proves the ledger scoping fix                 |
| `jest` (API unit, Node 24)                                                                                                  | **78 suites / 1015 tests passed**                                                |
| `pnpm --filter @callback/api typecheck`                                                                                     | clean                                                                            |
| `pnpm --filter @callback/api lint`                                                                                          | clean                                                                            |
| `pnpm quality:docs` / `quality:dead-code` / `quality:layers` / `quality:tokens` / `quality:themes` / `quality:field-errors` | all green                                                                        |
| `audit-immutability.e2e-spec.ts` alone                                                                                      | 8/8 executed (previously 0/8 executed — it skipped)                              |

## Known issues not touched

- **`pnpm test:quality` fails on Windows**: `node --test "scripts/quality/*.test.mjs"` relies on
  shell glob expansion (cmd/PowerShell do not expand it) and the script also references
  `scripts/lib/vite-build.logic.test.mjs`, which does not exist in the repo. Pre-existing
  (`package.json` was not modified by this change); the gates it wraps were run individually and
  are green.
- **A Node 20 shell still self-skips** locally by design. The difference now is that CI uses
  Node 24 and, if a gate cannot load, the run **fails** instead of printing a green summary for
  zero executed tests.
