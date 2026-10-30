# Local Development — AIsztens

**Status:** living spec
**Last updated:** 2026-10-21 — AIS-42: új **§6 end-to-end how-to** (séma módosítás → `db:generate` → `db:migrate` → API + admin indítás → API-kulcs felvétele az oldalon), lépésenként lefuttatott parancsokkal és a tényleges kimenetekkel.
**Previous update:** 2026-10-21 — host-run API boot: `pnpm dev` leaves `APP_ENV` unset, so NestJS falls back to `dev`, reads `apps/api/.env.dev` **first**, and therefore needs (a) `DATABASE_URL` in `apps/api/.env.local` and (b) an explicit `APP_ENV=local` to serve the localhost CORS list — otherwise the admin SPA on `http://localhost:5174` is rejected by CORS. §3 and §5 document the trap and the verification commands.
**Previous update:** 2026-10-21 — Windows install recovery: an IDE language service (or any other process) holding a handle inside `node_modules` makes `pnpm install` abort with `Failed to create symlink … os error 32`; §5 documents the diagnosis, the kill-then-rerun recovery and why `--force` makes it worse.
**Previous update:** 2026-10-19 — per-context Postgres schemas: the init directory now ships two idempotent scripts ([`01-roles.sh`](../../infra/postgres/init/01-roles.sh) for roles and schema grants, [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) for the `platform` / `callback` / `email` schemas), and both run only on a fresh `pgdata` volume (AIS-35). §2b now carries the mandatory env keys, the verification queries, the stop/wipe semantics and the 5432 port collision; the DB topic has its own spec, [`Database-Local.md`](Database-Local.md).
**Previous update:** 2026-10-19 — local DB-only workflow: [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml) plus the root `pnpm db:up` / `db:down` scripts start a Dockerized Postgres for `pnpm --filter @callback/api start:dev` (AIS-34).
**Previous update:** 2026-10-13 — deploy-process consistency: the `dev` boot
row no longer claims a `deploy.yml` push trigger (that workflow now reacts
via `workflow_run` / `workflow_dispatch`), and §5 no longer references the
removed `deploy.sh:ensure_spa_env()` helper — the SPA API URL is the
`VITE_API_BASE_URL` build arg of `.github/workflows/images.yml`.
**Audience:** anyone setting up a local dev machine, or onboarding a new
contributor.

This spec documents the **local developer workflow** after the three-env
separation plan landed (see
[`docs/plans/2026-10-05--10-30-00-three-env-separation-plan.md`](../plans/2026-10-05--10-30-00-three-env-separation-plan.md)).
It complements the droplet-side runbook
([`docs/Specs/Production-Runbook.md`](Production-Runbook.md)).

---

## 1. The three environments at a glance

| Env       | Where it runs                                                  | Config files it reads                                                                                                                                                                                                                              | How it boots                                                                                                                                                                                                                                                                                          |
| --------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **local** | The developer's own machine (Windows / WSL / Linux / macOS)    | [`infra/.env.local`](../../infra/.env.example) + [`apps/api/.env.local`](../../apps/api/.env.example) + `apps/web/.env.local` + `apps/admin/.env.local`                                                                                            | [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh) `up`                                                                                                                                                                                                                                             |
| **dev**   | The currently running droplet (`aisztens.hu`)                  | [`infra/.env.dev`](../../infra/.env.example) (rendered into `infra/.env` on the droplet by `deploy.sh` or the CI deploy) + [`deploy/.env.dev`](../../deploy/.env.example) (operator/SSH config for the dev droplet) + compose `environment:` block | [`deploy/deploy.sh`](../../deploy/deploy.sh) `up dev` (or plain `up` — `dev` is the default target), or auto-deploy by [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) via its `workflow_run` trigger (after `images.yml` publishes the images), or a manual `workflow_dispatch` |
| **prod**  | A **future** dedicated production droplet (does not exist yet) | [`infra/.env.prod`](../../infra/.env.example) (dormant template; replace `<prod-domain>` with the real apex when provisioning) + `deploy/.env.prod` (operator/SSH config for the prod droplet)                                                     | [`deploy/deploy.sh`](../../deploy/deploy.sh) `up prod`, or the same deploy pipeline dispatched manually with `app_env=prod`                                                                                                                                                                           |

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

