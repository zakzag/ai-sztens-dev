# `pnpm test` red: supply-chain exemptions + the lockfile finally records `overrides`

**Date:** 2026-11-05 14:36
**Scope:** tooling / dependency management (no application code touched)

## Symptom

`pnpm test` never reached a test runner. The pre-script install aborted twice and then the
first package (`@callback/shared`) failed with a module error:

```text
? Add to minimumReleaseAgeExclude in pnpm-workspace.yaml and proceed with the install? yes
Added 12 entries to minimumReleaseAgeExclude in pnpm-workspace.yaml …
Error: ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION   (the same 12 entries it had just written)
[WARN] The install that runs before scripts failed, so your node_modules may be out of sync
Error: Cannot find module '…\packages\shared\node_modules\jest\bin\jest.js'
```

The `jest` error was collateral: the aborted install had pruned `packages/shared/node_modules`.

## Root cause (two independent defects)

1. **The exemption prompt is a one-run trap.** pnpm 12 appends the
   `name@exact-version` entries to `minimumReleaseAgeExclude`, but the install it then runs
   verifies against the policy snapshot loaded at startup — so the _same_ run still fails with
   the entries it just wrote. A plain retry passes. The 12 entries were published
   2026-11-04 14:21–23:02Z, i.e. inside the `minimumReleaseAge: 1440` (24 h) window whose cutoff
   was 2026-11-04T12:56Z.
2. **The lockfile never recorded `overrides`.** [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:39)
   pins `light-my-request: 6.6.0`, yet `pnpm-lock.yaml` contained `light-my-request@6.8.0` and no
   `overrides:` key. Non-frozen installs silently ignored the pin (so the documented
   "deterministic inject-based tests" guarantee did not hold), and `--frozen-lockfile` — the CI
   path — died with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` before installing anything.

## Fix

- Kept pnpm's versioned exemptions and rewrote the surrounding comment in
  [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:11) to state that `name@version` pins must stay
  versioned (a bare name would exempt every future release) and that they are to be deleted once
  the releases age past the cutoff.
- `pnpm install --no-frozen-lockfile` with pnpm 12.16.1 on Node 26 — the toolchain
  `package.json` declares — wrote `overrides:` into the lockfile. That also applied the pin:
  `light-my-request` 6.8.0 → 6.6.0, `cookie@2.0.1` → `set-cookie-parser@2.7.3`,
  `process-warning@4.0.1` added, `@fastify/deepmerge@3.2.4` dropped. No other package version
  changed (verified by diffing the set of `name@version` keys, HEAD vs worktree).
- Documented the retry trap in [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:445)
  §5, and the measured behaviour of `manage-package-manager-versions=false` in
  [`.npmrc`](../../.npmrc:20): pnpm 12 re-prepends its `packageManagerDependencies` document on
  every install, so pnpm 9 is an unsupported toolchain for this repo.

## Verification

| Command                                    | Result                                                   |
| ------------------------------------------ | -------------------------------------------------------- |
| `pnpm install --no-frozen-lockfile`        | `✓ Lockfile passes supply-chain policies (1100 entries)` |
| `pnpm install --frozen-lockfile` (CI=true) | `Lockfile is up to date, resolution step is skipped`     |
| `pnpm test`                                | exit 0 — six packages green (see counts below)           |

Test totals: shared 22 suites / 335 tests, api-client 9 / 198, notifications 9 files,
ui 41 files, admin 37 files, api 39 suites / 433 tests.

## Notes for the next reader

- The IDE-bundled terminal ships Node 20.19.2 + pnpm 9.15.4 on `PATH`
  (`…\JetBrains\…\zoocode-node\node-v20.19.2-win-x64`), which is **not** this project's toolchain
  and cannot read the two-document lockfile. Every command above was run with
  `C:\Progs\nodejs` first on `PATH` plus `npx pnpm@12.16.1`.
- Obsolete follow-up from `docs/milestones/2026-11-05--11-45-00-pnpm-dangling-junctions-and-stale-lockfile.milestone.md`
  is resolved: the lockfile now records `overrides`, and the `minimumReleaseAge` decision is taken
  (exempt, with a removal reminder).
