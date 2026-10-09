# Local Development — AIsztens

**Status:** living spec
**Last updated:** 2026-10-08 — image-based deploy: the local override now
carries `build:` blocks for every application service so a fresh checkout
can still build the stack from source without a registry
([`docs/history/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md`](../history/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md)).
**Audience:** anyone setting up a local dev machine, or onboarding a new
contributor.

This spec documents the **local developer workflow** after the three-env
separation plan landed (see
[`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](../history/2026-10-05--10-30-00-three-env-separation-plan.md)).
It complements the droplet-side runbook
([`docs/Specs/Production-Runbook.md`](Production-Runbook.md)).

---

## 1. The three environments at a glance

| Env | Where it runs | Config files it reads | How it boots |
|---|---|---|---|
| **local** | The developer's own machine (Windows / WSL / Linux / macOS) | [`infra/.env.local`](../../infra/.env.example) + [`apps/api/.env.local`](../../apps/api/.env.example) + `apps/web/.env.local` + `apps/admin/.env.local` | [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh) `up` |
| **dev** | The currently running droplet (`aisztens.hu`) | [`infra/.env.dev`](../../infra/.env.example) (rendered into `infra/.env` on the droplet by deploy.sh) + [`deploy/.env.dev`](../../deploy/.env.example) (operator/SSH config for the dev droplet) + compose `environment:` block | [`deploy/deploy.sh`](../../deploy/deploy.sh) `up dev` (or plain `up` — `dev` is the default target) or the `.github/workflows/deploy.yml` push trigger |
| **prod** | A **future** dedicated production droplet (does not exist yet) | [`infra/.env.prod`](../../infra/.env.example) (dormant template; replace `<prod-domain>` with the real apex when provisioning) + `deploy/.env.prod` (operator/SSH config for the prod droplet) | [`deploy/deploy.sh`](../../deploy/deploy.sh) `up prod`, or the same deploy pipeline dispatched manually with `app_env=prod` |

All real env files are **gitignored** — only `*.env.example` templates are
tracked. The plan added the patterns in
[`.gitignore:42`](../../.gitignore:42); they cover the new `apps/**/.env.{local,dev,prod}`
and `infra/.env.{local,dev,prod}` paths in addition to the existing `.env`.

---

## 2. Starting the local stack

The local stack is started with one command. Its subcommands, pre-flight checks
and exact compose invocation are documented in
[`scripts/README.md`](../../scripts/README.md).

```bash
scripts/dev-stack.sh up        # bash entry point (Linux / WSL / macOS)
# or
pwsh scripts/dev-stack.ps1 up   # Windows PowerShell wrapper (delegates to bash via WSL)
```

It merges [`infra/docker-compose.yml`](../../infra/docker-compose.yml) with the
[`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml)
override (formerly `infra/docker-compose.wsl.yml`, renamed in Step 3 of the
plan), which:

- adds `build:` blocks for every application service (`api`, `web`,
  `admin`, `monitor`) so a fresh checkout can `up -d --build` from
  source without a registry. The base compose file is image-only
  (image-based deploy): the local override is what restores the build
  context that the droplet never needs;
- publishes the `api` service on host port `3000` — reachable at
  `http://localhost:3000`;
- publishes the `postgres` service on host port `5432` — `psql` from the
  developer machine;
- disables `caddy` via `profiles: [never]` — no public DNS, no Let's Encrypt,
  no TLS.

---

## 3. The per-env file convention (why three files per service)

Vite (`apps/web`, `apps/admin`) and NestJS (`apps/api`) both resolve
`*.env.*` files by environment. The Vite plugin docs call this the
[env file conventions](https://vitejs.dev/guide/env-and-mode.html#env-files);
NestJS's `@nestjs/config` uses the same priority order. We use:

| File | Loaded when |
|---|---|
| `.env.example` | **Documentation only** — never loaded, always tracked. Documents what each per-env file should contain. |
| `.env.local` | Local developer machine (`APP_ENV=local`, or `pnpm dev` with no flag). Gitignored. |
| `.env.dev` | The dev droplet (`APP_ENV=dev` via the compose `environment:` block and the `api.environment.APP_ENV` value). Gitignored. |
| `.env.prod` | Future prod droplet (`APP_ENV=prod`). Dormant template; gitignored. |
| `.env` | Fallback only — never written by anyone, exists only on the dev droplet pre-cutover (and on the developer machine pre-cutover). Gitignored. |

Vite's resolution priority is:

1. `.env.[mode].local`
2. `.env.[mode]`  ← the file Vite loads for `--mode dev` is `.env.dev`
3. `.env.local`
4. `.env`

So on a developer machine that has both `.env.local` (with `/api`) and
`.env.dev` (with the dev URL):

- `pnpm dev` → loads `.env.local` → `VITE_API_BASE_URL=/api` → Vite dev
  proxy forwards to NestJS on `:3000`.
- `pnpm build:dev` → loads `.env.dev` → `VITE_API_BASE_URL=https://api.aisztens.hu/api`.

This split lets the developer machine do both **local Vite serving** and
**production-bundle smoke builds** from the same checkout.

---

## 4. How `APP_ENV` flows end-to-end

```
scripts/dev-stack.sh up
  └─ export APP_ENV=local
     └─ docker compose up
        └─ NestJS process inherits APP_ENV=local
           └─ apps/api/src/config/app-env.ts: APP_ENV = 'local'
           └─ apps/api/src/app.module.ts: envFilePath = ['.env.local', '.env.local']
           └─ apps/api/src/main.ts: loud banner says "APP_ENV=local"
```

The same `APP_ENV` is set in three layers, each with a different
responsibility:

| Layer | Reads `APP_ENV` from | Effect |
|---|---|---|
| Shell (`scripts/dev-stack.sh`) | `export APP_ENV=...` (set by the script) | Docker compose picks the env-file by name; NestJS inherits it via the container env. |
| Docker compose (`infra/docker-compose.yml:30`) | `APP_ENV: ${APP_ENV:-dev}` in the `api.environment:` block | Sets the **default** when the shell didn't pass one (defaults to `dev`). |
| NestJS (`apps/api/src/app.module.ts:30`) | `ConfigModule.forRoot({ envFilePath: ['.env.${APP_ENV}', '.env.local'], ignoreEnvFile: APP_ENV === 'prod' })` | Picks the right per-env file at boot. Fail-closes in prod against `.env*` files. |

Three places, one source of truth. If you change the `APP_ENV` value in
one place, the others propagate.

---

## 5. Common pitfalls

- **The droplet's `apps/web/.env.dev` and `apps/admin/.env.dev` are NOT
  in the source tree.** They live only on the build host (the
  developer machine for local builds, or the deploy.sh runner for
  CI builds). [`deploy/deploy.sh:ensure_spa_env()`](../../deploy/deploy.sh:104)
  seeds them on the first build and never overwrites — if the operator
  hand-edits them, the change survives across deploys.

- **Don't put secrets in `apps/*/.env.{dev,prod}`.** Those files are
  shipped to the SPA bundle at build time (`vite build --mode X`
  bakes `import.meta.env.VITE_*` into the JS). Real secrets belong in
  `infra/.env.{dev,prod}` only, which never enters the SPA bundle.

- **The legacy `infra/.env` path still works on the current dev
  droplet.** After the three-env plan, the deploy copies the local
  `infra/.env.dev` to the remote `infra/.env` (the droplet's compose
  `--env-file` flag points at the legacy path because that path is
  unchanged on disk). Deployments keep working; over time the
  droplet's `infra/.env` can be renamed on disk, but that's a follow-up
  — not part of the plan.

- **The `local` env is NOT shipped to the droplet.** `scripts/dev-stack.sh`
  does not scp anything; the API container is your local machine.

---

## 6. See also

- [`docs/Specs/Three-Env-Verification.md`](Three-Env-Verification.md) — **the end-to-end manual test plan** that proves the three-env separation actually works. Read this before you trust a fresh deployment.
- [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](../history/2026-10-05--10-30-00-three-env-separation-plan.md) — the full plan that produced this layout.
- [`deploy/README.md`](../../deploy/README.md) — the droplet-side deploy runbook (steps 8.1 / 8.2 / 9 cover the per-environment secrets and the local override).
- [`docs/Specs/Production-Runbook.md`](Production-Runbook.md) — what to do once the stack is on the droplet.
- [`scripts/README.md`](../../scripts/README.md) — the script index (this spec's commands, subcommands and flags).
- [`README.md`](../../README.md) — the top-level quick-start; its "Scripts" section points at [`scripts/README.md`](../../scripts/README.md).