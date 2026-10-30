# AIS-37 — Callback requests repository + unit tests (implementation)

**Date:** 2026-10-21
**Jira:** AIS-37 (Subtask) — parent: AIS-29
**Plan:** [`2026-10-21--12-54-00-ais-37-repository-unit-tests-plan.md`](../plans/2026-10-21--12-54-00-ais-37-repository-unit-tests-plan.md)
**Milestone:** [`2026-10-21--13-05-00-callback-requests-repository-contract.milestone.md`](../milestones/2026-10-21--13-05-00-callback-requests-repository-contract.milestone.md)

## Starting point (pre-flight)

| Check              | Result                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/` | `schema.ts`, `schema.spec.ts`, `database-url.ts` only — no repository, no DI token                                        |
| Callback storage   | in-memory `Map` in [`callback-requests.service.ts`](../../apps/api/src/callback-requests/callback-requests.service.ts:12) |
| Jest               | `ts-jest` ESM preset, `rootDir: src`, `testRegex: .*\.spec\.ts$`                                                          |
| Baseline tests     | 10 suites / 93 tests green                                                                                                |

## Changes

| File                                                                                                                           | Change                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/api/src/db/database.interface.ts`](../../apps/api/src/db/database.interface.ts)                                         | new — `Database = PostgresJsDatabase<typeof schema>` (the abstraction repositories depend on)                                                                                                           |
| [`apps/api/src/db/database.const.ts`](../../apps/api/src/db/database.const.ts)                                                 | new — `DATABASE` injection token (string token: the handle is a type alias, not a class)                                                                                                                |
| [`apps/api/src/db/callback-requests.errors.ts`](../../apps/api/src/db/callback-requests.errors.ts)                             | new — `CallbackRequestNotFoundError`, `InvalidCallbackRequestIdError`, `CallbackRequestNotPersistedError`; framework-agnostic, each carrying the offending value                                        |
| [`apps/api/src/db/uuid.ts`](../../apps/api/src/db/uuid.ts)                                                                     | new — pure `isUuid()` guard (canonical dashed RFC 4122 form)                                                                                                                                            |
| [`apps/api/src/db/callback-requests.repository.interface.ts`](../../apps/api/src/db/callback-requests.repository.interface.ts) | new — `CallbackRequestsRepository` contract with the failure semantics documented                                                                                                                       |
| [`apps/api/src/db/callback-requests.repository.ts`](../../apps/api/src/db/callback-requests.repository.ts)                     | new — `DrizzleCallbackRequestsRepository` (`@Inject(DATABASE)`): `create` → insert + `returning()`, `findAll` → `created_at DESC`, `findOne` → uuid guard + `where … limit 1`                           |
| [`apps/api/src/db/callback-requests.repository.spec.ts`](../../apps/api/src/db/callback-requests.repository.spec.ts)           | new — 14 tests: happy paths, empty results, invalid uuid (no query issued), not-found, transport and query failures                                                                                     |
| [`apps/api/src/db/uuid.spec.ts`](../../apps/api/src/db/uuid.spec.ts)                                                           | new — 6 accepted + 12 rejected shapes                                                                                                                                                                   |
| [`apps/api/src/db/test/mocks/callback-requests.mock.ts`](../../apps/api/src/db/test/mocks/callback-requests.mock.ts)           | new — row/insert fixtures, valid and distinct UUID constants                                                                                                                                            |
| [`apps/api/src/db/test/mocks/database.mock.ts`](../../apps/api/src/db/test/mocks/database.mock.ts)                             | new — scripted Drizzle handle (`insert/values/returning`, `select/from/where/limit/orderBy`) with `mockCreateResult`, `mockCreateFailure`, `mockInsertFailure`, `mockSelectResult`, `mockSelectFailure` |
| [`apps/api/package.json`](../../apps/api/package.json)                                                                         | `@jest/globals` added to devDependencies (the ESM Jest setup has no `jest` global)                                                                                                                      |
| [`apps/api/tsconfig.build.json`](../../apps/api/tsconfig.build.json)                                                           | `**/test/**` excluded — test mocks must never be compiled into `dist`                                                                                                                                   |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md)                                                                   | §9: new "AIS-37 done" table; the "missing" row now says the repository exists but the `AppModule` does not wire it yet; header date bumped                                                              |

Not changed: `schema.ts`, `schema.spec.ts`, `callback-requests.service.ts`, `callback-requests.module.ts`, `app.module.ts`, the generated migration. The `Map` → Postgres swap, the `database.module.ts` provider and the e2e tests stay in AIS-38.

## Decisions (and why)

- **Rows, not view models.** The repository returns `CallbackRequestRow` (`createdAt` as `Date`). The `Date → ISO string` mapping belongs to the service layer (AIS-38), so the DB layer never learns the public JSON shape.
- **`findOne` throws instead of returning `null`.** Per the ticket: a missing row raises `CallbackRequestNotFoundError`. The DB layer never throws a Nest `NotFoundException` — HTTP mapping is AIS-38's job, which keeps the repository usable from workers/CLI.
- **Invalid UUID never reaches Postgres.** `isUuid()` runs first and raises `InvalidCallbackRequestIdError`, turning a `22P02 invalid input syntax for type uuid` into a deterministic, cheap error.
- **DB errors propagate unchanged.** No wrapping, so the `cause` chain and the caller's ability to classify driver errors survive.
- **`findAll` is `created_at DESC` by contract.** The ordering is a property of the repository, not of whatever SQL a caller writes later.
- **Mocks live in `src/db/test/mocks/`.** `rootDir` is `src`, so `apps/api/test/mocks/` would be invisible to Jest; the mock factory is the single place holding the one `as unknown as Database` cast.

### Two traps found while wiring the mocks

1. **No `jest` global in ESM.** `jest.fn()` inside a helper crashed the suite with `ReferenceError: jest is not defined`; the fix is `import { jest } from '@jest/globals'`, which also required declaring the package as a devDependency.
2. **A rejection at `.values()` is not a valid failure shape.** It returns a promise where the repository expects a builder, so `.returning()` explodes and the rejection is orphaned — Jest then kills the worker with an unhandled rejection instead of failing the test. Transport failures are therefore simulated by throwing synchronously from `insert()`; query failures reject at the terminal steps (`returning` / `orderBy` / `limit`), produced per call via `mockImplementation` rather than `mockRejectedValue`.

## Verification

```
pnpm --filter @callback/api test    → Test Suites: 12 passed, 12 total
                                      Tests:       107 passed, 107 total   (was 93)
pnpm --filter @callback/api build   → OK
pnpm --dir apps/api exec eslint src/db → 0 problems
```

`pnpm --filter @callback/api lint` still reports the pre-existing `vapi-signature.guard.spec.ts` /
`vapi-webhooks.e2e-spec.ts` diagnostics (documented in the AIS-36 history entry); the new `src/db`
files are clean.

## Follow-ups

- **AIS-38:** add `database.module.ts` (provider for `DATABASE`, `postgres.js` client, `onModuleDestroy` → `end()`), bind the repository into `CallbackRequestsModule`, replace the `Map`, map the three errors to HTTP responses, and add the e2e proof (POST → row readable after restart).
- **Repo-wide cleanup:** switch the remaining `jest`-dependent specs to `@jest/globals` so `pnpm lint` can be green.
- The `created_at DESC` direction is asserted structurally (the `orderBy` step is reached); the generated SQL text is expected to be verified by the AIS-38 integration/e2e run.
