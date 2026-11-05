# Milestone — `pnpm test` unblocked: supply-chain exemptions and an honest lockfile

**Date:** 2026-11-05 14:36
**Area:** tooling / dependency management
**Files:** [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:11), [`pnpm-lock.yaml`](../../pnpm-lock.yaml:1), [`.npmrc`](../../.npmrc:14), [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:445)

## 1. Problem

`pnpm test` could not run at all: the install that pnpm performs before every script died on the
`minimumReleaseAge` policy, and the pruning left `packages/shared/node_modules/jest` missing, so the
first filtered package failed with `Cannot find module …/jest/bin/jest.js`.

## 2. Evidence

```text
? Add to minimumReleaseAgeExclude … Proceed with the install? yes
Added 12 entries to minimumReleaseAgeExclude in pnpm-workspace.yaml  ← pnpm's own write
Error: ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION                        ← same 12 entries
  @babel/*@7.29.13 published 2026-11-04T16:33Z, cutoff 2026-11-04T12:56Z
  bare-url@2.5.6 / electron-to-chromium@1.5.477 / graphql@16.15.0 likewise
```

A second, hidden failure appeared when the frozen path was exercised:

```text
pnpm install --frozen-lockfile  → ERR_PNPM_LOCKFILE_CONFIG_MISMATCH (current "overrides"
                                  configuration doesn't match the value found in the lockfile)
```

`pnpm-workspace.yaml` declares `overrides: {light-my-request: 6.6.0}`; the lockfile contained
`light-my-request@6.8.0` and no `overrides:` key at all.

## 3. Root cause

| #   | Cause                                                                                                                                      | Consequence                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1   | pnpm 12 writes the exemptions itself but the install of the _same_ run verifies against the policy snapshot read at startup                | the run that answers `yes` always fails; a plain retry passes                                                     |
| 2   | the lockfile had never been regenerated after `overrides` was added to the workspace config                                                | the override was silently ignored (6.8.0 installed) **and** `--frozen-lockfile` failed for everyone, including CI |
| 3   | an IDE-bundled Node 20 + pnpm 9 sits first on `PATH` in this workspace; pnpm 9 rejects the two-document lockfile and re-resolves the graph | any command run there destroys pinning without telling the user                                                   |

Alternatives rejected: `pnpm clean --lockfile` (re-resolves and bumps unrelated packages),
downgrading `@babel/*` (churn, no security gain), raising `minimumReleaseAge` (weakens the policy
for all 1100 entries instead of 12 known ones).

## 4. Solution

- `minimumReleaseAgeExclude` keeps pnpm's `name@exact-version` entries; the comment now explains
  that a bare name would exempt **every future release** and that the pins must be deleted once the
  releases age past 24 h.
- `pnpm install --no-frozen-lockfile` (pnpm 12.16.1, Node 26) recorded `overrides:` in
  `pnpm-lock.yaml`, which also applied the pin: `light-my-request` 6.8.0 → 6.6.0,
  `cookie@2.0.1` → `set-cookie-parser@2.7.3`, `+process-warning@4.0.1`, `−@fastify/deepmerge@3.2.4`.
  The set of `name@version` keys was diffed against `HEAD`: **no other version changed**.
- `.npmrc` documents the measured fact that `manage-package-manager-versions=false` does not stop
  pnpm 12 from re-prepending its `packageManagerDependencies` document, hence pnpm 9 stays
  unsupported here.
- Spec [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:445) §5 gained the
  "answer `yes`, then rerun" pitfall with the exact two-command recipe.

## 5. Outcome and verification

| Command (Node 26 + pnpm 12.16.1)    | Expected                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm install --no-frozen-lockfile` | `✓ Lockfile passes supply-chain policies (1100 entries)`                                |
| `pnpm install --frozen-lockfile`    | `Lockfile is up to date, resolution step is skipped`                                    |
| `pnpm test`                         | exit 0 — shared 335, api-client 198, api 433 tests; ui/admin/notifications vitest green |

## 6. Follow-ups

- Remove the 12 versioned exemption pins once they are older than 24 h (2026-11-06 onwards) — they
  are temporary by design.
- Decide whether the `packageManagerDependencies` document should be committed at all: pnpm 12
  rewrites it on every install, so the lockfile is two-document by nature. Either accept pnpm ≥ 12
  as the only supported toolchain (current stance) or pin an older pnpm for reproducibility.
- CI must run pnpm ≥ 12 on Node ≥ 24; verify the workflow's toolchain matches
  `packageManager` / `engines` after this change.
