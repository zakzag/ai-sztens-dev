# Milestone: deploy metadata (build date + commit hash) in the SPAs and `/healthz`

**Date:** 2026-10-12 13:20
**Type:** feature touching deploy artefacts + application code
**Plan:** [`docs/history/2026-10-12-deploy-meta-version-display-plan.md`](../history/2026-10-12-deploy-meta-version-display-plan.md)
**Narrative:** [`docs/history/2026-10-12--13-20-00-deploy-meta-version-display.md`](../history/2026-10-12--13-20-00-deploy-meta-version-display.md)

## 1. Problem

A running container could not be traced back to a revision from outside the
host. The `sha-<7>` tag existed only in GHCR and in `docker compose ps`, so a
browser tab, a support screenshot or a `/healthz` probe gave no evidence of
*which* build was live. This is precisely what made the
[`2026-10-11` stale-image incident](2026-10-11--23-59-45-deploy-yml-parse-failure-fix.milestone.md)
expensive: the droplet kept serving `sha-3a8f5b6` while the repo had moved on,
and nothing user-visible disagreed.

## 2. Measured data / evidence

* Incident evidence: live `/healthz` answered `{"status":"ok"}` — the **pre-`oks`**
  body — while `main` already contained `status: 'oks'`. The endpoint proved the
  process was alive, not *which* process.
* Local baseline: `curl http://localhost:3000/healthz` returned
  `{"status":"oks","uptime":N,"timestamp":"…"}` with no build information at all.
* Bundle check after the change (no Docker involved):
  `VITE_COMMIT_HASH=0123456789abcdef0123456789abcdef01234567 pnpm --filter @callback/web exec vite build`
  → the hash is present verbatim in `apps/web/dist/assets/*.js`.

## 3. Design rationale

| Decision | Alternative rejected | Why |
|---|---|---|
| Date = **image build time** from `images.yml` (`date -u +…Z`) | `git log -1 --format=%cI` of the commit | The build time is immutable per image and identical for all three apps; the commit date does not change when an image is *rebuilt* from the same SHA. |
| **Full 40-char SHA** | `short_sha` (7 chars) | Already computed for the tag; the full hash removes any ambiguity and is what a `git show` needs. |
| Single `meta` step as the source for all three images | Compute per image | Guarantees api / web / admin report **identical** metadata for one revision — that equality is the whole point of the feature. |
| `DEPLOY_DATE` / `COMMIT_HASH` as runtime `ENV` in the api image, `VITE_*` in the SPA **build** stage | Read the values at request time from a mounted file/`compose` env | The metadata describes the *image*, not the runtime configuration; a mounted value could drift from the actual bits. |
| Empty-string defaults, graceful degradation | Fail the build / hide the footer | Local `dev-stack` and `vite` runs must keep working; a hidden footer would be indistinguishable from a broken build. |
| Plain `<p>` text on the **public** web page | Separate `/version` page or an admin-only view | Support calls start from the public page URL; the values are already public via GHCR tags and git history. |

## 4. Implementation

