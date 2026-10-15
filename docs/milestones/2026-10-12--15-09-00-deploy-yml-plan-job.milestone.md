# Milestone — deploy.yml: `matrix` → `plan` job (third `Unrecognized named-value` round, 2026-10-12)

## 1. Problem

`.github/workflows/deploy.yml` failed its workflow-file parse with
`Unrecognized named-value: 'matrix'` at line 116, in the job-level
`if:`. This was the third `Unrecognized named-value` failure on the
same file in two days (`env` on 14:15, `matrix` on 14:50, `matrix` on
15:09). The previous two fixes had only shifted the `matrix.app_env`
read from one disallowed slot to another. Beyond the parse error, four
latent runtime bugs would have hit the next push even with a green
parse: a `push` vs `images.yml` race, a wrong `IMAGE_TAG` on
`workflow_run`, an env-decision expression that silently falls
through to branch-name, and a missing smoke script on the droplet.

## 2. Evidence

GitHub Actions error on the failed `main` push (verbatim):

```
Invalid workflow file: .github/workflows/deploy.yml#L1
(Line: 116, Col: 9): Unrecognized named-value: 'matrix'.
```

Latent bugs observed in the pre-fix file (audit pass):

| # | Site | Bug |
|---|---|---|
| 1 | `on.push.branches: [dev]` AND `on.workflow_run` | Both fire on a push; deploy races the build |
| 2 | `image_tag = sha-${GITHUB_SHA::7}` | On `workflow_run`, `GITHUB_SHA` is the default-branch HEAD, not the commit images.yml built — would `pull manifest unknown` |
| 3 | `github.event.workflow_run.inputs.app_env` | This field does not exist; the branch always falls through to `head_branch`, coupling "which env" to "which branch" |
| 4 | Step 9 runs `bash scripts/test/stack-smoke.sh` on the droplet | The script is neither shipped (step 5 scp) nor in the `sparse-checkout` list → first deploy would fail with `No such file` |

## 3. Root cause / design rationale

`jobs.<id>.if` is evaluated before the matrix is expanded. Allowed
contexts in `if:` are only `github | inputs | vars | needs`. The only
context allowed in **every** site that needs to read `APP_ENV`
(`if:`, `name:`, `environment:`, `concurrency.group`, and the
`step.env:` reads) is `needs.*` — and `needs.*` only exists after a
`plan` job has run. The 14:15 and 14:50 fixes tried to live inside
`matrix` / `env`, which are not in the `if:` allowlist; no further
in-place edit can put a value into the `if:` slot.

Two safe fixes were considered:

- **Option A (chosen):** introduce a `plan` job that runs a small
  shell script and exposes `should_deploy | app_env | image_tag | ref`
  via `needs.plan.outputs.*`. The `deploy` job then uses
  `needs.plan.outputs.*` everywhere. No `matrix`, no `env.*`, no
  `push` trigger (the deploy follows `images.yml` via `workflow_run`).
  The plan script is unit-tested offline (15 scenarios), and the
  workflow structure is asserted by an offline audit script.
- **Option B (rejected):** keep the matrix, but move the
  trigger-decoding `if:` out of the workflow file and into a small
  `step[].id` of the same job (using `steps.<id>.outputs.app_env`).
  Works in theory, but `steps.*` is **also** not allowed in
  `jobs.<id>.if` (same allowlist as `matrix`), so it doesn't actually
  solve the parse error. Rejected.

## 4. Solution / implementation

