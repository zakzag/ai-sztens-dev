# 2026-10-12 16:47 — deploy.yml: skipped deploy job after a dispatched images.yml build

## Symptom

In the Actions panel the `Plan deploy` job was green but the second job
showed as skipped (⊘) with the raw title
`Deploy (${{ needs.plan.outputs.app_env }}) + smoke-test`.

## Diagnosis

- The raw `${{ … }}` title is cosmetic: `jobs.<id>.name` is evaluated only
  when the job starts; a job skipped by `if:` never starts.
- The skip itself came from our own `deploy-plan.sh`. The deploy run
  (`38278323516`) was a `workflow_run` of `images.yml` run `38277916431`,
  which was a **`workflow_dispatch` on `main`**. The script only
  auto-deployed upstream `push` on branch `dev`, so it skipped.
- The `workflow_run` payload has no upstream `inputs`, so dev/prod of a
  dispatched build could not be determined.

## Fix (option A)

| File | Change |
|---|---|
| [`.github/workflows/images.yml`](../../.github/workflows/images.yml) | Added `run-name: "Build and push images (${{ inputs.app_env \|\| 'dev' }})"`. |
| [`.github/scripts/deploy-plan.sh`](../../.github/scripts/deploy-plan.sh) | `workflow_run` branch now parses `(dev\|prod)` from `WR_TITLE` (`display_title`); any upstream event and branch is accepted; a title without the suffix skips with an explanatory reason. |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Passes `WR_TITLE`; deploy job name is now static (`Deploy + smoke-test`); header comment updated. |
| [`scripts/test/_deploy-plan-test.sh`](../../scripts/test/_deploy-plan-test.sh) | Scenarios updated (dispatch-prod upstream deploys prod; title-less upstream skips). 15/15 pass. |
| [`scripts/test/_deploy-yml-concurrency-audit.py`](../../scripts/test/_deploy-yml-concurrency-audit.py) | New check: `jobs.deploy.name` must not contain `${{ }}`. |

## Verify

```bash
python scripts/test/_deploy-yml-concurrency-audit.py
bash scripts/test/_deploy-plan-test.sh
actionlint -no-color .github/workflows/deploy.yml .github/workflows/images.yml
```

Then dispatch `Build and push images` with `app_env=dev`: the run is titled
`Build and push images (dev)` and the follow-up `Deploy to droplet` run
shows `Plan deploy` → `Deploy + smoke-test` actually executing.

## Notes

- A prod build auto-deploys to the `production` GitHub Environment; add
  required reviewers there if approval is wanted before prod rollouts.
- `workflow_run` only fires from the default branch's `deploy.yml`.
- Specs headers ([`Production-Runbook.md`](../Specs/Production-Runbook.md),
  [`Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md)) still describe
  the dev-only/push-only skip rule of the 15:09 change; the trigger rule
  above supersedes it.
