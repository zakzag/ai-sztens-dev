# Milestone — dangling pnpm junctions and a stale lockfile config

**Date:** 2026-11-05 11:45 (Europe/Budapest)
**Type:** non-trivial bug fix (server/toolchain-side diagnosis, no code change)

## 1. Problem

`pnpm -r lint` failed in `apps/admin` with `Cannot find module '@eslint-community/eslint-utils'`. The module was present in `pnpm-lock.yaml` as a dependency of `eslint@9.39.5`, so the lockfile was not the problem — the on-disk `node_modules` tree was.

## 2. Measured evidence

| Probe | Result |
| --- | --- |
| `node_modules/.pnpm/eslint@…/node_modules/@eslint-community/eslint-utils` | `<JUNCTION>` → missing directory |
| `node_modules/.pnpm/@eslint-community+eslint-utils@4._kzf6jq6k5amkdkou4g2ebirdde` | does not exist |
| `require.resolve('@eslint-community/eslint-utils')` from eslint's folder | `MODULE_NOT_FOUND` (identical to ESLint's trace) |
| recursive dangling-link scan of `node_modules` | **178 broken links** (before) → **0** (after) |
| `pnpm install --frozen-lockfile` (pnpm 12.16.1) | `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (`overrides`) |
| same, after emptying `overrides` | `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (`packageExtensionsChecksum`) |
| same, after emptying `packageExtensions` | `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` (12 entries) |
| `pnpm install --no-frozen-lockfile` | `ERR_PNPM_NO_MATCHING_VERSION graphql@16.15.0` |

## 3. Root cause

Three independent defects compounded:

1. **Two pnpm generations owned the same tree.** The dangling links referenced pnpm's *old* path-shortening scheme (`…@4._kzf6…`), while pnpm 12.16.1 creates `…_cb2b0096…`. pnpm links only *missing* entries, so an existing-but-dangling link is never repaired — `pnpm install` printed `Done` while leaving 178 dead ends.
2. **`pnpm-lock.yaml` is stale relative to `pnpm-workspace.yaml`.** The workspace configures `overrides: {light-my-request: 6.6.0}` and a `packageExtensions` entry for `@hookform/resolvers`; the lockfile records neither, so the frozen config check rejects it before installing.
3. **The lockfile cannot be regenerated in this environment**: the registry no longer serves `graphql@16.15.0` (a transitive peer of `msw@2.15.0`), and pnpm 12's `minimumReleaseAge: 1440` guard rejects 12 pinned-but-new entries. Regenerating the lockfile was therefore not an option; the install had to be driven from the existing lockfile.

Rejected candidates: a dead direct dependency (it is eslint's own transitive dep), Windows `MAX_PATH` truncation (a short-named package was missing too), a corrupt pnpm store (tarballs were reusable), and an ESLint version problem (pinning another version would have hidden the symptom).

## 4. Implementation

No application source was modified. Actions, all with the repo-pinned `pnpm@12.16.1` via `npx`:

| Step | Command / change |
| --- | --- |
| Neutralise frozen config check | temporarily set `overrides: {}` and `packageExtensions: {}` in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:27), restored verbatim afterwards |
| Relink missing packages | `pnpm install --frozen-lockfile --prefer-offline --config.minimumReleaseAge=0` (+156 packages) |
| Force full re-link (pnpm does not repair existing links) | `… --force` (941 packages) |
| Drop last 7 stale root hoist links from the older pnpm scheme | removed via `fs.unlinkSync` |
| Restore config | `pnpm-workspace.yaml` byte-identical to HEAD; `pnpm-lock.yaml` untouched beyond its pre-existing local change |

## 5. Outcome and verification

`pnpm -r lint` completes for `apps/api`, `apps/web` and `apps/admin`, and the dangling-link scan reports `0`.

To re-verify at any time, run from the repo root:

```powershell
pnpm -r lint
```

and re-run the dangling-link scan:

```powershell
node -e "const fs=require('fs'),p=require('path');const b=[];const s=new Set();(function w(d){if(s.has(d))return;s.add(d);let e;try{e=fs.readdirSync(d,{withFileTypes:true})}catch{return}for(const x of e){const f=p.join(d,x.name);if(x.isSymbolicLink()){if(!fs.existsSync(f))b.push(f)}else if(x.isDirectory()&&x.name!=='.cache')w(f)}})('node_modules');console.log('BROKEN:',b.length)"
```

Any non-zero count means the same class of failure is back: run `npx -y pnpm@12.16.1 install --frozen-lockfile --force` (see caveats below).

## 6. Follow-ups

- **Regenerate the lockfile** in an environment where `graphql@16.15.0` resolves: the lockfile must record `overrides` and `packageExtensionsChecksum`, otherwise `--frozen-lockfile` fails for everyone and in CI.
- **Decide on the `minimumReleaseAge` policy** for `@babel/*@7.29.13`, `bare-url@2.5.6`, `electron-to-chromium@1.5.477`, `graphql@16.15.0` — either exempt them in `minimumReleaseAgeExclude` or wait out the 24h window.
- **Commit or discard** the uncommitted 158-line `packageManagerDependencies` document prepended to `pnpm-lock.yaml`.
- **Repair the toolchain**: `corepack pnpm` cannot start the pinned 12.16.1 (missing `bin/pnpm.cjs` in the corepack cache), and the default shell still resolves `pnpm 9.15.4` on Node 20 instead of `pnpm 12.16.1` on Node ≥ 24.9.
- Whenever `pnpm` major versions are mixed across machines, prefer `pnpm install --force` over a plain install when links look stale, and never trust `Done` as proof that the tree is consistent.
