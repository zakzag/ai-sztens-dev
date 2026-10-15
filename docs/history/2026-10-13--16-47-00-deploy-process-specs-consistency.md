# 2026-10-13 — Deploy-process spec consistency (image-based deploy)

## Task

Audit every document in `docs/Specs/` against the *actual* current CI/CD
pipeline, document that pipeline, and remove/repair anything that still
described the retired host-build method.

## What was inspected

- `.github/workflows/` — `images.yml`, `deploy.yml`, `ci.yml`, `codeql.yml`
- `.github/scripts/` — `deploy-plan.sh`, `render-infra-env.sh`
- `infra/docker-compose.yml`, `infra/docker-compose.local.yml`, the four
  Dockerfiles (`infra/app`, `infra/web`, `infra/admin`, `infra/monitor`)
- `infra/.env.example`, `deploy/.env.example`, `deploy/deploy.sh`,
  `deploy/README.md`

## Findings (the pipeline as it is today)

1. **`images.yml` is the only workflow with a `push` trigger.** A push to
   `dev` builds and pushes four images (`aisztens-api`, `aisztens-web`,
   `aisztens-admin`, `aisztens-monitor`) to GHCR, each tagged with an
   immutable `sha-<short>` and a mutable `<env>` (`dev`/`prod`).
2. **`deploy.yml` has no `push` trigger and no `matrix`.** It runs a `plan`
   job (`.github/scripts/deploy-plan.sh`) that emits
   `should_deploy | app_env | image_tag | ref`; the `deploy` job is
   `needs: plan` + `if: needs.plan.outputs.should_deploy == 'true'`. It
   triggers on `workflow_run` (after a successful `images.yml`) or
   `workflow_dispatch`.
3. **The droplet never builds and never receives source.** `deploy.yml`
   scp's exactly four items (compose, rendered `infra/.env`, rendered
   Caddyfile, smoke suite) and runs `docker compose pull && up -d
   --remove-orphans --force-recreate`.
4. `render-infra-env.sh` strips four workflow-owned keys
   (`APP_ENV`, `IMAGE_TAG`, `GHCR_OWNER`, `REGISTRY`) from the
   `INFRA_ENV_*` secret and appends the authoritative values last.

## Deliverable

- Created [`docs/temp/deploy-process.md`](../temp/deploy-process.md) — a
  working document with a mermaid pipeline diagram, a sequence diagram, and
  a full variable reference (trigger inputs, GitHub contexts, repo
  variables, secrets, derived values, image build args, runtime
  `infra/.env`, compose interpolation).

## Mismatch review → approved → fixed

17 mismatching statements were identified across four living specs, listed
in a `problem | description | solution` table and approved by the user.

### Changed files

| File | Change |
|---|---|
| `docs/Specs/Caddy-Reverse-Proxy.md` | §3.1 diagram `root * /srv/web` → `reverse_proxy web:80`; §4.2 diagram `rsync` → `sed`+`scp`; §6.2 items 2 & 7 updated (CI pipeline, no host `dist/`); §7.1 `deploy.yml` matrix → `plan` job; §8.1 `prune_legacy_stack()` → `up -d --remove-orphans` |
| `docs/Specs/Local-Development.md` | header bumped; dev row no longer claims a `deploy.yml` push trigger; §5 `ensure_spa_env()` bullet replaced by the `VITE_API_BASE_URL` build-arg explanation |
| `docs/Specs/Production-Runbook.md` | header rewritten (plan job, no matrix); §6 pnpm-native row no longer recommends `--build` on the droplet; §6.1 banner sample `upload_rsync` → `upload_files`; log-capture line drops `rsync`/`pnpm`; rsync-mirror bullet replaced by the 3-file `scp` description; §9.1 `deploy.yml` bullet → plan job |
| `docs/Specs/Three-Env-Verification.md` | header note added; §4 prod bootstrap no longer describes a matrix; §6 dev timing no longer `pnpm install`/`pnpm build`; §7 SPA-`localhost` and `ensure_spa_env` failure rows updated; rsync mention replaced |

No change was needed in `Infrastructure-Docker.md` (already image-based),
`Functional-Specification.md`, `Kick-off-Meeting.md`, `Brainstorming.md`, or
the email-microservice technical plan.

## Notes

- Both docs that contained a superseded `matrix` narrative also carried long
  single-line changelog headers (line 8) that exceed the normal editor line
  length; these were patched by index with a throwaway PowerShell helper
  (since removed) to avoid corrupting the surrounding text.
- `docs/temp/deploy-process.md` is intentionally temporary — see the
  milestone for the follow-up decision.
