# `pnpm test:e2e` — 96 red tests: timeout, number race, ledger scoping

**Date:** 2026-11-25
**Plan:** [`docs/plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md`](../plans/2026-11-25--01-25-00-e2e-suite-96-failures-fix-plan.md)
**Change summary:** [`docs/history/2026-11-25--01-55-00-e2e-suite-96-failures-fix.md`](../history/2026-11-25--01-55-00-e2e-suite-96-failures-fix.md)
**Status:** fixed and verified on 2026-11-25

## 1. Problem

`pnpm test:e2e` reported `96 failed, 44 passed` of 140 tests in the `apps/api` e2e suite.
The same command on a different Node runtime reported all green — so the regression was
invisible depending on which shell ran it.

## 2. Measured evidence

| Measurement                | Result                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| Failing runtime            | Node `v24.22.2` (fnm default; CI uses `node-version: 24`)                     |
| "Green" runtime            | Node `v20.19.2` — all 18 suites **self-skip** (140 tests never run)           |
| Nature of the 96 failures  | 192 × `Exceeded timeout of 5000 ms`; **0** assertion failures                 |
| Single suite, 60 s timeout | passes; the app-booting test takes **3525 ms**                                |
| Full run, 60 s timeout     | `128 passed, 12 failed` (2 suites) in 9 s                                     |
| DB state after a run       | `customer.customers` empty, `audit.audit_logs` has 17 `customers/insert` rows |

## 3. Root causes

1. **5 s Jest default timeout vs. parallel Nest bootstrap (96 failures).** Each app-module
   suite dynamically imports `src/app.module.js`, which makes ts-jest transform the whole
   application graph inside that worker, then compiles and initialises the Nest app
   (~3.5 s idle). With 18 workers doing it simultaneously the same work exceeds 5 s, so
   `beforeAll`/the first test times out before any assertion runs.
2. **Customer-number allocation is a `MAX()+1` race (10 residual failures).**
   `select max(customer_number)` inside the transaction, then insert; the loser hits
   `customers_customer_number_key` and retries — but `CREATE_ATTEMPTS = 2`, i.e. exactly one
   retry. Parallel suites collide twice in a row and the API answers `409
CUSTOMER_NUMBER_CONFLICT`. The constant's docblock already names
   `pg_advisory_xact_lock` as the correct, unbuilt alternative.
3. **Ledger assertions aggregate across runs (2 residual failures).**
   `customer-contacts.e2e-spec.ts` counts `contact_roles` rows with `recordId = null` and a
   hard-coded `AUDIT_TAG`; the audit ledger is append-only, so the expected `1` grows on every
   re-run (`3`, `5`, …). Sibling suites scope the same counts by `customerId` and are stable.
4. **Two divergent database gates.** `audit-immutability.e2e-spec.ts` skips on
   `process.env['DATABASE_URL']`, which is only populated by `ConfigModule.forRoot()` when
   `AppModule` is imported — and that suite never imports it. The ledger-immutability suite
   therefore never runs locally while six other suites write to the same database.

## 4. Solution (planned)

| Step | Change                                                                               | File                                                       |
| ---- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1    | `"testTimeout": 30000` in the e2e Jest config                                        | `apps/api/test/jest-e2e.json`                              |
| 2    | Per-month `pg_advisory_xact_lock(hashtext(prefix))` before `max()`, keep retry loop  | `customers.repository.ts` / `.interface.ts`                |
| 3    | Scope audit counts by `customerId`; make `AUDIT_TAG` unique per run                  | `customer-contacts.e2e-spec.ts`                            |
| 4    | Drop the `process.env` pre-check, rely on `resolveDatabaseUrl()` + `probeDatabase()` | `audit-immutability.e2e-spec.ts`                           |
| 5    | In CI, a gate that cannot load must **fail**, not skip                               | `test/lib/app-module-gate.ts`, `test/lib/database-gate.ts` |
| 6    | Document Node ≥ 24.9 + `pnpm db:up` prerequisites                                    | `docs/Specs/Local-Development.md`                          |

Rejected alternative for step 2: raising `CREATE_ATTEMPTS` with jitter — still probabilistic
and leaves `409` reachable under load.

## 5. Outcome and verification

Expected end state: 18 suites, 140 tests, no timeouts, no `skipped:` line, no `409`, twice in
a row on the same database.

**Measured end state:** `19 suites / 147 tests passed` on two consecutive runs (the extra suite
is `skip-policy.e2e-spec.ts`), with `audit-immutability` executing its 8 tests instead of
skipping; `78 suites / 1015 tests` for the API unit suite; typecheck, lint and all six quality
gates clean.

```powershell
fnm use 24
pnpm db:up
pnpm --filter @callback/shared build
pnpm test:e2e
pnpm test:e2e
pnpm test:e2e 2>&1 | Select-String "skipped:|Exceeded timeout|409"
```

CI (`.github/workflows/ci.yml` → e2e job, Node 24 + Postgres service) must be green with all
DB suites executing.

## 6. Follow-ups

- 18 × ~3.5 s app bootstrap: a per-worker cached app factory would cut wall-clock time.
- A per-run test schema/database would remove ledger accumulation structurally; deferred until
  the assertion scoping fix proves insufficient.
- `audit-immutability` should share `database-gate.ts` semantics instead of owning a private copy.
- A green run that only printed `[app-module-gate] skipped:` must never be read as a
  verification again; that is the rule step 5 encodes.