## 2b. Local Postgres only (API developed via `pnpm start:dev`)

When you only work on the API and run it on the host with
`pnpm --filter @callback/api start:dev`, you do not need the whole local
stack — start just Postgres:

```bash
cp infra/.env.example infra/.env.local   # first time only; then edit the DB passwords
pnpm db:up                                # starts Postgres on localhost:5432
pnpm --filter @callback/api start:dev     # in a second terminal
pnpm db:down                              # stop it when done (volume is kept)
```

[`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml) is a
standalone compose file containing **only** the `postgres` service:
`postgres:16-alpine`, host port `5432`, a dedicated `pgdata_local` volume
(so it does not share data with the full local stack), the
[`infra/postgres/init`](../../infra/postgres/init) init scripts and a
healthcheck. The API connects via `DATABASE_URL` in
[`apps/api/.env.local`](../../apps/api/.env.example) (documented in its
`local` block as
`postgres://aisztens:<AISZTENS_DB_PASSWORD>@localhost:5432/aisztens_db`).

The full detail of this topic lives in [`Database-Local.md`](Database-Local.md);
the sections below are the minimum you need to run the API.

### 2b.1 Mandatory keys in `infra/.env.local`

`pnpm db:up` passes `--env-file infra/.env.local`, so the file must exist
**before** the first start (`scripts/dev-stack.sh up` seeds it automatically,
`pnpm db:up` does not). The bootstrap reads exactly these keys:

| Key                    | Default if missing | Used by                                                                                                            |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_DB`          | `aisztens_db`      | compose + both init scripts                                                                                        |
| `POSTGRES_USER`        | `postgres`         | compose + both init scripts (superuser that runs the init)                                                         |
| `POSTGRES_PASSWORD`    | — (**required**)   | compose                                                                                                            |
| `AISZTENS_DB_USER`     | `aisztens`         | [`01-roles.sh`](../../infra/postgres/init/01-roles.sh), [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) |
| `AISZTENS_DB_PASSWORD` | — (**required**)   | `01-roles.sh`                                                                                                      |
| `TKOVARI_DB_PASSWORD`  | — (**required**)   | `01-roles.sh`                                                                                                      |
| `KRAK_DB_PASSWORD`     | — (**required**)   | `01-roles.sh`                                                                                                      |

Placeholder passwords are enough to boot the container, but the init script then
creates the roles with them — replace them before you post real data.

### 2b.2 The two local Postgres stacks cannot run at the same time

Both [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml) and the
local override [`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml)
publish host port `5432`, and they use **different volumes** (`pgdata_local` vs
`pgdata`). So:

- a running full stack makes `pnpm db:up` fail with
  `Bind for 0.0.0.0:5432 failed: port is already allocated` — stop the other one
  first (`scripts/dev-stack.sh down` / `pnpm db:down`);
- data created in the DB-only stack is **not** visible in the full stack, and
  vice versa.

### 2b.3 Verifying the bootstrap

```bash
DC="docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml"

$DC exec -T postgres psql -U postgres -d aisztens_db -c '\dn'
# Expect: platform, callback, email (plus public / information_schema / pg_catalog / pg_toast)

$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT rolname FROM pg_roles WHERE rolname IN ('aisztens','tkovari','krak') ORDER BY 1"
# Expect: aisztens, krak, tkovari

$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT count(*) FROM (VALUES ('platform'),('callback'),('email')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'USAGE')"
# Expect: 9   (3 schemas x 3 roles)

$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT count(*) FROM (VALUES ('callback'),('platform')) AS s(nspname) CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) AS r(rolname) WHERE has_schema_privilege(r.rolname, s.nspname, 'CREATE')"
# Expect: 2   (CREATE only for aisztens: callback + platform)
```

