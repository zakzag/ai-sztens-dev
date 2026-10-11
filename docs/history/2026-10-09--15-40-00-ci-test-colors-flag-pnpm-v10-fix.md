# 2026-10-09 — CI fixes (two related workflow issues)

## 1. Unit-test step: drop `-- --colors=false` for pnpm v10

### Context

GitHub Actions `CI` workflow failed at the unit-test step with:

```
> @callback/api@0.0.1 test /home/runner/work/.../apps/api
> node --experimental-vm-modules node_modules/jest/bin/jest.js -- --colors=false
No tests found, exiting with code 1
  testRegex: .*\.spec\.ts$ - 9 matches
  Pattern: --colors=false - 0 matches
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @callback/api@0.0.1 test
```

The same `apps/api` test suite ran fine locally and on previous CI runs.

## Root cause

The CI step was:

```yaml
- name: Unit tests (api)
  run: pnpm --filter @callback/api test -- --colors=false
```

Two interacting facts made this fail:

1. The test script in [`apps/api/package.json:17`](apps/api/package.json:17) is a **fixed
   invocation** with no arg forwarding:
   ```json
   "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
   ```
   Any arg appended by the runner becomes a positional arg of `node`, which
   `jest` then interprets as a **test file pattern** (not a CLI flag).

2. **pnpm v10** (pinned in [`ci.yml:47`](.github/workflows/ci.yml:47)) forwards
   every token after `--` literally to the underlying command, including the
   `--` itself. So the actual process jest saw was:
   ```
   node --experimental-vm-modules node_modules/jest/bin/jest.js -- --colors=false
   ```
   Jest treated `--` and `--colors=false` as two test-path patterns. With
   `testRegex: .*\.spec\.ts$ - 9 matches` (tests exist) but
   `Pattern: --colors=false - 0 matches`, jest exited with code 1.

### Why it worked locally

`npm test -- --colors=false` (and older pnpm) **strip the `--` separator** and
only forward what's after it, so the same command line would have produced
`node ... jest.js --colors=false` — which, while not a real jest flag, would
at least have been parsed as an option, not a test path. Even locally with
pnpm, the step was probably never run with extra flags; only CI had `--`.

### Why the flag was wrong even if it had been stripped

- jest's CLI is `--colors` / `--no-colors` / `--colors=true` — not
  `--colors=false`.
- CI stdout is not a TTY, so jest already disables colors by default. The flag
  was unnecessary.
- If color suppression were ever needed, the correct places are:
  `"colors": false` in the `jest` block of `package.json`, or `NO_COLOR=1` env.

## Fix

[`ci.yml`](.github/workflows/ci.yml:69) — replaced the failing line with the
plain script invocation and added a comment explaining the trap so it isn't
re-introduced:

```yaml
- name: Unit tests (api)
  run: pnpm --filter @callback/api test
```

No code change in `apps/api/`, no change to the test script, no lockfile
bump. The 9 existing `*.spec.ts` files (e.g.
[`apps/api/src/health/health.controller.spec.ts`](apps/api/src/health/health.controller.spec.ts))
are now picked up by jest and run as intended.

## How to verify (CI test step)

- Push a commit to `dev` (or open a PR into `main`/`dev`) and confirm the
  `build-test` job in GitHub Actions goes green at the
  **Unit tests (api)** step.
- Locally: `pnpm --filter @callback/api test` should list 9+ test suites
  and report `Tests: N passed` instead of `No tests found`.

---

## 2. Workflow files: remove `upper()` from GitHub Actions expressions

### Context

`images.yml` failed to parse with:

```
Invalid workflow file: .github/workflows/images.yml#L1
(Line: 89, Col: 22): Unrecognized function: 'upper'. Located at position 33
within expression: secrets[format('INFRA_ENV_{0}', upper(inputs.app_env || 'dev'))]
```

The same broken `upper(...)` call also appeared twice in `deploy.yml`
(lines 105 and 136) — `deploy.yml` would have failed with the same
parser error the next time it was triggered.

### Root cause

GitHub Actions expressions have a small, fixed set of built-in functions:
`contains`, `startsWith`, `endsWith`, `format`, `join`, `toJSON`,
`fromJSON`, `hashFiles`. **There is no `upper()`, no `lower()`, no
case-conversion at all** (this is a long-standing GitHub limitation; the
only ways to get one are `actions/github-script` or a pre-computed env
value).

The intent of the expression was to look up either
`secrets.INFRA_ENV_DEV` or `secrets.INFRA_ENV_PROD` based on the
`app_env` input. Since that input is already type-constrained to
`dev|prod` by the workflow `inputs:` choice type (and on `push` triggers
it is empty → defaults to `dev`), the case-conversion step is redundant.

### Fix

Replaced the broken expression with a pure-equality check in all three
places:

- [`images.yml:89`](.github/workflows/images.yml:89) →
  `inputs.app_env == 'prod' && secrets.INFRA_ENV_PROD || secrets.INFRA_ENV_DEV`
- [`deploy.yml:105`](.github/workflows/deploy.yml:105) →
  `(inputs.app_env || (github.event.workflow_run.inputs.app_env || 'dev')) == 'prod' && secrets.INFRA_ENV_PROD || secrets.INFRA_ENV_DEV`
- [`deploy.yml:136`](.github/workflows/deploy.yml:136) → same as above

In each case, a multi-line comment was added at the call site explaining
the trap, so the next person does not re-introduce `upper(...)`.

### How to verify (workflow parse)

- `gh workflow view images.yml` (or push any commit) — GitHub no longer
  rejects the file with `Unrecognized function: 'upper'`.
- Trigger `images.yml` via `workflow_dispatch` with `app_env=prod` and
  confirm the produced images are tagged `…:prod` (and the
  `INFRA_ENV_PROD` secret is used). The `Resolve APP_ENV and parse DOMAIN`
  step should print a non-empty `domain=…`.
