# 2026-11-25 01:25 — `pnpm test:e2e` 96 failures: diagnosis

**Type:** investigation + plan (no code changed)
**Plan:** [`docs/plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md`](../plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md)
**Milestone:** [`docs/milestones/2026-11-25--01-25-00-e2e-suite-timeout-and-db-isolation.milestone.md`](../milestones/2026-11-25--01-25-00-e2e-suite-timeout-and-db-isolation.milestone.md)

## What was asked

Find out why `pnpm test:e2e` reports 96 failing tests and produce a fix plan.

## How the failures were reproduced

The IDE shell runs `node v20.19.2`, where the first run reported `18 passed, 140 passed`
— but every suite had printed
`[app-module-gate] skipped: Jest's ESM runner needs Node >= 24.9 … (running on 20.19.2)`.
`fnm`'s default Node is `v24.22.2` and CI uses `node-version: 24`, so the suite was re-run
through `fnm exec --using 24.22.2`:

```text
Test Suites: 9 failed, 9 passed, 18 total
Tests:       96 failed, 44 passed, 140 total
```

## Findings

1. **All 96 failures are `Exceeded timeout of 5000 ms`** (192 timeout messages including the
   duplicated `Cause:` blocks; zero `Expected:`/`Received:` lines). The default Jest timeout
   is smaller than a parallel Nest bootstrap: one suite boots the app in ~3.5 s, and 18
   workers booting simultaneously push the same work past 5 s.
2. Re-running with `--testTimeout=60000` turned the picture into `128 passed, 12 failed`,
   exposing two more defects:
   - **customer-number race** — `customer-audit-logs.e2e-spec.ts` got `409` instead of `201`.
     Allocation is `max(customer_number)+1` with `CREATE_ATTEMPTS = 2`; parallel creates
     collide twice and the API answers `409 CUSTOMER_NUMBER_CONFLICT`.
   - **ledger counts not scoped** — `customer-contacts.e2e-spec.ts` counts `contact_roles`
     rows with `recordId = null` and a constant `AUDIT_TAG`; the ledger is append-only, so
     the expected `1` becomes `3`, `5`, … on each re-run.
3. **`audit-immutability.e2e-spec.ts` never runs locally**: it gates on
   `process.env['DATABASE_URL']`, but that variable is loaded by `ConfigModule.forRoot()`
   only when `AppModule` is imported — and this suite never imports it. It skipped in every
   run while six sibling suites used the same database.
4. Database inspection after a run: `customer.customers` empty, `audit.audit_logs` holding
   17 `customers/insert` rows — proof that the suites delete their own rows and leave the
   ledger behind.

## Deliverables

- `docs/plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md` — six ordered steps
  (Jest `testTimeout`, advisory-lock number allocation, scoped audit assertions, unified DB
  gate, CI fail-on-skip, docs), with acceptance criteria and verification commands.
- `docs/milestones/2026-11-25--01-25-00-e2e-suite-timeout-and-db-isolation.milestone.md` —
  decision-grade summary.

## Temporary artifacts

Diagnostic captures (`e2e-output.txt`, `e2e-node24.txt`, `e2e-node24-60s.txt`,
`e2e-health-60s.txt`, `e2e-two.txt`) and `tmp-db-probe.mjs` were used during the session and
removed afterwards; they are not part of the change.

## Notes for the implementation session

- The first fix must be `apps/api/test/jest-e2e.json` (`"testTimeout": 30000`), otherwise the
  remaining defects are hidden behind timeouts.
- The number-allocation fix is **production code**, not test code: under two simultaneous
  admin creates the same `409` is reachable in production.
- Do not "fix" the 96 failures by running `--runInBand`; that serialises the suites and hides
  the parallel-load class of bug entirely.