The same matrix is asserted by
`bash scripts/test/_postgres-init-schemas-test.sh` (throwaway container: fresh
init plus two idempotent re-runs — expect `PASS: 29  FAIL: 0`), and by the
`postgres-schemas` / `postgres-schema-usage` / `postgres-schema-create` checks of
`pnpm test:stack` on a running stack.

How the init actually went:

```bash
$DC logs postgres
# "PostgreSQL init process complete" = the init scripts ran
# "Skipping initialization"          = the volume was already initialized (not an error)
```

### 2b.4 The init runs once per volume

The bind-mounted init directory holds two scripts, and the image's entrypoint
runs them in lexicographic order **once, on an empty `pgdata_local` volume**:

| Script                                                     | Creates                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`01-roles.sh`](../../infra/postgres/init/01-roles.sh)     | roles `aisztens` / `tkovari` / `krak`, database ownership, schema grants |
| [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) | schemas `platform`, `callback`, `email` plus the grant matrix            |

When the volume already exists (the normal case after pulling this change) the
schemas and the `callback` `CREATE` grant are **missing**, and `db:migrate`
fails with `permission denied for schema callback`. Either re-apply the scripts
by hand, or recreate the volume:

```bash
# re-apply in place (idempotent, no data loss)
pnpm db:up
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres bash /docker-entrypoint-initdb.d/02-schemas.sh

# or start over on an empty volume (local data is lost)
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml down -v
pnpm db:up
```

### 2b.5 Stopping vs. wiping

```bash
pnpm db:down     # container stops, pgdata_local volume is KEPT
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml down -v
                 # container + volume removed: next `pnpm db:up` re-runs the init
```

`scripts/dev-stack.sh down` behaves the same way for the full stack (`pgdata` is kept).
The **actual** Docker volume names differ per compose project — `infra_pgdata_local`
(DB-only stack, project `infra`) and `aisztens_pgdata` (full stack, `name: aisztens`);
see [`Database-Local.md`](Database-Local.md) §1.

> **AIS-64 (2026-10-21):** the call-back feature was removed end to end — API
> module, admin page, public web form, shared schemas, and the
> `callback.callback_requests` table plus the `callback` Postgres schema. The
> remaining schemas are `platform` and `email`; the `platform.__drizzle_migrations`
> bookkeeping table stays. The current "what exists / what does not" table is in
> [`Database-Local.md`](Database-Local.md) §9.

> **AIS-56 (2026-10-21): `DATABASE_URL` is mandatory for the API.**
> `DatabaseModule` validates it at boot and aborts with
> `DatabaseConfigurationError` when it is missing or blank, so start the local
> Postgres first (`pnpm db:up`) and keep the value in `apps/api/.env.local`.
> The connection itself is lazy — boot only checks the configuration, it does not
> open a socket. Pool size override: `DATABASE_POOL_MAX` (default 10).

Schema work uses the Drizzle toolchain wired into the API package:
`pnpm --filter @callback/api db:generate` produces a SQL migration under
[`apps/api/drizzle/`](../../apps/api/drizzle), `db:check` runs the drift
check, and `db:migrate` is a placeholder runner until Story 3.

---

## 3. The per-env file convention (why three files per service)