| File | Change |
|---|---|
| [`.github/workflows/images.yml`](../../.github/workflows/images.yml:147) | `meta` step emits `commit_hash` + `deploy_date`; passed as build args to api / web / admin (not monitor). |
| [`infra/app/Dockerfile`](../../infra/app/Dockerfile:64) | `ARG`/`ENV COMMIT_HASH`, `DEPLOY_DATE` **re-declared in the runtime stage** (intermediate-stage ENV does not survive a later `FROM`). |
| [`infra/web/Dockerfile`](../../infra/web/Dockerfile:51) | `ARG VITE_DEPLOY_DATE` / `VITE_COMMIT_HASH` merged into the build-stage `ENV` so Vite exposes them. |
| [`infra/admin/Dockerfile`](../../infra/admin/Dockerfile:43) | Same as web (intentional mirror file). |
| [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts:12) | New `HealthStatus` interface; `check()` adds `deployDate` and `commitHash` (`process.env…?? null`, read per call). |
| [`apps/api/src/health/health.controller.spec.ts`](../../apps/api/src/health/health.controller.spec.ts:1) / [`apps/api/test/health.e2e-spec.ts`](../../apps/api/test/health.e2e-spec.ts:35) | 5 unit cases (set / unset / call-time read) + e2e guard now requires both fields. |
| [`packages/shared/src/lib/build-info.ts`](../../packages/shared/src/lib/build-info.ts:1) + [`index.ts`](../../packages/shared/src/index.ts:12) | **Single** implementation of the normalise/format helpers, exported for both SPAs (web + admin already depended on `@callback/shared`). |
| [`packages/shared/test/build-info.test.mjs`](../../packages/shared/test/build-info.test.mjs:1) + [`package.json`](../../packages/shared/package.json:17) + root [`package.json`](../../package.json:12) | 10 unit tests on Node's built-in runner (zero new dependencies, no lockfile change); root `pnpm test` now runs shared + api. |
| [`apps/web/src/components/BuildInfoFooter.tsx`](../../apps/web/src/components/BuildInfoFooter.tsx:1) + [`HomePage.tsx`](../../apps/web/src/pages/HomePage.tsx:3) + [`vite-env.d.ts`](../../apps/web/src/vite-env.d.ts:1) | Footer line on `/` (logic imported from `@callback/shared`), typed `import.meta.env`. |
| [`apps/admin/src/components/BuildInfoFooter.tsx`](../../apps/admin/src/components/BuildInfoFooter.tsx:1) + [`DashboardPage.tsx`](../../apps/admin/src/pages/DashboardPage.tsx:4) + [`vite-env.d.ts`](../../apps/admin/src/vite-env.d.ts:1) | Same wiring, footer at the bottom of the authenticated dashboard. |
| [`apps/api/.env.example`](../../apps/api/.env.example:38), [`apps/web/.env.example`](../../apps/web/.env.example:29), [`apps/admin/.env.example`](../../apps/admin/.env.example:29) | Read-only documentation: these must **not** be set in a `.env`. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:91), [`docs/Specs/Infrastructure-Docker.md`](../../docs/Specs/Infrastructure-Docker.md:109), [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:180) | `/healthz` shape, build-arg mapping table (§6.1), local `null` expectation. |

Behaviour: the **liveness contract is unchanged** — the Docker healthcheck and
the monitor watchdog only look at the HTTP status code, so no extra field can
break them.

## 5. Outcome and how to verify

After the next `images.yml` run and deploy, all three tiers report one revision:
`deployDate` = UTC image build time, `commitHash` = 40-char `github.sha`.

```bash
# 1. Local: no build metadata → must degrade, not break (null, HTTP 200)
scripts/dev-stack.sh up
curl -s http://localhost:3000/healthz
# → {"status":"oks","deployDate":null,"commitHash":null,"uptime":N,"timestamp":"…"}

# 2. Deployed: real metadata, hash equal to the deployed SHA
curl -s https://api.aisztens.hu/healthz | grep -o '"commitHash":"[^"]*"'

# 3. SPAs: bottom of the page shows the same date + hash
#    https://web.aisztens.hu/   and   https://admin.aisztens.hu/
curl -s https://web.aisztens.hu/ | head -n1        # sanity: page still serves
```

```bash
# 4. Repo-level regression guards
pnpm test                                 # shared 10 + api 60 = 70 tests
pnpm --filter @callback/api test:e2e      # 14 tests
pnpm --filter @callback/web build && pnpm --filter @callback/admin build
```

## 6. Follow-ups

* Add a `deploy.yml` assertion that the deployed `commitHash` equals
  `github.sha` — the automated check that would have caught the 2026-10-11
  stale-image incident.
* Only the *logic* is shared. The two `BuildInfoFooter.tsx` components stay
  per-app: the markup/labels/spacing differ, and pushing a React component into
  `packages/shared` would give the API package a `react` peer dependency.
* `packages/shared` runs its tests on Node's built-in runner (`node --test`)
  instead of jest, to avoid new devDependencies and a `pnpm-lock.yaml` rewrite.
  The suite therefore tests the compiled `dist/` output and has no coverage
  report; porting it to jest (with `jest` + `ts-jest` added to the package) is a
  low-effort follow-up if coverage is wanted.
* `apps/web` / `apps/admin` still have no runner of their own (`test` scripts
  are no-op stubs), so the JSX itself is covered only by `tsc --noEmit` and the
  emitted-bundle grep.
