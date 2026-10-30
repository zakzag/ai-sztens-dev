# Milestone — Deploy-process documentation consistency (image-based deploy)

**Date:** 2026-10-13

## 1. Problem / feature

`docs/Specs/` is the living documentation set for the AIsztens stack, but
several of its documents still described the **retired deploy model**:
upload the repository to the droplet, `pnpm install` + `pnpm build` on the
host, and serve SPA `dist/` folders via bind mounts. They also described a
**superseded `deploy.yml` shape** (a two-entry `matrix` with a job-level
`if:`). The pipeline had since moved to image-based delivery and a `plan`
job, so the docs actively misled anyone following them.

The task was to (a) understand and document the real pipeline, (b) list the
mismatches for approval, and (c) delete/repair the stale content.

## 2. Measured data / evidence

| Check                                                                     | Result                                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `deploy/deploy.sh` occurrences of `ensure_spa_env` / `prune_legacy_stack` | **0** (both removed)                                                                                                          |
| `.github/workflows/deploy.yml` triggers                                   | `workflow_dispatch` + `workflow_run` only — **no `push`**                                                                     |
| Workflows with a `push` trigger                                           | `images.yml`, `ci.yml` (only `images.yml` publishes images)                                                                   |
| Mismatching statements found                                              | **17**, across 4 documents                                                                                                    |
| Documents requiring no change                                             | `Infrastructure-Docker.md`, `Functional-Specification.md`, `Kick-off-Meeting.md`, `Brainstorming.md`, email-microservice plan |

## 3. Root cause / design rationale

The specs are hand-maintained while the pipeline evolved in two big jumps:
the **image-based migration (2026-10-08)** and the **matrix → `plan` job
refactor (2026-10-12 15:09)**. Each jump updated only the immediately
adjacent docs, so retired helpers and workflow shapes survived in prose and
in mermaid diagrams. Nothing enforced prose-vs-pipeline consistency, which
is why the drift accumulated silently.

## 4. Solution / implementation

- Created [`docs/temp/deploy-process.md`](../temp/deploy-process.md): the
  single accurate description of the pipeline (mermaid flow + sequence
  diagrams, and a full variable reference — trigger inputs, GitHub contexts,
  repo variables, secrets, derived values, image build args, runtime
  `infra/.env`, compose interpolation).
- Fixed the 17 mismatches in four living specs:

| File                                   | What was corrected                                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/Specs/Caddy-Reverse-Proxy.md`    | `root * /srv/{web,admin}` diagram edges → `reverse_proxy web:80` / `admin:80`; `rsync` template diagram → `sed` + `scp` of the rendered file; `deploy.yml` `matrix` → `plan` job; `prune_legacy_stack()` → `up -d --remove-orphans`; backup section no longer lists host `dist/` |
| `docs/Specs/Local-Development.md`      | dev row no longer claims a `deploy.yml` push trigger; `ensure_spa_env()` bullet replaced by the `VITE_API_BASE_URL` build-arg explanation; header bumped                                                                                                                         |
| `docs/Specs/Production-Runbook.md`     | header rewritten (plan job, no matrix); `--build` on the droplet removed from the OOM row; banner sample `[stage=upload_rsync]` → `[stage=upload_files]`; rsync-mirror bullet → 3-file `scp`; §9.1 `deploy.yml` bullet → plan job                                                |
| `docs/Specs/Three-Env-Verification.md` | §4 prod bootstrap no longer references a matrix; §6 dev timing no longer `pnpm install` / `pnpm build`; §7 SPA-`localhost` and `ensure_spa_env` rows updated                                                                                                                     |

## 5. Outcome and how to verify

The specs now describe: `images.yml` builds/pushes four GHCR images →
`workflow_run` triggers `deploy.yml` → `plan` job decides env/tag/ref →
`deploy` job scp's four small files, `docker compose pull && up -d
--remove-orphans --force-recreate`, verifies `IMAGE_TAG`, waits for the api
healthcheck and runs the smoke suite.

Verify no stale references remain:

```bash
git grep -nE 'ensure_spa_env|prune_legacy_stack' -- docs/Specs   # expect: empty
git grep -nE 'rsync|up -d --build|matrix' -- docs/Specs         # expect: only historical/legacy-labelled mentions
grep -nE 'push trigger' docs/Specs/*.md                          # expect: only "no push trigger" phrasing
```

## 6. Follow-ups

- `docs/temp/deploy-process.md` is a **temporary** artifact; decide whether
  to promote it into `docs/Specs/` (e.g. as `Deploy-Pipeline.md`, referenced
  from `Production-Runbook.md`) or drop it once the specs are trusted.
- `Caddy-Reverse-Proxy.md` §6 still proposes a "Deploy pipeline" diagram as
  future work — that content now lives in the temp doc.
- No automated check yet flags prose that contradicts the workflows; a small
  grep-based guard could be added to `scripts/test/`.
