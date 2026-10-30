# Deploy metadata: build date + commit hash in the SPAs and `/healthz`

**Date:** 2026-10-12 13:20
**Plan:** [`docs/plans/2026-10-12-deploy-meta-version-display-plan.md`](../plans/2026-10-12-deploy-meta-version-display-plan.md)
**Milestone:** [`docs/milestones/2026-10-12--13-20-00-deploy-meta-version-display.milestone.md`](../milestones/2026-10-12--13-20-00-deploy-meta-version-display.milestone.md)

## 1. Why

Before this change there was **no way to tell which revision a running container
served**. The `sha-<7>` image tag lives only on the host (`docker compose ps`),
so a browser tab, a `/healthz` probe or a support screenshot could not be tied
back to a commit. This was the exact gap that made the 2026-10-11 incident
(`docs/milestones/2026-10-11--23-59-45-deploy-yml-parse-failure-fix.milestone.md`)
hard to triage: the droplet silently kept serving `sha-3a8f5b6`.

Decision (from the plan): the **image build time** of `images.yml` is the date
source, the **full 40-char `github.sha`** is the hash, and api / web / admin all
report the _same_ values for a given revision.

## 2. Data flow

```
images.yml  ──meta step──►  commit_hash (github.sha, 40 chars)
                            deploy_date (date -u +%Y-%m-%dT%H:%M:%SZ)
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        ▼                         ▼                          ▼
  api build-args            web build-args            admin build-args
  COMMIT_HASH               VITE_COMMIT_HASH          VITE_COMMIT_HASH
  DEPLOY_DATE               VITE_DEPLOY_DATE          VITE_DEPLOY_DATE
        │                         │                          │
  runtime ENV               Vite bundle (build stage)  Vite bundle
        ▼                         ▼                          ▼
  GET /healthz              HomePage footer            DashboardPage footer
  commitHash/deployDate     BuildInfoFooter            BuildInfoFooter
```

## 3. Changed files

