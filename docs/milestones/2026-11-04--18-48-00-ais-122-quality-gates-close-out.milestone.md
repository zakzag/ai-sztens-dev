# AIS-122 — The gates existed; the type-check and the teeth did not

**Date:** 2026-11-04 · **Ticket:** AIS-122 (subtask of AIS-105) · **Plan:** `docs/plans/2026-11-04--18-40-00-ais-122-quality-gates-close-out-plan.md`

## 1. Problem / feature

AIS-122 ("make the layer/token/field-error rules machine-enforced") was implemented on 2026-11-02:
four gates, negative fixtures, a `quality-gates` CI job, `UI-Architecture.md` §9. The roadmap then
recorded two remaining gaps as P0-2:

1. the job was **not a required check** — a rule violation could still merge;
2. **no aggregate `pnpm typecheck`** existed anywhere in the repo, so neither CI nor the planned git
   hooks could type-check the monorepo in one command.

## 2. Measured data / evidence

| Check                                          | Before the change                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm quality`                                 | green — `depcruise` 0 violations over 84 modules / 113 dependencies, `knip` clean, tokens 0, field errors 0 |
| `pnpm test:quality`                            | green — 39/39 (negative **and** positive fixtures per gate)                                                 |
| `grep '"typecheck"'` over every `package.json` | **0 hits**                                                                                                  |
| `apps/api` `tsc --noEmit -p tsconfig.json`     | **20 errors in 6 files**                                                                                    |

## 3. Root cause / design rationale

_Why a per-workspace script instead of one root command:_ `pnpm -r <script>` **fails** when a selected
workspace has no such script, so a root-only `typecheck` cannot work — every workspace had to own one.

_Why `shared` is built first:_ `@callback/shared` and `@callback/api-client` are consumed through
`dist/*.d.ts`, and `tsc --noEmit` emits nothing. Without the build step a fresh clone fails on
unresolved types. Same reason CI already had a "Build shared" step.

_Why `apps/api` checks `tsconfig.build.json`:_ this is the discovery of the change. All 20 errors sit
in `**/*spec.ts` and `test/**`, which `tsconfig.build.json` **excludes** — `nest build` has never
compiled them, so CI never type-checked any API test file. The errors are real (a stale `ApiKeyRow`
fixture missing `deletedAt`, unchecked `document.paths`, `precision` assertions on a Drizzle
`PgColumn`, two overlapping casts). Two options were rejected: pointing the gate at `tsconfig.json`
would block every merge on pre-existing debt; excluding `apps/api` entirely would leave the largest
codebase unchecked. The chosen middle path — build scope, gap documented, follow-up ticket — keeps the
gate honest and green.

_Why the `knip` deviation stands:_ `knip` has no fixture pair. It is a third-party tool and the gate
_is_ its exit code, so a synthetic dead-code tree would test `knip`, not our rule.

## 4. Solution / implementation

| File                                           | Change                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/{shared,api-client,ui}/package.json` | `"typecheck": "tsc --noEmit -p tsconfig.json"`                                                                                                                                                                      |
| `apps/{admin,web}/package.json`                | same                                                                                                                                                                                                                |
| `apps/api/package.json`                        | `"typecheck": "tsc --noEmit -p tsconfig.build.json"`                                                                                                                                                                |
| `package.json`                                 | `"typecheck": "pnpm --filter @callback/shared build && pnpm -r typecheck"`; `qa:all` gains `pnpm typecheck` **before** `build`                                                                                      |
| `.github/workflows/ci.yml`                     | `Typecheck all packages` step in `build-test` (after Build shared, before Build all packages) + header bullet                                                                                                       |
| `docs/Specs/UI-Architecture.md`                | §9 intro names the fifth check; new §9.5 (per-workspace table, the API gap, the negative proof) and §9.5.1 (required checks: `gh api` command, ruleset path, throwaway-PR proof); §9.4 records the `knip` deviation |
| earlier AIS-122 plan + roadmap                 | stale "nothing implemented yet" status corrected; two closed gap rows removed; P0-2 marked done                                                                                                                     |

Required-check enforcement is deliberately **documentation only**: branch protection is a GitHub
repository setting, not repository code. Pull requests are not blocked until an operator runs the
command in §9.5.1.

## 5. Outcome and how to verify

```bash
pnpm typecheck     # exit 0 — six workspaces, ~31 s
pnpm quality       # unchanged: 0 violations
pnpm test:quality  # unchanged: 39/39
```

Negative proof of the new check: introduce a type error in any `src/**/*.ts` — `pnpm typecheck`
exits 2 with `TS####` and `file:line`. Verified once with
`const probeNegativeProof: number = 'not a number';` in `apps/admin/src/lib/field-errors.logic.ts`
(`TS2322` at line 23), then reverted.

To make the gate binding: run the `gh api` block in `UI-Architecture.md` §9.5.1 for `main` and `dev`,
then prove it with a throwaway PR that adds `bg-slate-800` to an admin component —
`quality-gates` must go red and the merge button must disable.

## 6. Follow-ups

- **AIS-128:** fix the 20 pre-existing type errors in `apps/api` spec/`test` files, then switch
  `apps/api` `typecheck` to `tsconfig.json` for full coverage.
- Apply the required-check settings on `main` and `dev` (operator step, §9.5.1).
- `apps/web` has no `lint` or `test` script yet (`echo … exit 0`); the dead-code and token gates cover
  it, but a real ESLint config is still open.