Vite (`apps/web`, `apps/admin`) and NestJS (`apps/api`) both resolve
`*.env.*` files by environment. The Vite plugin docs call this the
[env file conventions](https://vitejs.dev/guide/env-and-mode.html#env-files);
NestJS's `@nestjs/config` uses the same priority order. We use:

| File           | Loaded when                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example` | **Documentation only** — never loaded, always tracked. Documents what each per-env file should contain.                                                                                                                                                                                                                                                          |
| `.env.local`   | Local developer machine. It is the `.env.${APP_ENV}` candidate when `APP_ENV=local`, **and always the second candidate** in the NestJS `envFilePath` array — so it is also read when `APP_ENV` is unset (which falls back to `dev`). Values from `.env.dev` win over it, because `@nestjs/config` does not let a later file override an earlier one. Gitignored. |
| `.env.dev`     | The dev droplet (`APP_ENV=dev` via the compose `environment:` block and the `api.environment.APP_ENV` value). Gitignored.                                                                                                                                                                                                                                        |
| `.env.prod`    | Future prod droplet (`APP_ENV=prod`). Dormant template; gitignored.                                                                                                                                                                                                                                                                                              |
| `.env`         | Fallback only — never written by anyone, exists only on the dev droplet pre-cutover (and on the developer machine pre-cutover). Gitignored.                                                                                                                                                                                                                      |

Vite's resolution priority is:

1. `.env.[mode].local`
2. `.env.[mode]` ← the file Vite loads for `--mode dev` is `.env.dev`
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

| Layer                                          | Reads `APP_ENV` from                                                                                          | Effect                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Shell (`scripts/dev-stack.sh`)                 | `export APP_ENV=...` (set by the script)                                                                      | Docker compose picks the env-file by name; NestJS inherits it via the container env. |
| Docker compose (`infra/docker-compose.yml:30`) | `APP_ENV: ${APP_ENV:-dev}` in the `api.environment:` block                                                    | Sets the **default** when the shell didn't pass one (defaults to `dev`).             |
| NestJS (`apps/api/src/app.module.ts:30`)       | `ConfigModule.forRoot({ envFilePath: ['.env.${APP_ENV}', '.env.local'], ignoreEnvFile: APP_ENV === 'prod' })` | Picks the right per-env file at boot. Fail-closes in prod against `.env*` files.     |

Three places, one source of truth. If you change the `APP_ENV` value in
one place, the others propagate.

---

## 5. Common pitfalls

- **`pnpm dev` does not set `APP_ENV`, so the API runs in `dev` mode.** Two
  consequences on a developer machine:

  1. `envFilePath` becomes `['apps/api/.env.dev', 'apps/api/.env.local']`, so the
     droplet seed file is read **first** — including its
     `CORS_ORIGINS=https://web.aisztens.hu,https://admin.aisztens.hu`. A browser
     on `http://localhost:5174` then gets a preflight **without**
     `access-control-allow-origin` and the SPA reports a network error.
  2. `DATABASE_URL` must live in `apps/api/.env.local` (the `.env.dev` seed does
     not define it). Without it the API aborts with
     `DatabaseConfigurationError: DATABASE_URL is not set or blank` — by design
     (AIS-56), there is no silent fallback.

  Start the local flow as `set "APP_ENV=local" && pnpm dev` (cmd) or
  `$env:APP_ENV='local'; pnpm dev` (PowerShell); the boot banner must then say
  `APP_ENV=local … CORS origins: http://localhost:5173,…`. Verify with:

  ```bash
  curl -s -D - -o NUL -X OPTIONS http://localhost:3000/api/api-keys \
    -H "Origin: http://localhost:5174" -H "Access-Control-Request-Method: GET" \
    | grep -i access-control-allow-origin   # must print the localhost origin
  curl -s -w '\n%{http_code}\n' http://localhost:3000/healthz        # 200 {"status":"oks",…}
  curl -s -w '\n%{http_code}\n' http://localhost:3000/api/api-keys   # 200 [] or rows
  ```

  The banner is the fastest diagnosis: a `dev` label on a developer machine means
  the CORS list belongs to the droplet, not to your machine.

- **A SPA deep link can be swallowed by the `/api` dev proxy.** Opening
  `http://localhost:5174/api-keys` directly returned the API's
  `{"message":"Cannot GET /api-keys","statusCode":404}`, because a plain `'/api'`
  proxy key is a _prefix_ match. Fixed by using the regex `'^/api/'` in
  [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:16) and
  [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts:16); check with
  `curl -s -o NUL -w "%{http_code} %{content_type}\n" http://localhost:5174/api-keys`
  → `200 text/html`, while `/api/api-keys` must stay `200 application/json`.
  Vite restarts itself when the config file changes, no manual restart needed.

- **The SPA API URL is baked into the image at build time, not read from a
  droplet-side file.** The image-based deploy (2026-10-08) retired the
  host-side `apps/{web,admin}/.env.dev` files and the
  `deploy/deploy.sh:ensure_spa_env()` helper that used to seed them: the SPA
  base URL now arrives as the `VITE_API_BASE_URL` build arg of
  [`.github/workflows/images.yml`](../../.github/workflows/images.yml)
  (derived from the `DOMAIN` in the `INFRA_ENV_*` secret). The droplet only
  pulls the finished `web` / `admin` images and never builds them.

- **Don't put secrets in `apps/*/.env.{dev,prod}`.** During a local
  `vite build --mode X` those files are baked into the SPA bundle
  (`import.meta.env.VITE_*` ends up in the JS); in the image-based CI path
  the equivalent values arrive as the `VITE_*` build args of
  [`.github/workflows/images.yml`](../../.github/workflows/images.yml).
  Either way, only public values may go into a `VITE_*` variable. Real
  secrets belong in `infra/.env.{dev,prod}` only, which never enters the
  SPA bundle.

- **The legacy `infra/.env` path is the runtime env on the droplet.**
  The image-based deploy (2026-10-08) ships `infra/.env.${APP_ENV}` →
  `infra/.env` on the droplet; the compose `--env-file infra/.env` flag
  points at this single canonical file because a droplet hosts ONE
  environment. The per-env name (`infra/.env.<target>`) exists
  **locally only**, as the source. A future migration could rename
  the runtime path to `infra/.env.${APP_ENV}` on disk as well, but
  every compose invocation, the smoke suite, and `check-env-live.sh`
  are pinned to `infra/.env` — see
  [`docs/Specs/Three-Env-Verification.md`](Three-Env-Verification.md) §1d
  for the offline guard that locks this down.

- **The `local` env is NOT shipped to the droplet.** `scripts/dev-stack.sh`
  does not scp anything; the API container is your local machine.

- **Windows: `pnpm install` aborts with `Failed to create symlink … os error 32`**
  (`the process cannot access the file because it is being used by another
process`). pnpm's `node_modules/.pnpm` layout is a tree of symlinks, so any
  process holding a handle inside `node_modules` makes link creation fail —
  typically an IDE TypeScript language service (`js-language-service.js`,
  `typingsInstaller.js`), a Tailwind language server, a running
  `start:dev` / `vite` watcher, or a real-time antivirus scan. The install then
  stops half-way: the pnpm store is intact but `.pnpm` and the per-package
  links stay incomplete. Recovery:

  ```powershell
  # 1. which node processes touch this workspace?
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*ai-sztens-dev*' } |
    Select-Object ProcessId,CommandLine
  # 2. stop those IDE helpers (the IDE restarts them on demand;
  #    leave the MCP servers coming from another project alone)
  Stop-Process -Id <pid>,<pid> -Force
  # 3. finish the install — a plain run, no --force needed
  pnpm install
  # 4. sanity check
  pnpm test
  ```

  Do not reach for `pnpm install --force` first: it deletes and recreates the
  whole `node_modules` tree, which maximises the window in which a locked file
  can abort the run.

---

## 6. End-to-end how-to: séma → migráció → API → admin API-kulcs oldal

Ez a fejezet a teljes fejlesztői ciklust írja le, ahogy 2026-10-21-én lefuttatva működött.
Minden parancsot a **repo gyökeréből** kell futtatni (kivéve ahol jelölve van), és minden lépésnél
ott van a várt kimenet — ha a tiéd eltér, ott állj meg.

### 6.1 Előfeltételek (gépenként egyszer)

```bash
node -v            # 20.x vagy újabb
pnpm -v
docker compose version   # v2 plugin kell

pnpm install
cp infra/.env.example infra/.env.local        # majd írd át a jelszavakat
cp apps/api/.env.example apps/api/.env.local  # kötelező: DATABASE_URL sor (lásd §3)
```

Az `apps/api/.env.local`-ban **muszáj** lennie ennek a sornak (a jelszó az `infra/.env.local`
`AISZTENS_DB_PASSWORD` értéke):

```dotenv
DATABASE_URL=postgres://aisztens:<AISZTENS_DB_PASSWORD>@localhost:5432/aisztens_db
```

### 6.2 Adatbázis indítása és ellenőrzése

```bash
pnpm db:up      # csak a Postgres (infra/docker-compose.db.yml) — a hoston futó API-nak
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml ps
```

Várt: `infra-postgres-1 … Up (healthy)`, `0.0.0.0:5432->5432/tcp`. A séma-ellenőrzés:

```bash
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres psql -U aisztens -d aisztens_db -c "\dt platform.*"
```

Várt kimenet (2026-10-21):

```text
 Schema  |         Name         | Type  |  Owner
---------+----------------------+-------+----------
 platform | __drizzle_migrations | table | aisztens
 platform | api_keys             | table | aisztens
```

Ha a `platform` séma vagy az `api_keys` hiányzik, a volume régi: lásd
[`Database-Local.md`](Database-Local.md) §8 (reset/wipe).

### 6.3 Séma módosítás

A séma **kódként** az [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts:1)-ben él, a
migrációk pedig az [`apps/api/drizzle/`](../../apps/api/drizzle) alatt. Egy új oszlop/tábla
hozzáadása: a `schema.ts`-t módosítod, majd generálod a SQL-t — kézzel nem írunk migrációt.

### 6.4 `db:generate`

```bash
pnpm --filter @callback/api db:generate
```

Változás nélküli futtatás várt kimenete:

```text
1 tables
api_keys 8 columns 0 indexes 0 fks

No schema changes, nothing to migrate 😴
```

Sémamódosítás esetén létrejön egy új `apps/api/drizzle/NNNN_*.sql` **és** frissül a
`drizzle/meta/NNNN_snapshot.json` — **mindkettőt commitolni kell**, különben a következő generálás
más diffet ad, és a deploy más migrációt futtat, mint amit láttál.

### 6.5 `db:migrate`

A `db:migrate` a lefordított `dist/migrate.js`-t futtatja, ezért **előbb build kell**:

```bash
pnpm --filter @callback/api build          # nest build — csendben lefut
pnpm --filter @callback/api db:migrate
```

Várt kimenet:

```text
[db:migrate] migrations applied (bookkeeping: platform.__drizzle_migrations)
```

Újbóli futtatás ugyanezt írja ki, de nem csinál semmit (a könyvelő tábla alapján kihagyja a már
alkalmazott migrációkat). A `db:push` **tilos**: az megkerüli a verziózott migrációkat, amikre a
deploy épül.

### 6.6 API + admin indítása

```bash
# cmd
set "APP_ENV=local" && pnpm dev
# PowerShell
$env:APP_ENV='local'; pnpm dev
```

Az `APP_ENV=local` nem elhagyható: enélkül a NestJS `dev`-re esik vissza, a `.env.dev`-et olvassa
előbb, és a **droplet** CORS-listáját szolgálja ki — a böngészőből érkező kérés így elhasal
(részletek a §5-ben).

Várt sorok a kimenetben:

```text
[api] [Bootstrap] API up — APP_ENV=local (raw=local), listening on 0.0.0.0:3000,
      CORS origins: http://localhost:5173,http://localhost:5174,...
```

Portok: API `3000`, admin SPA `5174`, publikus web `5173`.

### 6.7 Az oldal megnyitása — egy kulcs felvétele

1. Böngésző: **`http://localhost:5174/api-keys`** (a login oldal helyőrző: bármilyen nem üres
   jelszó beléptet).
2. Az űrlapon öt mező: **Név, Azonosító, Leírás, API kulcs értéke, Lejárat**.
   - `Azonosító`: egyedi, URL-biztos (`betű/szám/._-`), pl. `vapi-prod`.
   - `API kulcs értéke`: a szolgáltatótól kapott token, pl. `sk-live-abc123`.
   - `Lejárat`: üresen hagyható → a sorban „nincs lejárat” jelenik meg.
3. **Kulcs mentése** → zöld siker-`Alert`, az űrlap kiürül, és a lista **újratöltés nélkül**
   megkapja az új sort.
4. Ugyanazzal az azonosítóval újra mentve a hiba az **Azonosító mezőn** jelenik meg
   (409), nem az oldal tetején.
5. A táblázat **soha nem jeleníti meg a kulcs értékét** — csak nevet, azonosítót, leírást, lejáratot.

> **Figyelem (AIS-72):** az API útvonal ma `/api/api-keys`. Amikor az AIS-72 elkészül, ez
> `/api/admin/api-keys` lesz — akkor **ebben a fejezetben** (6.7/6.8) és a
> [`packages/api-client`](../../packages/api-client/src/api-keys/api-keys.const.ts:10)
> konstansban kell átírni, másutt nem.

### 6.8 Ellenőrzés kívülről (curl)

```bash
# lista
curl -s -w "\nstatus=%{http_code}\n" http://localhost:3000/api/api-keys   # status=200, JSON tömb

# felvétel (201), majd ugyanaz még egyszer (409)
curl -s -o NUL -w "status=%{http_code}\n" -X POST http://localhost:3000/api/api-keys \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"HowTo demo\",\"identifier\":\"howto-demo\",\"apiKey\":\"sk-demo\"}"

# az SPA deep linkje (nem az API válasza!):
curl -s -o NUL -w "status=%{http_code} type=%{content_type}\n" http://localhost:5174/api-keys
```

Várt: `201` az első POST-ra, `409` a másodikra
(`An API key with identifier "howto-demo" already exists …`), `200`, illetve
`200 text/html`. PowerShell 5.1 alatt a `Invoke-WebRequest` a HTML-válaszokon elhasalhat — ott is
`curl`-t használj (vagy `-UseBasicParsing`-et).

Kitakarítás (a demó sor törlése):

```bash
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres psql -U aisztens -d aisztens_db \
  -c "delete from platform.api_keys where identifier = 'howto-demo';"
```

### 6.9 Mi történik a felvett kulccsal

Az itt tárolt kulcsok **nem a böngészőnek** szólnak: a későbbi **AI feldolgozási folyamat**
(hangasszisztens / LLM hívások) olvassa őket a `platform.api_keys` táblából az `identifier` alapján,
ezért a kulcs értéke soha nem kerül a frontend bundle-be, és nem is jelenik meg a listában. A
publikus API gépi hitelesítése ezekre a kulcsokra fog épülni (AIS-76), a token tárolása pedig
hash-re vált (AIS-75) — addig a `GET` válasz még tartalmazza a plaintext értéket, ezt ne tekintsd
végleges contractnak.

---

## 7. See also

- [`docs/Specs/Three-Env-Verification.md`](Three-Env-Verification.md) — **the end-to-end manual test plan** that proves the three-env separation actually works. Read this before you trust a fresh deployment.
- [`docs/Specs/Database-Local.md`](Database-Local.md) — the local Postgres spec: bootstrap, grant matrix, verification queries, reset/wipe semantics and the list of things that do not exist in the DB yet.
- [`docs/plans/2026-10-05--10-30-00-three-env-separation-plan.md`](../plans/2026-10-05--10-30-00-three-env-separation-plan.md) — the full plan that produced this layout.
- [`deploy/README.md`](../../deploy/README.md) — the droplet-side deploy runbook (steps 8.1 / 8.2 / 9 cover the per-environment secrets and the local override).
- [`docs/Specs/Production-Runbook.md`](Production-Runbook.md) — what to do once the stack is on the droplet.
- [`scripts/README.md`](../../scripts/README.md) — the script index (this spec's commands, subcommands and flags).
- [`README.md`](../../README.md) — the top-level quick-start; its "Scripts" section points at [`scripts/README.md`](../../scripts/README.md).