| File                                                                                                                                                                                                                                                                         | Change                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.github/workflows/images.yml`](../../.github/workflows/images.yml:147)                                                                                                                                                                                                     | `Compute image metadata` step gained `commit_hash` + `deploy_date` outputs; the api / web / admin build steps pass them as build args (the `monitor` image deliberately does not).                                                                                                                    |
| [`infra/app/Dockerfile`](../../infra/app/Dockerfile:64)                                                                                                                                                                                                                      | `ARG COMMIT_HASH` / `ARG DEPLOY_DATE` re-declared **in the runtime stage** and exported as `ENV`, header documents them as optional.                                                                                                                                                                  |
| [`infra/web/Dockerfile`](../../infra/web/Dockerfile:51)                                                                                                                                                                                                                      | `ARG VITE_DEPLOY_DATE` / `ARG VITE_COMMIT_HASH` added to the build stage and merged into the existing `ENV` block so Vite bakes them.                                                                                                                                                                 |
| [`infra/admin/Dockerfile`](../../infra/admin/Dockerfile:43)                                                                                                                                                                                                                  | Same as web (mirror file, intentionally duplicated).                                                                                                                                                                                                                                                  |
| [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts:12)                                                                                                                                                                              | Extracted `HealthStatus` interface; `check()` now returns `deployDate` + `commitHash` read from `process.env` at call time (`?? null`).                                                                                                                                                               |
| [`apps/api/src/health/health.controller.spec.ts`](../../apps/api/src/health/health.controller.spec.ts:1)                                                                                                                                                                     | +5 test cases; env vars snapshotted in `beforeEach` / restored in `afterEach` so the suite never leaks state.                                                                                                                                                                                         |
| [`apps/api/test/health.e2e-spec.ts`](../../apps/api/test/health.e2e-spec.ts:35)                                                                                                                                                                                              | `HealthBody` guard now requires `deployDate`/`commitHash` (`string \| null`) and asserts both are `null` under a bare Jest run.                                                                                                                                                                       |
| [`packages/shared/src/lib/build-info.ts`](../../packages/shared/src/lib/build-info.ts:1)                                                                                                                                                                                     | **New.** Pure, framework-free helpers: `normalizeBuildValue`, `formatDeployDate`, `formatCommitHash` — the **single** implementation, exported from [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts:12) and imported by both SPAs (which already depended on `@callback/shared`). |
| [`packages/shared/test/build-info.test.mjs`](../../packages/shared/test/build-info.test.mjs:1)                                                                                                                                                                               | **New.** 10 unit tests via Node's built-in runner (`node --test`), asserting against the compiled `dist/` output.                                                                                                                                                                                     |
| [`packages/shared/package.json`](../../packages/shared/package.json:17)                                                                                                                                                                                                      | `test` script → `pnpm build && node --test test/` (no new dependencies, no lockfile change).                                                                                                                                                                                                          |
| [`package.json`](../../package.json:12)                                                                                                                                                                                                                                      | Root `test` script now runs the shared suite **and** the api suite.                                                                                                                                                                                                                                   |
| [`apps/web/src/components/BuildInfoFooter.tsx`](../../apps/web/src/components/BuildInfoFooter.tsx:1)                                                                                                                                                                         | **New.** Renders `Telepítve: … · Verzió: …`, `—` placeholders when the env vars are absent; logic from `@callback/shared`.                                                                                                                                                                            |
| [`apps/web/src/pages/HomePage.tsx`](../../apps/web/src/pages/HomePage.tsx:3)                                                                                                                                                                                                 | Renders `<BuildInfoFooter />` below the feature grid.                                                                                                                                                                                                                                                 |
| [`apps/web/src/vite-env.d.ts`](../../apps/web/src/vite-env.d.ts:1)                                                                                                                                                                                                           | Global `ImportMetaEnv` augmentation types the two optional `VITE_*` vars.                                                                                                                                                                                                                             |
| [`apps/admin/src/components/BuildInfoFooter.tsx`](../../apps/admin/src/components/BuildInfoFooter.tsx:1), [`apps/admin/src/pages/DashboardPage.tsx`](../../apps/admin/src/pages/DashboardPage.tsx:4), [`apps/admin/src/vite-env.d.ts`](../../apps/admin/src/vite-env.d.ts:1) | Same wiring for the dashboard (footer at the bottom of `/`).                                                                                                                                                                                                                                          |
| [`apps/api/.env.example`](../../apps/api/.env.example:38)                                                                                                                                                                                                                    | Documents `DEPLOY_DATE` / `COMMIT_HASH` as read-only image metadata that must **not** be set in a `.env`.                                                                                                                                                                                             |
| [`apps/web/.env.example`](../../apps/web/.env.example:29), [`apps/admin/.env.example`](../../apps/admin/.env.example:29)                                                                                                                                                     | Same note for the two `VITE_*` vars.                                                                                                                                                                                                                                                                  |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:91)                                                                                                                                                                                              | §4.2 documents the new `/healthz` shape, the `grep -o '"commitHash":"…"'` revision check, and the SPA build-info rows.                                                                                                                                                                                |
| [`docs/Specs/Infrastructure-Docker.md`](../../docs/Specs/Infrastructure-Docker.md:109)                                                                                                                                                                                       | New §6.1: meta outputs → build args → Dockerfile → UI mapping table.                                                                                                                                                                                                                                  |
| [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:180)                                                                                                                                                                                     | §2.4.1 states that `deployDate`/`commitHash` are `null` locally, with the shape written out.                                                                                                                                                                                                          |

`docs/Specs/Functional-Specification.md` was **not** touched: it is still an
unfilled template (placeholder table rows, `[Dátum]` header), so it does not yet
document page content.

## 4. Verification performed

| Check                            | Command                                                                                                                                                                     | Result                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Shared unit tests                | `pnpm --filter @callback/shared test`                                                                                                                                       | 3 suites / **10 tests pass**                                                                  |
| API unit tests                   | `pnpm --filter @callback/api test`                                                                                                                                          | 9 suites / **60 tests pass** (5 new health cases)                                             |
| Both suites via root script      | `pnpm test`                                                                                                                                                                 | **70 tests pass**                                                                             |
| API e2e                          | `pnpm --filter @callback/api test:e2e`                                                                                                                                      | 4 suites / **14 tests pass** (`AppModule` gate self-skips on Node 20.19, pre-existing)        |
| API lint                         | `pnpm --filter @callback/api lint`                                                                                                                                          | clean (`--fix`, no output)                                                                    |
| SPA typecheck + build            | `pnpm --filter @callback/web build` + `@callback/admin build`                                                                                                               | `tsc --noEmit` + `vite build` both succeed, with the footer importing from `@callback/shared` |
| **Vite actually bakes the vars** | `set VITE_DEPLOY_DATE=… && set VITE_COMMIT_HASH=0123… && pnpm --filter @callback/web build` (and `… admin build`), then `findstr` for the hash in `apps/*/dist/assets/*.js` | hash found in **both** emitted bundles                                                        |

The last row is the important one: it proves the `ARG` → `ENV` → `import.meta.env`
chain works without having to build a Docker image. Docker-level verification
(`docker build --build-arg …`) still only happens in CI, because there is no
local Docker build for these images.

## 5. Post-deploy verification (operator)

```bash
# API: the SHA must equal the deployed revision, the date must be the CI build time
curl -s https://api.aisztens.hu/healthz
# → {"status":"oks","deployDate":"2026-10-12T12:34:56Z","commitHash":"<40 hex>",...}

# SPAs: the footer at the bottom of the page shows the same date + hash
curl -s https://web.aisztens.hu/ | grep -o 'build-info'   # (footer is client-rendered)
# Manual: open https://web.aisztens.hu/ and https://admin.aisztens.hu/ (after login)

# Local, no build metadata → must degrade, not break
scripts/dev-stack.sh up && curl -s http://localhost:3000/healthz
# → {"status":"oks","deployDate":null,"commitHash":null,...}
```

## 6. Known limitations / follow-ups

- **The two SPA _components_ are still duplicated** (only the logic is shared).
  The `<p>` markup, Tailwind spacing and Hungarian labels differ per page, and
  the two SPAs deliberately build as separate images; the shared surface is the
  behaviour, which is what can actually drift. Extracting a React component into
  `packages/shared` would force a `react` peer dependency onto the API package
  for no benefit.
- **`packages/shared` has no jest.** Adding jest/ts-jest would have meant new
  devDependencies plus a `pnpm-lock.yaml` rewrite (a `pnpm install` here even
  demanded a full `node_modules` purge), so the suite uses Node 20's built-in
  runner instead. Trade-off: it tests the compiled `dist/` artefact, and it has
  no coverage reporting. If the SHAs of the npm deps are ever refreshed, a mock
  `jest.config` can be added and the spec ported in minutes.
- **`apps/web` / `apps/admin` still have no test runner of their own**
  (`"test": "echo … && exit 0"`), so the JSX in `BuildInfoFooter.tsx` is covered
  only by `tsc --noEmit` plus the bundle grep above. The logic — the part that
  can realistically regress — is now covered by the shared suite.
- **No CI smoke assertion** yet that the _deployed_ `/healthz.commitHash` equals
  `github.sha`. `deploy.yml` already curls `/healthz` for the status code; the
  hash comparison would be a cheap follow-up that would have caught the
  2026-10-11 stale-image incident automatically.
- **`/healthz` is unauthenticated**, so `deployDate`/`commitHash` become public.
  Both are already public via GHCR tags and the commit history, so this was
  judged acceptable.
