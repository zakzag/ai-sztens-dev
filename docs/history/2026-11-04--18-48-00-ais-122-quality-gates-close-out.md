# AIS-122 — Quality gates close-out: aggregate typecheck, required-check documentation

**Date:** 2026-11-04 18:48 · **Ticket:** [AIS-122](https://zakzag.atlassian.net/browse/AIS-122) (subtask of [AIS-105](https://zakzag.atlassian.net/browse/AIS-105)) · **Plan:** [`2026-11-04--18-40-00-ais-122-quality-gates-close-out-plan.md`](../plans/2026-11-04--18-40-00-ais-122-quality-gates-close-out-plan.md:1)

## Why this change happened

AIS-122 was already implemented on 2026-11-02: the four gates (layers, dead code, tokens, field
errors), their negative fixtures, the `quality-gates` CI job and `UI-Architecture.md` §9 all existed.
What was missing was recorded by the roadmap as **P0-2**: the job was not a _required_ check, and the
aggregate `pnpm typecheck` the git-hook plan needs did not exist anywhere in the repo. This change
closes exactly those gaps and touches nothing in the gate implementations.

## Baseline measured before touching anything

| Check               | Result                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm quality`      | green — `depcruise`: 0 violations over **84 modules / 113 dependencies**; `knip`: no issues; palette: 0; field errors: 0 |
| `pnpm test:quality` | green — **39 / 39** tests (negative + positive fixtures for every gate)                                                  |

## What changed

### 1. Per-workspace `typecheck` scripts

`pnpm -r <script>` fails outright when a selected workspace has no such script, so a root-only
`typecheck` was impossible. Each workspace now owns one:

| Workspace                                               | Script                                | Scope                                   |
| ------------------------------------------------------- | ------------------------------------- | --------------------------------------- |
| `packages/shared`, `packages/api-client`, `packages/ui` | `tsc --noEmit -p tsconfig.json`       | src + test                              |
| `apps/admin`, `apps/web`                                | `tsc --noEmit -p tsconfig.json`       | src (+ test where present)              |
| `apps/api`                                              | `tsc --noEmit -p tsconfig.build.json` | production only (see the finding below) |

### 2. Root aggregate

```json
"typecheck": "pnpm --filter @callback/shared build && pnpm -r typecheck"
```

`shared` is built first because it and `api-client` are consumed through `dist/*.d.ts`, and
`tsc --noEmit` emits none — without it a fresh clone fails on unresolved types. `pnpm typecheck` was
also inserted into `qa:all` **before** `build`, so a type error fails in seconds instead of after a
cold vite build.

### 3. CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:79) — new `Typecheck all packages` step in
the `build-test` job, after "Build shared" and before "Build all packages"; the workflow's own header
comment gained the matching bullet.

### 4. Documentation

- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:549) — §9 intro now names the fifth
  machine check; new **§9.5** documents `pnpm typecheck` per workspace and **§9.5.1** documents the
  required status checks (`gh api` command, the ruleset path, and the throwaway-PR proof).
- §9.4 records the one accepted deviation: `knip` has no fixture pair.
- The 2026-11-02 AIS-122 plan's `Status:` line was corrected from "plan — nothing implemented yet"
  to "implemented", pointing at this close-out.
- The roadmap's §1 table lost its two now-closed gap rows and its P0-2 row is marked done.

## The finding (needs its own ticket)

Running `apps/api` type-check against the **full** `tsconfig.json` — not the build config — fails:

```text
Found 20 errors in 6 files.
     1  src/api-keys/api-keys.repository.spec.ts:237
     3  src/common/http/test/support/envelope-route.ts:121
     9  src/common/openapi/openapi.registry.spec.ts:34
     4  src/db/schema.spec.ts:213
     1  test/envelope-contract.e2e-spec.ts:67
     2  test/lib/envelope.matchers.ts:110
```

All 20 sit in `**/*spec.ts` / `test/**`, which [`apps/api/tsconfig.build.json`](../../apps/api/tsconfig.build.json:3)
excludes — so `nest build` has never compiled them and CI has never type-checked them. They are
pre-existing, not caused by this change, and they are real: a stale `ApiKeyRow` fixture missing
`deletedAt`, unchecked `document.paths`, `precision` assertions on a Drizzle `PgColumn` that does not
expose them, and two overlapping casts in `test/lib/envelope.matchers.ts`.

Per the agreed policy the check was **not** weakened to hide them and **not** expanded to block every
merge: `apps/api` type-checks the build scope (exactly what `nest build` compiles), the gap is written
into §9.5, and **[AIS-128](https://zakzag.atlassian.net/browse/AIS-128)** carries the fix (including
switching the script to `tsconfig.json` once it is clean).

## Negative proofs

| #   | Proof                                                                                                                                     | Result                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `pnpm typecheck` on a clean tree                                                                                                          | exit 0, all six workspaces green (~31 s)                                          |
| 2   | `const probeNegativeProof: number = 'not a number';` added to [`field-errors.logic.ts`](../../apps/admin/src/lib/field-errors.logic.ts:1) | `TS2322` at `src/lib/field-errors.logic.ts:23`, exit 2 — probe removed afterwards |
| 3   | `pnpm quality` / `pnpm test:quality` after the change                                                                                     | unchanged, green                                                                  |

## Files touched

| File                                                                                                                                            | Change                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`package.json`](../../package.json:9)                                                                                                          | `typecheck` script; `qa:all` gains `pnpm typecheck` before `build` |
| [`packages/shared/package.json`](../../packages/shared/package.json:14)                                                                         | `typecheck`                                                        |
| [`packages/api-client/package.json`](../../packages/api-client/package.json:14)                                                                 | `typecheck`                                                        |
| [`packages/ui/package.json`](../../packages/ui/package.json:10)                                                                                 | `typecheck`                                                        |
| [`apps/admin/package.json`](../../apps/admin/package.json:6)                                                                                    | `typecheck`                                                        |
| [`apps/web/package.json`](../../apps/web/package.json:6)                                                                                        | `typecheck`                                                        |
| [`apps/api/package.json`](../../apps/api/package.json:9)                                                                                        | `typecheck` against `tsconfig.build.json`                          |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:79)                                                                                 | `Typecheck all packages` step + header bullet                      |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:549)                                                                              | §9 intro, §9.4 deviation, §9.5, §9.5.1                             |
| [`docs/plans/2026-11-02--18-25-00-ais-122-quality-gates-plan.md`](../plans/2026-11-02--18-25-00-ais-122-quality-gates-plan.md:6)                | stale `Status:` corrected                                          |
| [`docs/plans/2026-11-04--18-25-00-standardised-feature-roadmap-plan.md`](../plans/2026-11-04--18-25-00-standardised-feature-roadmap-plan.md:34) | two gap rows removed, P0-2 marked done                             |
