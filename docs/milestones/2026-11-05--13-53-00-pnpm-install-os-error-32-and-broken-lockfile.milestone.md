# Milestone — `pnpm install` `os error 32` and a silently discarded lockfile

**Date:** 2026-11-05 13:53 (Europe/Budapest)
**Type:** non-trivial bug fix (toolchain-side diagnosis, no application code change)

## 1. Problem

`pnpm install` aborted at the link stage with
`Failed to create symlink … The process cannot access the file because it is being used by another process. (os error 32)`
(`ERROR_SHARING_VIOLATION`), leaving a half-built `node_modules`. A second, hidden defect
surfaced in the same log: pnpm reported
`WARN Ignoring broken lockfile … expected a single document in the stream, but found more`.

## 2. Measured evidence

| Probe | Result |
| --- | --- |
| Failing link | inside the **brand-new** folder `@radix-ui+react-dropdown-me_a5bea…` → `@radix-ui+react-menu@2.2.1__cf640…` |
| Install mode | plain install (**not** `--force`) — no delete/replace step |
| `.pnpm` after abort | `804` dirs, **zero** `react-dropdown-menu` / `react-menu` dirs |
| New dependency | `@radix-ui/react-dropdown-menu@^2.2.1` added by AIS-117 ([`packages/ui/package.json`](../../packages/ui/package.json:19)) |
| Disk `E:` | DriveType 3, NTFS, 712 GB free |
| Toolchain | `pnpm 9.15.4`, `node v20.19.2`; repo pins `pnpm@12.16.1`, `node >=24.9.0` |
| Processes in the tree | WebStorm TS service `37976` + `typingsInstaller.js` `37728` from `.pnpm/typescript@5.9.3`; **no workspace modules mapped**; no second pnpm worker |
| Lockfile | on-disk file was **two YAML documents** (158-line `packageManagerDependencies` doc prepended), so pnpm ignored it |

## 3. Root cause

Two independent defects:

1. **Transient Windows collision on a first-time virtual folder.** The panic hit a folder
   pnpm was creating in the same run, for the newly added, largest-fan-out package family
   (`react-dropdown-menu` → `menu`/`popper`/`slot`), while 804 other folders linked fine.
   With a plain install nothing is deleted, so the 2026-10-21 "open handle blocks
   `--force`" explanation cannot apply. The remaining explanations are pnpm's parallel
   link workers colliding on the shared parent `node_modules/@radix-ui`, aggravated by a
   real-time scanner/indexer; both are transient.
   Rejected: a persistent lock held by the IDE (it held no workspace module and the retry
   succeeded immediately after), disk/space/network limitations (local NTFS, 712 GB
   free), and a stale hoist link (the dangling-link scan was already clean).
2. **An unparseable lockfile silently disables pinning.** A second YAML document makes
   pnpm discard `pnpm-lock.yaml` entirely and re-resolve the graph. That is why the run
   "added" 682 packages instead of finishing incrementally, and why the abort happened at
   all: a full re-link maximises the collision window.

## 4. Implementation

| Step | Command / change |
| --- | --- |
| Release IDE helpers | `Stop-Process -Id 37976,37728 -Force` |
| Resume the half-built tree | `pnpm install --reporter=append-only` → `+941`, 2 m 41 s, exit 0 |
| Detect the silent drift | the run rewrote the lockfile and bumped 4 packages (`@tanstack/react-query`/`query-core` 5.106.0→5.106.1, `caniuse-lite` …820→…822, `fast-json-stringify` 7.2.1→7.3.0) |
| Revert the drift | `git restore --staged --worktree --source=HEAD pnpm-lock.yaml` (also cleared a stale staged deletion) |
| Re-pin the tree | `pnpm install` → `Lockfile is up to date, resolution step is skipped`, `+8`, 7.4 s |

## 5. Outcome and how to verify

`node_modules` is consistent with HEAD's lockfile and fully linked; the locked-file panic
is gone.

```powershell
# 1. lockfile must be byte-identical to HEAD and tracked
git status --porcelain -- pnpm-lock.yaml     # expect: empty
git hash-object pnpm-lock.yaml               # expect: 53837bf233daaae93fbb2927b67ef0766e2711d4

# 2. no dangling links (same scan as milestone 2026-11-05--11-45)
node -e "const fs=require('fs'),p=require('path');const b=[];const s=new Set();(function w(d){if(s.has(d))return;s.add(d);let e;try{e=fs.readdirSync(d,{withFileTypes:true})}catch{return}for(const x of e){const f=p.join(d,x.name);if(x.isSymbolicLink()){if(!fs.existsSync(f))b.push(f)}else if(x.isDirectory()&&x.name!=='.cache')w(f)}})('node_modules');console.log('BROKEN:',b.length)"
# expect: BROKEN: 0

# 3. the subtree that failed is usable
pnpm --filter @callback/ui test               # expect: 337 passed (41 files)
```

## 6. Follow-ups

- **Never hand-edit `pnpm-lock.yaml` into a second YAML document.** pnpm silently ignores
  the file, so pinning is lost and every install re-resolves — which is exactly how the
  unreviewed bumps appeared. `pnpm install` printing `Lockfile is up to date, resolution
  step is skipped` is the fast proof that the lockfile is being honoured.
- **Fix the toolchain mismatch.** The shell resolves `pnpm 9.15.4` / `node v20.19.2`, while
  the repo pins `pnpm@12.16.1` / `node >=24.9.0`. pnpm 9 ignores config in
  `pnpm-workspace.yaml`, so a lockfile it writes is missing `overrides` /
  `packageExtensions` and `--frozen-lockfile` keeps failing for everyone (carried over from
  the 2026-11-05 11:45 milestone).
- **Stale duplicate virtual dirs remain** (`@tanstack+react-query@5.106.1`,
  `caniuse-lite@1.0.30001822`, `fast-json-stringify@7.3.0`): unreferenced, harmless, and
  removable with `pnpm store prune` plus a fresh `pnpm install`.
- When the panic repeats at a *different* random path, treat it as the transient race and
  simply retry; when it repeats at the *same* path, hunt the holding handle.
