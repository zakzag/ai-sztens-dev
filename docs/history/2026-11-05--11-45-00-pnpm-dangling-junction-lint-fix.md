# `pnpm -r lint` failing with `Cannot find module '@eslint-community/eslint-utils'`

**Date:** 2026-11-05 ~11:20–11:45 (Europe/Budapest)
**Scope:** developer environment (`node_modules`), no application code changed
**Symptom reported:** `pnpm -r lint` → `apps/admin` → `ESLint: 9.39.5 Error: Cannot find module '@eslint-community/eslint-utils'`

## What was actually wrong

Nothing in the code. The `node_modules` tree was out of sync with [`pnpm-lock.yaml`](../../pnpm-lock.yaml:1):

| Observation | Result |
| --- | --- |
| `node_modules/.pnpm/eslint@9.39.5_jiti@2.7.0/node_modules/@eslint-community/eslint-utils` | a `<JUNCTION>` whose target did not exist |
| `node_modules/.pnpm/@eslint-community+eslint-utils@4._kzf6jq6k5amkdkou4g2ebirdde` | `File Not Found` |
| `node -e require.resolve('@eslint-community/eslint-utils', …)` from eslint's own folder | reproduced ESLint's exact `MODULE_NOT_FOUND` |
| full scan of `node_modules` for dangling links | **178 broken links** |

So ESLint's error was only the *first* casualty; `@babel/core`, `@eslint/js`, `@fastify/*`, `@radix-ui/*`, `@angular-devkit/*` and many more were missing the same way.

## Why the tree was broken

1. **`pnpm 12` computed virtual-store dir names that the existing tree did not use.** The broken links pointed at the *old* pnpm truncation scheme (e.g. `@eslint-community+eslint-utils@4._kzf6…`), while pnpm 12.16.1 writes `@eslint-community+eslint-ut_cb2b0096…`. pnpm only *adds* missing links; it does not repair links that already exist but point at vanished directories. A plain `pnpm install` therefore reported success while leaving links dangling.
2. **The lockfile is stale relative to `pnpm-workspace.yaml`.** `pnpm install --frozen-lockfile` aborted twice before touching `node_modules`:
   - `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on `overrides` (`light-my-request: 6.6.0` is configured, the lockfile pins `6.8.0` and records no `overrides` at all),
   - then again on `packageExtensionsChecksum` (the `@hookform/resolvers` → `zod` extension is configured, the lockfile records no checksum).
3. **`pnpm 12`'s supply-chain guard rejects 12 current lockfile entries** (`@babel/*@7.29.13`, `bare-url@2.5.6`, `electron-to-chromium@1.5.477`, `graphql@16.15.0`) because they were published inside the `minimumReleaseAge: 1440` window.
4. **`pnpm install --no-frozen-lockfile` cannot re-resolve here**, because the registry has no `graphql@16.15.0` (`ERR_PNPM_NO_MATCHING_VERSION`, latest 16.x is `16.14.2`). The lockfile could not simply be regenerated.
5. The shell used `pnpm 9.15.4` on Node `v20.19.2`, while the repo pins `pnpm@12.16.1` / `node >= 24.9.0`; `corepack pnpm` was itself broken (`…\corepack\v1\pnpm\12.16.1\bin\pnpm.cjs` missing).

## Repair performed

Repair-only steps, all with pnpm 12.16.1 via `npx -y pnpm@12.16.1`:

1. Temporarily emptied `overrides` and `packageExtensions` in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:27) so the frozen config check matched the lockfile — both blocks were restored verbatim afterwards.
2. `pnpm install --frozen-lockfile --prefer-offline --config.minimumReleaseAge=0` → relinked the missing packages (156 packages) without touching the lockfile.
3. Still 27 dangling links remained (pnpm 12 does not rewrite pre-existing links), so `… --force` was run to re-link the whole tree (941 packages, ~12 min).
4. Removed the 7 last stale root-level hoist links left by the older pnpm's naming scheme.
5. Restored `pnpm-workspace.yaml`; confirmed `git diff` is clean for that file and that `pnpm-lock.yaml` is byte-for-byte in the state it was found in.

## Verification

```text
pnpm -r lint
  apps/api lint   Done
  apps/web lint   Done
  apps/admin lint Done
```

Dangling-link scan of `node_modules` (same script as the diagnosis, reported 178 before): **0 broken links**.

## Left open (pre-existing, not caused by this repair)

- `pnpm-lock.yaml` does not record `overrides` / `packageExtensions`, so `pnpm install --frozen-lockfile` fails for every teammate until the lockfile is regenerated in an environment where `graphql@16.15.0` resolves.
- The working copy has an uncommitted 158-line `packageManagerDependencies` document prepended to `pnpm-lock.yaml`.
- The `minimumReleaseAge: 1440` policy rejects 12 current entries; they need exemption or need to age past 24h before CI can install frozen.
- `corepack pnpm` cannot run the pinned `pnpm@12.16.1`; its cache directory needs reinstalling.
- The default shell resolves `pnpm 9.15.4` / Node `20`, not the pinned toolchain.