| File | Change |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1) | Removed `push` trigger and the `strategy.matrix` block; added `permissions: contents: read`; added a `plan` job (lines 99–141) that runs `.github/scripts/deploy-plan.sh`; rewrote `jobs.deploy` to use `needs: plan`, `if:` on `needs.plan.outputs.should_deploy`, and `matrix.app_env` replaced by `needs.plan.outputs.app_env` / `.image_tag` / `.ref`; added a job-level `concurrency: deploy-${{ needs.plan.outputs.app_env }}` (the `needs.*` context is allowed in `jobs.<id>.concurrency.group`); checkout now uses `ref:` from plan; scp step now also ships `scripts/test/stack-smoke.sh` + `scripts/test/lib` so the smoke step has its inputs. |
| [`.github/scripts/deploy-plan.sh`](../../.github/scripts/deploy-plan.sh:1) | **New.** ~80-line shell decision function. Skips on workflow_run from dispatch / non-dev branch / non-success conclusion. Validates app_env and image_tag override. Writes to `$GITHUB_OUTPUT`. |
| [`scripts/test/_deploy-plan-test.sh`](../../scripts/test/_deploy-plan-test.sh:1) | **New.** 15 scenarios: dispatch (default / override / invalid tag / invalid env / bad SHA / empty), workflow_run (push on dev / failure / cancelled / from dispatch / other branch / missing head_sha), unsupported event, GITHUB_OUTPUT file mode. All 15 pass. |
| [`scripts/test/_deploy-yml-concurrency-audit.py`](../../scripts/test/_deploy-yml-concurrency-audit.py:1) | Rewritten. Asserts: YAML parses; no workflow-level `concurrency:`; no `matrix.` anywhere in non-comment code; every `jobs.<id>.if` expression uses only `{github,inputs,vars,needs}`; no `push` trigger; `jobs.deploy.needs == "plan"`; INFRA_ENV grep ≥ 3. |
| [`scripts/test/_deploy-yml-matrix-pick-test.py`](../../scripts/test/_deploy-yml-matrix-pick-test.py:1) | **Deleted.** Subsumed by `_deploy-plan-test.sh`. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1) | `Utolsó frissítés` bullet prepended (plan-job refactor); §9.1 deploy.yml bullet rewritten. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1) | `Utolsó frissítés` bullet prepended; §7.1 deploy.yml bullet rewritten. |
| [`docs/history/2026-10-12--15-09-00-deploy-yml-plan-job.md`](../history/2026-10-12--15-09-00-deploy-yml-plan-job.md:1) | Day-to-day narrative. |
| [`plans/2026-10-12--15-09-00-deploy-yml-plan-job.md`](../plans/2026-10-12--15-09-00-deploy-yml-plan-job.md:1) | Design plan. |

## 5. Outcome and how to verify

- YAML parse: `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8'))"` → exits 0.
- Structural audit: `python scripts/test/_deploy-yml-concurrency-audit.py` → "All post-fix verifications passed." (exit 0).
- Plan-script unit test: `bash scripts/test/_deploy-plan-test.sh` → "passed=15 failed=0".
- actionlint: `actionlint -no-color .github/workflows/deploy.yml .github/workflows/images.yml` → exit 0.
- Push to `dev` (or `workflow_dispatch` with `app_env=dev`): the
  `plan` job emits `should_deploy=true app_env=dev image_tag=sha-<7> ref=<sha>`,
  the `deploy` job runs under the `dev` GitHub Environment, the
  `verify-tag` step reports "All 4 application services are running
  sha-<7>", and the smoke step runs against the live deployment
  (the smoke script is now in `sparse-checkout` and is shipped by the
  scp step).
- `workflow_dispatch` with `app_env=prod` and an `image_tag` of a
  previously-built SHA is the first-class rollback path: it bypasses
  `images.yml` entirely and pins the droplet to that exact tag.

## 6. Follow-ups (deferred)

- **Prod auto-deploy** when the prod droplet exists. The plan script
  will need a `WR_EVENT == 'push' && WR_HEAD_BRANCH == 'prod'` branch
  (mirroring today's `dev` branch), and `images.yml` will need a
  `prod` push branch and a separate `GHCR_PACKAGE_PREFIX` (or
  per-env image names) so prod-built images don't collide with dev's
  `dev` tag.
- **`actionlint` in pre-PR CI** would have caught all three
  `Unrecognized named-value` failures at PR time. Same
  recommendation as the 14:50 milestone.
- **Smoke-step hosting**: today the smoke script is shipped via the
  same scp step as the runtime files (so the droplet has it only for
  the duration of one deploy and then a subsequent deploy may
  clobber it). For a long-term CI smoke runbook, consider
  materialising the script on the droplet once (via `bootstrap.sh`)
  and re-running it from a stable path; the current scp-ship approach
  is fine for the "one deploy, one smoke run" cadence but is not
  intended to be the script's home on the host.
