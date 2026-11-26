# `pnpm install` aborted with `os error 32` while creating a first-time virtual-store folder

**Date:** 2026-11-05 ~13:46–13:53 (Europe/Budapest)
**Scope:** local toolchain (`node_modules`, `pnpm-lock.yaml`) — no application code changed.

## Symptom

A plain (not `--force`) `pnpm install` in the repo root stopped near the end with:

```text
Error:   x installing dependencies
  `-> Failed to create symlink at
      "...\node_modules\.pnpm\@radix-ui+react-dropdown-me_a5bea6319ba8707de8f70d3d95ffbe4f\node_modules\@radix-ui\react-menu"
      to "...\node_modules\.pnpm\@radix-ui+react-menu@2.2.1__cf640c3104773ee0118b3f88db3d70de\node_modules\@radix-ui\react-menu":
      The process cannot access the file because it is being used by another process. (os error 32)
```

The run had reported `resolved 683, reused 931, downloaded 3, added 682`, i.e. it died
very late, and `node_modules/.pnpm` afterwards still held **804** package directories.

## Diagnosis

| Check | Result |
| --- | --- |
| Failing operation | link creation inside the **brand-new** virtual folder of `@radix-ui/react-dropdown-menu` |
| New dependency? | yes — [`packages/ui/package.json`](../../packages/ui/package.json:19) added `@radix-ui/react-dropdown-menu@^2.2.1` (AIS-117 overlay primitives), so this subtree was being materialised for the first time |
| Virtual store after the abort | `804` dirs, but **zero** `react-dropdown-menu` / `react-menu` dirs — pnpm had rolled the new folder back |
| Disk | `E:` DriveType 3 (local fixed), NTFS, **712 GB free** → not space, not a network share, not a symlink limitation |
| Toolchain | `pnpm 9.15.4` on `node v20.19.2`; the repo pins `pnpm@12.16.1` / `node >=24.9.0` ([`package.json`](../../package.json:44)) |
| Processes inside `node_modules` | WebStorm TS service `37976` + `typingsInstaller.js` `37728` running from `node_modules/.pnpm/typescript@5.9.3`; tailwind LSP `34652`; **no workspace `node_modules` module mapped** in any of them, and no second pnpm worker |
| Install log anomaly | `WARN Ignoring broken lockfile … expected a single document in the stream, but found more` |

`os error 32` is `ERROR_SHARING_VIOLATION`. Because this was a **plain** install, no
existing link was being deleted — so the 2026-10-21 explanation (`--force` + an open
handle) could not apply. The failure instead hit a folder that pnpm was creating in the
same run, for the largest newly introduced package family, while 804 other folders linked
fine. That pattern points at a **transient collision** (pnpm's parallel link workers on a
shared parent directory `node_modules/@radix-ui`, possibly aggravated by a real-time
scanner/indexer), not at a persistent lock held by a specific process.

The second, more consequential defect was the **broken lockfile**: an uncommitted
158-line `packageManagerDependencies` document prepended to `pnpm-lock.yaml` made the file
two YAML documents. pnpm therefore ignored it and re-resolved the whole graph — which is
why the run "added" 682 packages instead of completing an incremental install.

## Fix

1. Stopped the IDE helpers rooted inside the tree:
   `Stop-Process -Id 37976,37728 -Force` (WebStorm respawns them on demand).
2. Plain `pnpm install --reporter=append-only` → `Packages: +941 … Done in 2m 41s`, exit 0.
3. Recognised the lockfile damage: the install had written a **new** `pnpm-lock.yaml` that
   dropped the corrupt prepended document but also silently re-resolved 4 packages
   (`@tanstack/react-query` 5.106.0 → 5.106.1, `@tanstack/query-core` likewise,
   `caniuse-lite` …820 → …822, `fast-json-stringify` 7.2.1 → 7.3.0). HEAD's lockfile is a
   valid single document, so the regeneration was unnecessary drift.
4. Reverted it: `git restore --staged --worktree --source=HEAD pnpm-lock.yaml`
   (this also cleared a stale staged deletion of the file) and re-ran a plain
   `pnpm install` → `Lockfile is up to date, resolution step is skipped`, `+8`, 7.4 s.

## Verification

| Probe | Before | After |
| --- | --- | --- |
| `pnpm install` exit code | 1 (`os error 32`) | 0 |
| `node_modules/.pnpm` dirs | 804 (missing the radix family) | 946 |
| `@radix-ui/react-dropdown-menu` link from `packages/ui` | absent | resolves |
| dangling-link scan of `node_modules` (milestone 2026-11-05--11-45 script) | n/a | **BROKEN: 0** |
| `git status -- pnpm-lock.yaml` / blob hash | corrupt 2-document file, staged deletion | clean, `53837bf…` = HEAD |
| `pnpm --filter @callback/ui test` | not runnable | **337/337 green** (41 files, incl. `dropdown-menu` 7/7, `overlay-a11y` 5/5) |
| resolved versions | — | `apps/admin` → `@tanstack/react-query@5.106.0` (lockfile-pinned), radix links intact |

## Left open (pre-existing, not caused by this fix)

- `pnpm-lock.yaml` still does not record `overrides` / `packageExtensions`, so
  `pnpm install --frozen-lockfile` keeps failing under the pinned pnpm 12 (see
  [`2026-11-05--11-45-00-pnpm-dangling-junction-lint-fix.md`](2026-11-05--11-45-00-pnpm-dangling-junction-lint-fix.md)).
- The shell resolves `pnpm 9.15.4` / `node v20.19.2` instead of the pinned
  `pnpm@12.16.1` / `node >= 24.9.0`; pnpm 9 cannot read config kept in
  `pnpm-workspace.yaml`, so any lockfile it writes is missing that config.
- No `pnpm-lock.yaml` may be corrupted again by hand-editing: a second YAML document makes
  pnpm silently discard the file, and every re-resolution then lands as unreviewed bumps.
