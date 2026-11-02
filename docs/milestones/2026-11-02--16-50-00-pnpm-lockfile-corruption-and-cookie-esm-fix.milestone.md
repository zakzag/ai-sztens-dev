# pnpm-lock.yaml corruption + `cookie` ESM breakage in Jest

## 1. Problem / feature

`pnpm test` failed across the monorepo with two sequential errors:

- A pre-run dependency install failed creating a symlink
  (`fs-extra` → `fs-extra@10.1.0`, `os error 32`), after which
  `@callback/shared` could not find `node_modules/jest/bin/jest.js`.
- Once the install finished, the `@callback/api` Jest suite failed on
  `create-fastify-adapter.spec.ts` with
  `Must use import to load ES Module: …cookie@2.0.1…dist/index.js`.

## 2. Measured data / evidence

- `git show HEAD:pnpm-lock.yaml` inspection: the committed lockfile contained
  **two YAML documents** — a `---` separator at line 1 and a second one at
  line 158, followed by a second `lockfileVersion: '9.0'` block (top-level
  counts: `lockfileVersion ×2`, `importers ×2`, `packages ×2`, `snapshots ×2`).
- pnpm reported on every install:
  `Ignoring broken lockfile … expected a single document in the stream, but found more`.
- HEAD lockfile resolved `light-my-request@6.6.0` + `cookie@1.1.1`; the fresh
  re-resolution produced `light-my-request@6.8.0` (declares `cookie@^2.0.0`) →
  `cookie@2.0.1` (`"type": "module"`, `"exports": "./dist/index.js"`, `engines.node >= 22`).
- `light-my-request` is CommonJS and calls `require('cookie')`, which Jest's
  runtime cannot load from an ESM-only package → test failure.

## 3. Root cause / design rationale

The committed lockfile was corrupted (likely a bad merge/concatenation of two
lockfile generations). pnpm cannot parse a multi-document YAML as a single
lockfile, so it ignored it and re-resolved the entire tree on every install.
That caused (a) `node_modules` to drift from the lockfile — triggering the
`verifyDepsBeforeRun` install that hit a transient Windows file lock — and
(b) a silent upgrade of `light-my-request` to `6.8.0`, which pulled in the
ESM-only `cookie@2`, breaking Jest.

Alternatives considered: forcing `cookie` to `1.1.1` via override (forces a
version below `light-my-request@6.8.0`'s declared `^2.0.0` range, producing an
override warning), or reconfiguring Jest to transform `cookie` (fragile — the
project uses `ts-jest`, no babel). Pinning `light-my-request` to `6.6.0` was
chosen because it stays inside `fastify@5.12.7`'s declared `light-my-request:
^6.0.0` range and reproduces the exact previously-passing dependency graph.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| [`package.json`](../../package.json) | Added `pnpm.overrides.light-my-request = "6.6.0"`. **Update (AIS-122, 2026-11-02 19:05):** the same override now lives in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:14), because pnpm ≥11 no longer reads the `pnpm` field of `package.json`. |
| [`pnpm-lock.yaml`](../../pnpm-lock.yaml) | Deleted the corrupt file and regenerated a valid single-document lockfile via `pnpm install`. |

Resulting graph: `light-my-request@6.6.0` → `cookie@1.1.1` (CommonJS); no `cookie@2.0.1`.

## 5. Outcome and how to verify

`pnpm test` is green across all workspaces:

| Workspace | Result |
| --- | --- |
| `@callback/shared` | 9 suites / 146 tests |
| `@callback/api-client` | 5 suites / 97 tests |
| `@callback/ui` | 9 files / 71 tests |
| `@callback/admin` | 23 files / 195 tests |
| `@callback/api` | 38 suites / 360 tests |

How to verify:

```bash
pnpm install   # must NOT print "Ignoring broken lockfile"
pnpm test      # all suites green
```

## 6. Follow-ups

- Investigate how the lockfile became corrupted (bad merge? manual edit?) and
  add a CI guard (e.g. `pnpm install --frozen-lockfile`) so a broken lockfile
  fails loudly instead of being silently ignored.
- `cookie@2` (ESM-only) is a latent risk for any future CJS consumer; keep the
  `light-my-request` override until Jest/`ts-jest` supports `require(esm)` for it.
