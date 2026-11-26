# Milestone — full test / lint / quality-gate green-up (2026-11-03)

## 1. Problem

`pnpm test` and `pnpm test:e2e` passed, but the repository's static gates and helper
scripts did not: `pnpm quality` failed on the layer rule, `pnpm test:quality` and
`pnpm test:agents` crashed on Node 26, `pnpm lint` emitted a warning, and **every**
`pnpm` invocation printed `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` because pnpm 12's
default supply-chain policy rejected four freshly published lockfile entries.

## 2. Measured data / evidence

| Observation                  | Evidence                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layer gate red, 2 violations | `features/api-keys/use-api-keys.ts → features/api/use-api-list.ts` and `…/use-api-mutation.ts`                                                         |
| Test-runner crash            | `Cannot find module '…\scripts\quality'` from `node --test scripts/quality/` on Node v26.0.0                                                           |
| Supply-chain failure         | 4 entries: `@tanstack/query-core@5.105.2`, `@tanstack/react-query@5.105.2`, `strtok3@10.7.0`, `token-types@6.2.0`, all published inside the 24h cutoff |
| Lint warning                 | `response-assert.logic.ts:49` — `no-unsafe-argument`, `ZodTypeAny` → `ZodType<…, unknown>`                                                             |
| Unchanged suites (control)   | `pnpm test` 433 tests, `pnpm test:e2e` 59 tests — already green                                                                                        |

## 3. Root cause

1. **Rule/config drift.** `.dependency-cruiser.rules.cjs` declares `SHARED_FEATURES =
'(?:api|error-surface)'` and exempts both for page rules, but the feature rule's `pathNot`
   still named only `error-surface`. AIS-114 moved the generic query hooks into `features/api`
   and made `features/api-keys` an adapter over them, so the gate and its own documented model
   disagreed.
2. **Runner behaviour change.** Node's test runner no longer accepts a bare directory argument;
   Node 26 tries to `require()` it as a module. Quoted globs are expanded by the runner and are
   the supported form.
3. **New pnpm default.** pnpm 12 enables `minimumReleaseAge` (1440 minutes) by default. The
   lockfile pinned versions published hours earlier, so verification — which runs before every
   script — aborted the implicit install.
4. **`any` in a public contract type.** `ApiEndpointContract.dataSchema` was `z.ZodTypeAny`
   (`ZodType<any, any, any>`); passing it into a function that requires
   `ZodType<TPayload, ZodTypeDef, unknown>` is an unsafe argument, and re-annotating locally is
   an unsafe assignment. The registry genuinely treats schemas as opaque, so the type should say
   so.

## 4. Solution / implementation

| File                                                                       | Change                                                                                          |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.dependency-cruiser.rules.cjs`                                            | `no-feature-to-feature` exempts `${SHARED_FEATURES}` (api + error-surface), comment updated     |
| `scripts/quality/fixtures/layers/positive/src/features/alpha/use-alpha.ts` | Imports `../api/use-list.js` — positive proof of the shared-feature edge                        |
| `package.json`                                                             | `test:quality` / `test:agents` use quoted `*.test.mjs` globs                                    |
| `pnpm-workspace.yaml`                                                      | Explicit `minimumReleaseAge: 1440` + `minimumReleaseAgeExclude` for the four trusted packages   |
| `packages/shared/src/contract/endpoint.interface.ts`                       | `dataSchema: z.ZodType<unknown, z.ZodTypeDef, unknown>` (+ rationale docblock)                  |
| `apps/api/src/common/openapi/response-assert.logic.ts`                     | Uses the typed registry schema directly; no cast, no warning                                    |
| `docs/Specs/UI-Architecture.md`                                            | Documents the shared-infrastructure exception (§2, §9 table, §9.1, §9.4) and refreshes the date |

## 5. Outcome and how to verify

All checks green, with no behavioural change to the API, the admin SPA or the public site.

```bash
pnpm install --frozen-lockfile   # "Lockfile passes supply-chain policies (1054 entries)"
pnpm lint                        # exit 0, zero warnings
pnpm build                       # exit 0 (all six workspace builds)
pnpm test                        # exit 0
pnpm test:e2e                    # exit 0 — 11 suites, 59 tests
pnpm quality                     # exit 0 — layers, knip, palette, field-errors
pnpm test:quality                # exit 0 — 39 tests
pnpm test:agents                 # exit 0 — 34 tests
pnpm sonar:test                  # exit 0 — 43 tests
```

Negative proof for the layer gate: re-add a `features/alpha → features/beta` import in the
negative fixture path and `pnpm test:quality` still exits non-zero naming
`no-feature-to-feature`; the positive fixture's `features/alpha → features/api` edge must stay
green.

## 6. Follow-ups

- Revisit `minimumReleaseAgeExclude` once the four versions are older than 24h; the entries can
  be removed and the lockfile left as-is (the versions will pass the policy by then).
- `pnpm format:check` still reports 12 pre-existing files outside this change; a dedicated
  formatting sweep is a separate task.
- `apps/web` still has no layer folders, so `quality:layers` cruises `apps/admin/src` only.
