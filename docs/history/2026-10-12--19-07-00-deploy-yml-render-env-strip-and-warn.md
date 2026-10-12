# 2026-10-12 19:07 — deploy.yml: strip workflow-owned keys from INFRA_ENV secret instead of failing

## Symptom

Step "Render infra/.env from the matching secret" failed:

```
ERROR: INFRA_ENV_DEV secret defines IMAGE_TAG= which would be silently overwritten by deploy.yml.
       Remove IMAGE_TAG= from the secret (it is injected below) and re-run.
```

## Diagnosis

The step's defensive guard (added in the 00:58 deep-audit) aborts when the
secret contains any of `APP_ENV`, `IMAGE_TAG`, `GHCR_OWNER`, `REGISTRY`, the
four keys the workflow appends itself. The log also showed
`echo "GHCR_OWNER=…"` / `echo "REGISTRY=…"` printed as `***`: GitHub masks every
line of a multi-line secret, so the secret contains those lines too. Most
likely the secret was pasted from the droplet's `/opt/aisztens/infra/.env`,
which an earlier deploy had already extended. The guard reports one key per
run, so fixing the secret by hand would have taken several round-trips.

## Fix (option B: strip and warn)

| File | Change |
|---|---|
| [`.github/scripts/render-infra-env.sh`](../../.github/scripts/render-infra-env.sh) | **New.** Writes `infra/.env` from `INFRA_ENV`; drops lines defining the four owned keys (also indented, `export `, CRLF variants; comments and lookalike keys such as `IMAGE_TAG_PREFIX` are kept); emits one `::warning::` naming the removed keys (never values); appends the authoritative values; `chmod 0644` (scp-action tar needs it, step 5a re-tightens to 600). |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | The step now runs the script; `.github/scripts` added to the deploy job's sparse-checkout. |
| [`scripts/test/_render-infra-env-test.sh`](../../scripts/test/_render-infra-env-test.sh) | **New.** 10 offline cases (clean secret, all four keys, whitespace/export/CRLF, lookalikes, commented key, REGISTRY override, empty secret, bad APP_ENV, empty IMAGE_TAG, file mode). |

## Verify

```bash
bash scripts/test/_render-infra-env-test.sh      # passed=10 failed=0
python scripts/test/_deploy-yml-concurrency-audit.py
bash scripts/test/_deploy-plan-test.sh           # passed=15 failed=0
actionlint -no-color .github/workflows/deploy.yml .github/workflows/images.yml
```

On GitHub: re-run the deploy; the render step should now be green and show a
warning annotation `INFRA_ENV_DEV secret defines workflow-owned keys` listing
the removed keys.

## Follow-up

Optionally remove `APP_ENV=`, `IMAGE_TAG=`, `GHCR_OWNER=`, `REGISTRY=` from the
`INFRA_ENV_DEV` / `INFRA_ENV_PROD` secrets to silence the warning.
The old comment in `deploy/README.md` about "secret drift" (if any) still
describes the failing behaviour and should be reconciled on next edit.
