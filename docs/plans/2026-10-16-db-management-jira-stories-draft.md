# Draft — JIRA stories & subtasks for database management

**Dátum:** 2026-10-16
**Státusz:** **DRAFT** — jóváhagyásra vár. A JIRA-ba csak elfogadás után kerül.
**Cél:** a 4 élethelyzethez (fejlesztés / deploy / backup / rollback) + 1 admin példa story,
mindegyik alá Sub-taskok, úgy hogy a Story + Sub-task önmagában elég legyen egy AI-nak a lefejlesztéshez.

**Konvenciók:**
- Csak a **Summary**, **Issue Type**, **Description** (és a Sub-taskoknál a **Parent**) mezőt töltjük ki.
- **Nincs** Assignee, **nincs** Priority (a user kérése szerint).
- A ticket törzse angol (JIRA/AI konvenció), hogy a lefejlesztő AI egyértelműen tudjon belőle dolgozni.

---

## Story 1 — Development: schema-as-code and persistent callback store

**Summary:** DB: schema-as-code migration workflow and Postgres-backed callback store

**Issue Type:** Story

**Description:**

### Context
The API currently stores callback requests in an in-memory `Map` in
[`callback-requests.service.ts`](../../apps/api/src/callback-requests/callback-requests.service.ts:12). No
schema, ORM, or migration tooling exists. The spec
[`Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:265) already documents a
`callback_requests` table that no DDL defines. The stack provisions PostgreSQL via
[`infra/docker-compose.yml`](../../infra/docker-compose.yml:101) and the idempotent init script
[`01-roles.sh`](../../infra/postgres/init/01-roles.sh:1), which runs only on an empty `pgdata` volume.

### What to build
1. Adopt **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) as the schema-as-code layer. Prisma is excluded
   (see [`2026-10-14-email-module-structural-design-plan.md`](../../docs/plans/2026-10-14-email-module-structural-design-plan.md:454)).
2. Add `db:generate`, `db:migrate`, `db:check` scripts to [`apps/api/package.json`](../../apps/api/package.json:9).
3. Create per-context Postgres schemas `platform`, `callback`, `email` in a new idempotent init script,
   and grant the `aisztens` role USAGE on them (extend [`01-roles.sh`](../../infra/postgres/init/01-roles.sh:1)).
4. Define the Drizzle schema and generate the first migration creating `callback.callback_requests`
   plus the Drizzle migration bookkeeping table (`__drizzle_migrations`).
5. Replace the in-memory store with a Postgres repository, keeping the existing controller/DTO contract intact.

### Business value
The callback data becomes durable and survives container restarts, and the schema becomes versioned,
reviewable code — the foundation every later feature (email engine, CRM hooks) depends on.

### DoD (Definition of Done)
- `pnpm --filter @callback/api db:generate` produces a SQL migration under `apps/api/drizzle/`.
- `pnpm --filter @callback/api db:check` passes on a clean tree.
- Local `db:migrate` against the dev-stack creates `callback.callback_requests` and `__drizzle_migrations`.
- `POST /api/callback-requests` persists a row that is readable after an API restart.
- Unit and e2e tests pass (`pnpm --filter @callback/api test`, `test:e2e`).

### Test coverage
- Unit: schema mapping, repository CRUD, migration bookkeeping.
- E2E: HTTP POST → row in Postgres (replace in-memory map assertion).
- See §Testing strategy of [`2026-10-16-database-migrations-backup-plan.md`](2026-10-16-database-migrations-backup-plan.md).

### Out of scope
- Migration execution in the deploy pipeline (Story 3).
- Backups and restore (Story 4).
- Rollback policy and docs (Story 5).

### Sub-tasks

---

**Sub-task 1.1**

**Summary:** Add drizzle-orm and drizzle-kit deps plus db scripts to apps/api

**Issue Type:** Sub-task
**Parent:** DB: schema-as-code migration workflow and Postgres-backed callback store

**Description:**
- Add runtime deps `drizzle-orm` and a Postgres driver (`postgres` or `pg`) and dev dep `drizzle-kit`
  to [`apps/api/package.json`](../../apps/api/package.json:23).
- Add npm scripts: `db:generate` (`drizzle-kit generate`), `db:migrate` (`node dist/migrate.js` placeholder),
  `db:check` (drift check via drizzle-kit).
- Add `apps/api/drizzle.config.ts` pointing `dialect: postgresql`, schema at `src/db/schema.ts`,
  output at `drizzle/`.
- DoD: `pnpm --filter @callback/api db:generate` and `db:check` run without config errors on a clean tree.
- Tests: none required at this step (config-only); `pnpm --filter @callback/api build` must still pass.

---

**Sub-task 1.2**

**Summary:** Create per-context Postgres schemas and role grants in init scripts

**Issue Type:** Sub-task
**Parent:** DB: schema-as-code migration workflow and Postgres-backed callback store

**Description:**
- Add a new idempotent init script (e.g. `infra/postgres/init/02-schemas.sh`) that creates schemas
  `platform`, `callback`, `email` if missing, using the `\gexec` / `CREATE SCHEMA IF NOT EXISTS` pattern
  already established in [`01-roles.sh`](../../infra/postgres/init/01-roles.sh:34).
- In [`01-roles.sh`](../../infra/postgres/init/01-roles.sh:1), add `GRANT USAGE ON SCHEMA ... TO :"aisztens_db_user"`
  for the three schemas and make the `aisztens` role able to create objects in `callback`.
- Keep the whole file idempotent (safe to re-run).
- DoD: on a fresh stack, `\dn` lists `platform`, `callback`, `email`; the `aisztens` role has USAGE on all three.
- Tests: extend the smoke check (§Story 3, sub-task 3.6) or a shell test asserting the schemas exist after init.

---

**Sub-task 1.3**

**Summary:** Define Drizzle schema and generate first migration for callback_requests

**Issue Type:** Sub-task
**Parent:** DB: schema-as-code migration workflow and Postgres-backed callback store

**Description:**
- Create [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) with a `callback` schema and a
  `callbackRequests` table matching the shared type in
  [`packages/shared/src/types/callback-request.ts`](../../packages/shared/src/types/callback-request.ts:1)
  (id uuid pk, status, contact fields, timestamps).
- Run `db:generate` to produce the committed SQL migration under `apps/api/drizzle/` plus the `meta/` snapshot.
- Confirm the generated SQL creates the schema and the table and the `__drizzle_migrations` bookkeeping table.
- DoD: `db:migrate` locally creates `callback.callback_requests`; `SELECT count(*) FROM callback.callback_requests` works.
- Tests: unit test for the schema-to-column mapping and any enum/type conversions.

---

**Sub-task 1.4**

**Summary:** Unit-test the Drizzle schema and repository

**Issue Type:** Sub-task
**Parent:** DB: schema-as-code migration workflow and Postgres-backed callback store

**Description:**
- Create a repository (e.g. `apps/api/src/db/callback-requests.repository.ts`) with `create`, `findAll`, `findOne`.
- Write unit tests in `apps/api/src/db/` covering: create persists and returns the row, findOne throws on missing id,
  findAll returns inserted rows, and error cases (invalid uuid, DB error propagation).
- DoD: `pnpm --filter @callback/api test` green, including edge/error cases per the coding standards.
- Tests: Jest unit tests (existing `ts-jest` ESM setup).

---

**Sub-task 1.5**

**Summary:** Persist callback requests to Postgres and add e2e coverage

**Issue Type:** Sub-task
**Parent:** DB: schema-as-code migration workflow and Postgres-backed callback store

**Description:**
- Replace the in-memory `Map` in [`callback-requests.service.ts`](../../apps/api/src/callback-requests/callback-requests.service.ts:12)
  with the repository from sub-task 1.4, keeping the controller and DTO unchanged.
- Ensure the module wires the repository via DI and the DB client reads `DATABASE_URL`
  (already passed in [`infra/docker-compose.yml`](../../infra/docker-compose.yml:60)).
- Add/update an e2e test in [`apps/api/test/`](../../apps/api/test/app.e2e-spec.ts:1) that POSTs a request and
  asserts the row exists in Postgres.
- DoD: e2e proves persistence across API restart; `pnpm --filter @callback/api test:e2e` green.
- Tests: e2e round-trip + a boot test confirming the app starts with a reachable Postgres.

---

## Story 2 — Admin: AI API key store page (full-stack example)

**Summary:** Admin: AI API key store page demonstrating the full-stack development flow

**Issue Type:** Story

**Description:**

### Context
The team needs a concrete, minimal walkthrough of how a feature is built in this codebase, while
also delivering a real capability: an admin page for managing name-value key pairs that hold AI API
tokens. These tokens will later be consumed by the AI processing flow. This story is the reference
example that pairs with the schema-as-code foundation from Story 1 — it exercises the DB
(migration), the API (NestJS controller/service/repository) and the admin UI (Vite/React page) in
one thin vertical slice.

### What to build
1. **DB part:** a `platform.api_keys` table via a Drizzle migration with columns: `name`,
   `identifier` (unique — used to look a key up), `description`, `api_key` (the token value),
   `expires_at` (expiry date), plus `id` and timestamps.
2. **API backend:** a NestJS `api-keys` module exposing `GET /api/api-keys` (list),
   `GET /api/api-keys/:identifier` (lookup by unique identifier) and `POST /api/api-keys` (create).
3. **Admin UI:** an API keys page in [`apps/admin/src/pages/`](../../apps/admin/src/pages/) that lists
   the stored keys and provides a form to add a new name-value key (name, identifier, description,
   API key, expiry).
4. **Usage docs:** a short how-to describing how to develop in this system (generate migration,
   migrate locally, run API + admin, use the page).

### Business value
Gives developers a copy-paste-able template for the standard DB → API → UI flow and delivers the
actual store that the AI processing flow will read tokens from later.

### DoD
- `platform.api_keys` exists after `db:migrate`; `identifier` is unique.
- `GET /api/api-keys` returns the stored keys (200, JSON array); `POST /api/api-keys` creates a key;
  a duplicate `identifier` is rejected (409).
- The admin page lists the keys and can add a new one; the created key appears in the list.
- Unit + e2e tests pass; the page is reachable in the local dev-stack.
- The how-to document explains the full loop.

### Test coverage
- Unit: repository mapping (incl. unique identifier), controller/service, DTO validation.
- E2E: create + list + lookup-by-identifier + duplicate-identifier rejection.
- UI: the admin page renders the list and the add form (component test or smoke check).

### Out of scope
- Update/delete/rotate operations, expiry enforcement, and masking/encryption of the stored token.
- Admin auth on this page.
- Pagination/search (can be added later).

### Sub-tasks

---

**Sub-task 2.1**

**Summary:** Add platform.api_keys table via migration

**Issue Type:** Sub-task
**Parent:** Admin: AI API key store page demonstrating the full-stack development flow

**Description:**
- Extend [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) with an `api_keys` table in the
  `platform` schema: `id` uuid pk, `name` (text), `identifier` (text, unique — lookup key),
  `description` (text), `api_key` (text — the token value), `expires_at` (date), `created_at`,
  `updated_at`.
- Generate the migration with `db:generate`; ensure the `identifier` column gets a unique constraint.
- DoD: `db:migrate` creates `platform.api_keys`; inserting two rows with the same `identifier` fails.
- Tests: unit test for the table mapping and the unique constraint.

---

**Sub-task 2.2**

**Summary:** Implement the API keys backend endpoints

**Issue Type:** Sub-task
**Parent:** Admin: AI API key store page demonstrating the full-stack development flow

**Description:**
- Create an `api-keys` module in [`apps/api/src/`](../../apps/api/src/) with repository, service and
  controller.
- Expose `GET /api/api-keys` (list all), `GET /api/api-keys/:identifier` (lookup by unique
  identifier), and `POST /api/api-keys` (create; validate required fields and reject duplicate
  `identifier` with 409).
- Wire the module in [`app.module.ts`](../../apps/api/src/app.module.ts:1).
- DoD: create returns 201 and the row is persisted; list returns it; lookup by identifier works;
  duplicate identifier returns 409.
- Tests: unit tests (service/repository) + e2e tests for create/list/lookup/duplicate.

---

**Sub-task 2.3**

**Summary:** Build the admin API keys page with list and add form

**Issue Type:** Sub-task
**Parent:** Admin: AI API key store page demonstrating the full-stack development flow

**Description:**
- Add an API keys page in [`apps/admin/src/pages/`](../../apps/admin/src/pages/) that fetches
  `GET /api/api-keys` via the existing [`apps/admin/src/lib/api.ts`](../../apps/admin/src/lib/api.ts:1)
  and renders a table (name, identifier, description, expiry) plus a form to add a new key
  (name, identifier, description, API key value, expiry) posting to `POST /api/api-keys`.
- Add the route/nav entry in [`apps/admin/src/App.tsx`](../../apps/admin/src/App.tsx:1) following the
  existing page pattern.
- DoD: the page lists stored keys and adding a key refreshes the list with the new entry.
- Tests: component/unit test for the list rendering and form submit (mock the API).

---

**Sub-task 2.4**

**Summary:** Write how-to documentation for the development flow

**Issue Type:** Sub-task
**Parent:** Admin: AI API key store page demonstrating the full-stack development flow

**Description:**
- Add a short how-to (e.g. in [`apps/admin/README.md`](../../apps/admin/README.md:1) or
  [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:1)) describing the full loop:
  change schema → `db:generate` → `db:migrate` → run API + admin locally → open the API keys page.
- Include the exact `pnpm` commands, the page URL, and a note that these tokens are consumed by the
  AI processing flow later.
- DoD: a new developer can follow it and add + list an API key without external help.

---

## Story 3 — Deploy: migration execution in the image-based pipeline

**Summary:** DB: run migrations in the deploy pipeline via a one-shot service

**Issue Type:** Story

**Description:**

### Context
The deploy model is image-based: [`images.yml`](../../.github/workflows/images.yml:1) builds 4 images,
[`deploy.yml`](../../.github/workflows/deploy.yml:353) ships small files and runs `pull && up -d --force-recreate`
on the droplet (no build, no source). Migrations must therefore ship **inside the api image** and run as a
one-shot step **between `pull` and `up -d`**, so the app never starts against an un-migrated schema.

### What to build
1. An advisory-locked migration runner `dist/migrate.js` in the api image.
2. A one-shot `migrate` compose service pinned to the same `IMAGE_TAG`.
3. Wiring in [`deploy.yml`](../../.github/workflows/deploy.yml:353) and a mirror `migrate` command in [`deploy.sh`](../../deploy/deploy.sh:1).
4. CI gates: schema-drift check and destructive-DDL lint in [`ci.yml`](../../.github/workflows/ci.yml:1).
5. DB smoke checks in the existing stack smoke suite.

### Business value
Schema changes become a first-class, gated step of every deploy, eliminating the class of failure where the
app starts against a stale schema; a failed migration aborts the deploy before the app flips.

### DoD
- A full CI deploy runs `docker compose run --rm migrate` between `pull` and `up -d`; a non-zero exit aborts the deploy.
- `migrate` is excluded from the `Verify every service is running IMAGE_TAG` step.
- Drift (schema changed without a migration) and unflagged destructive DDL both fail the PR.
- `pnpm test:stack` passes the new DB checks on the live stack.

### Test coverage
- Unit: migration runner lock/timeout behavior (sub-task 3.1).
- Smoke: migration at head, idempotent re-run, expected tables, CRUD round-trip (sub-task 3.6).
- CI lint: drift + destructive DDL (sub-task 3.5).

### Out of scope
- Backup/restore (Story 4), rollback policy and docs (Story 5).

### Sub-tasks

---

**Sub-task 3.1**

**Summary:** Implement advisory-locked migration runner dist/migrate.js

**Issue Type:** Sub-task
**Parent:** DB: run migrations in the deploy pipeline via a one-shot service

**Description:**
- Create [`apps/api/src/db/migrate.ts`](../../apps/api/src/db/migrate.ts), compiled to `dist/migrate.js` by the Nest build:
  - acquire `pg_advisory_lock(<fixed key>)`;
  - `SET lock_timeout = '5s'` and `SET statement_timeout = '60s'`;
  - apply pending migrations from the bundled `drizzle/` folder using Drizzle's migrator;
  - release the lock; exit non-zero on any failure (so the deploy step can fail).
- First run creates the `__drizzle_migrations` bookkeeping table automatically.
- DoD: running the runner twice is a no-op; a failing migration exits non-zero.
- Tests: unit tests for lock acquisition (concurrent runner blocks or exits) and timeout/error paths.

---

**Sub-task 3.2**

**Summary:** Bake migrations and the runner into the api Docker image

**Issue Type:** Sub-task
**Parent:** DB: run migrations in the deploy pipeline via a one-shot service

**Description:**
- Update [`infra/app/Dockerfile`](../../infra/app/Dockerfile:1) so the final image contains `apps/api/drizzle/`
  and `apps/api/dist/migrate.js` alongside the built app.
- DoD: `docker run <image> node apps/api/dist/migrate.js` executes (against a reachable DB) or prints usage/dry-run.
- Tests: none beyond the image build succeeding in `images.yml`.

---

**Sub-task 3.3**

**Summary:** Add a one-shot migrate service to docker-compose.yml

**Issue Type:** Sub-task
**Parent:** DB: run migrations in the deploy pipeline via a one-shot service

**Description:**
- Add a `migrate` service to [`infra/docker-compose.yml`](../../infra/docker-compose.yml:27):
  - same api image `${REGISTRY:-ghcr.io}/${GHCR_OWNER:-local}/aisztens-api:${IMAGE_TAG:-latest}`;
  - `restart: "no"`, `mem_limit: 256m`;
  - `command: ["node", "apps/api/dist/migrate.js"]`;
  - `depends_on: postgres: condition: service_healthy`;
  - same `DATABASE_URL` env as `api`; internal network only.
- DoD: `docker compose run --rm migrate` succeeds locally; a second run is a no-op.
- Tests: smoke sub-task 3.6 covers the no-op re-run.

---

**Sub-task 3.4**

**Summary:** Wire the migration step into deploy.yml and deploy.sh

**Issue Type:** Sub-task
**Parent:** DB: run migrations in the deploy pipeline via a one-shot service

**Description:**
- In [`deploy.yml`](../../.github/workflows/deploy.yml:353), insert a step between `pull` and `up -d` that runs
  `docker compose ... run --rm migrate` and fails the workflow on non-zero exit.
- Exclude `migrate` from the `Verify every service is running IMAGE_TAG` step (one-shot service, alongside postgres/caddy).
- In [`deploy/deploy.sh`](../../deploy/deploy.sh:1), add a `migrate` command mirroring the workflow step so the
  manual and CI paths stay identical.
- DoD: a deploy with a failing migration aborts before `up -d`; a clean deploy logs the migration result.
- Tests: extend the deploy-sh test suite (`scripts/test/_deploy-sh-*.sh`) with the new command if applicable.

---

**Sub-task 3.5**

**Summary:** Add schema-drift and destructive-DDL lint to ci.yml

**Issue Type:** Sub-task
**Parent:** DB: run migrations in the deploy pipeline via a one-shot service

**Description:**
- Add a CI step in [`ci.yml`](../../.github/workflows/ci.yml:1) running `db:check` so a schema change without a
  committed migration fails the PR.
- Add a lint step scanning `apps/api/drizzle/*.sql` for destructive statements (`DROP COLUMN`, `DROP TABLE`,
  `TRUNCATE`, `ALTER ... TYPE ... USING`) unless the migration is flagged `-- destructive`.
- DoD: a PR changing `schema.ts` without regenerating the migration turns the CI red; an unflagged `DROP` turns it red.
- Tests: CI pipeline itself is the test; add a small unit test for the lint rule if it is script-based.

---

**Sub-task 3.6**

**Summary:** Add DB smoke checks to the stack smoke suite

**Issue Type:** Sub-task
**Parent:** DB: run migrations in the deploy pipeline via a one-shot service

**Description:**
- Create [`scripts/test/lib/30-db.sh`](../../scripts/test/lib/30-db.sh) with checks:
  - postgres reachable (`pg_isready`, existing);
  - migration bookkeeping table exists and is at head;
  - running the migration a second time is a no-op (idempotency);
  - expected tables/columns exist (`callback.callback_requests`);
  - round-trip: insert a synthetic callback request, read it back, assert, delete it.
- Wire it into [`stack-smoke.sh`](../../scripts/test/stack-smoke.sh:81) following the existing `lib/10-*` / `lib/20-*` pattern.
- DoD: `pnpm test:stack` passes with the DB checks on the live local stack; failures exit non-zero.
- Tests: this sub-task IS the smoke test; the checks must also run cleanly on a fresh stack.

---

## Story 4 — Backup: off-host backups and restore drills

**Summary:** DB: nightly off-host backups, pre-migration snapshots and restore drills

**Issue Type:** Story

**Description:**

### Context
There is no backup/restore flow today — explicitly flagged in
[`Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:309) §7 and
[`snapshot-2026-10-01.md`](../../docs/snapshot-2026-10-01.md:260). A single `pgdata` volume on a single droplet
is the only copy of the data. Backups must be off-host (DO Spaces), encrypted, with retention, and must be
exercised by a restore drill — an unrestored backup is not a backup.

### What to build
1. Pre-migration snapshot in the deploy path.
2. Nightly `pg_dump -Fc` → encrypt → upload to DO Spaces → retention → alert.
3. `pg_restore`-based restore script with sanity checks.
4. A restore drill into a throwaway `postgres:16-alpine` container, scheduled monthly.

### Business value
Data durability and recoverability with a known RPO (24h nightly, 0 for pre-migration snapshots) and a
measured RTO (~15 min), protecting against droplet loss, bad migrations and operator mistakes.

### DoD
- Nightly backup lands an encrypted dump in DO Spaces; failure triggers the existing alert webhook.
- Retention keeps 7 daily / 4 weekly / 6 monthly.
- Pre-migration snapshots are produced before non-additive migrations.
- The restore drill restores the newest artifact into a throwaway container and row counts match.

### Test coverage
- Restore drill (the primary "test" of backups).
- Shell tests for retention/pruning and alert-on-failure branches.
- Smoke: backup script runs on the live stack and produces a non-empty dump.

### Out of scope
- WAL archiving / PITR (`wal-g`/`pgBackRest`) — follow-up.
- Whole-volume `pgdata` snapshots — follow-up.

### Sub-tasks

---

**Sub-task 4.1**

**Summary:** Implement pre-migration snapshot in the deploy path

**Issue Type:** Sub-task
**Parent:** DB: nightly off-host backups, pre-migration snapshots and restore drills

**Description:**
- In the deploy path (deploy.yml and deploy.sh), before running a **non-additive** migration, take a
  `pg_dump -Fc` snapshot named `pre-migrate-<migration>-<short-sha>.dump`, stored under `/opt/aisztens/backups/`.
- Additive migrations may skip the snapshot (configurable); destructive migrations must never skip it.
- DoD: after a deploy with a non-additive migration, the snapshot file exists and is non-empty.
- Tests: deploy-sh test asserting the snapshot runs and its file lands; failure path aborts before migration.

---

**Sub-task 4.2**

**Summary:** Implement scripts/db/backup.sh with encryption, DO Spaces and retention

**Issue Type:** Sub-task
**Parent:** DB: nightly off-host backups, pre-migration snapshots and restore drills

**Description:**
- Create [`scripts/db/backup.sh`](../../scripts/db/backup.sh):
  - `docker exec postgres pg_dump -Fc -U <user> -d aisztens_db` to a temp file;
  - encrypt with `age`/`gpg` (private key off-host);
  - upload to DO Spaces via `rclone` or `aws s3` using `BACKUP_S3_*` creds from `infra/.env`;
  - retention 7 daily / 4 weekly / 6 monthly by filename prefix;
  - on any failure, POST to `MONITOR_ALERT_WEBHOOK_URL`.
- Schedule on the droplet via cron/systemd timer.
- DoD: a manual run lands an encrypted dump in Spaces; a forced failure fires the alert webhook.
- Tests: shell tests for retention pruning and the failure/alert branch (script functions made testable).

---

**Sub-task 4.3**

**Summary:** Implement scripts/db/restore.sh with sanity checks

**Issue Type:** Sub-task
**Parent:** DB: nightly off-host backups, pre-migration snapshots and restore drills

**Description:**
- Create [`scripts/db/restore.sh`](../../scripts/db/restore.sh):
  - decrypt + `pg_restore --clean --if-exists -d aisztens_db <dump>`;
  - pre-restore confirmation for destructive restore;
  - post-restore `SELECT count(*)` sanity checks.
- DoD: restoring a dump into a scratch DB succeeds and a documented sanity query matches.
- Tests: shell tests for the decrypt/restore invocation and the confirmation gate.

---

**Sub-task 4.4**

**Summary:** Implement restore-drill.sh with a throwaway container and monthly schedule

**Issue Type:** Sub-task
**Parent:** DB: nightly off-host backups, pre-migration snapshots and restore drills

**Description:**
- Create [`scripts/db/restore-drill.sh`](../../scripts/db/restore-drill.sh):
  - download newest artifact from Spaces;
  - start a throwaway `postgres:16-alpine` container on a scratch port;
  - restore and run `SELECT count(*)` assertions;
  - remove the container;
  - alert on failure.
- Schedule monthly (cron/systemd) and make it runnable manually.
- DoD: the drill completes end-to-end and reports success or a loud failure.
- Tests: run the drill against a known-good artifact as the acceptance test.

---

## Story 5 — Rollback: recovery policy, RPO/RTO and documentation

**Summary:** DB: rollback policy, RPO/RTO and living documentation

**Issue Type:** Story

**Description:**

### Context
Image rollback exists (`IMAGE_TAG` re-dispatch), but there is no DB rollback story and no documented policy.
Schema cannot roll back cleanly; the mature pattern is expand/contract + image rollback, with destructive DDL
treated as a separate backup-gated operation.

### What to build
1. A documented expand/contract rollback policy.
2. Documented image-rollback and snapshot-restore runbook procedures with RPO/RTO.
3. A new living spec and updates to the affected existing specs (per the repo's spec-maintenance rule).

### Business value
Operators get a deterministic recovery path with agreed RPO/RTO instead of improvising during an incident;
future contributors understand why destructive DDL is never mixed into a feature deploy.

### DoD
- The runbook contains: image rollback via `IMAGE_TAG`, expand/contract rules, snapshot restore, RPO/RTO.
- [`Database-Migrations-and-Backup.md`](../../docs/Specs/Database-Migrations-and-Backup.md) exists and the
  affected specs (Production-Runbook, Infrastructure-Docker, Caddy-Reverse-Proxy §7) are updated in sync.
- A documented drill is runnable end-to-end.

### Test coverage
- No code tests; the acceptance criteria are the documented, runnable commands (verified manually).

### Out of scope
- Automated rollback orchestration (manual procedures documented only).

### Sub-tasks

---

**Sub-task 5.1**

**Summary:** Document the expand/contract rollback policy and image rollback procedure

**Issue Type:** Sub-task
**Parent:** DB: rollback policy, RPO/RTO and living documentation

**Description:**
- Write the expand/contract rules (N: add nullable/dual-write; N+1: app reads new shape; N+2: drop old only after
  a verified backup) into the runbook and the new spec.
- Document the image rollback: `IMAGE_TAG=sha-<old>` + `up -d --force-recreate`, or `deploy.yml` `workflow_dispatch`
  with `image_tag`.
- DoD: the two procedures are present and copy-paste runnable.

---

**Sub-task 5.2**

**Summary:** Document snapshot restore, RPO and RTO in the runbook

**Issue Type:** Sub-task
**Parent:** DB: rollback policy, RPO/RTO and living documentation

**Description:**
- Document the snapshot restore path ([`restore.sh`](../../scripts/db/restore.sh)) as the data-rollback lever,
  including pre-conditions and post-restore verification.
- Record RPO (24h nightly; 0 for pre-migration snapshots) and RTO (~15 min restore + stack restart).
- DoD: a future operator can follow the runbook to restore from a snapshot without external knowledge.

---

**Sub-task 5.3**

**Summary:** Create Database-Migrations-and-Backup spec and update affected specs

**Issue Type:** Sub-task
**Parent:** DB: rollback policy, RPO/RTO and living documentation

**Description:**
- Create [`docs/Specs/Database-Migrations-and-Backup.md`](../../docs/Specs/Database-Migrations-and-Backup.md)
  as the living spec for schema, migrations, backup and restore.
- Update [`Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1),
  [`Infrastructure-Docker.md`](../../docs/Specs/Infrastructure-Docker.md:1) (add the `migrate` service), and
  close the backup gap in [`Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:309) §7.
- Keep the `**Utolsó frissítés:**` header date current in every touched spec (repo rule).
- DoD: docs match the implemented code and the spec-maintenance rule is satisfied.

---

## Import notes (for the later JIRA step)

- 5 Stories + 22 Sub-tasks total.
- Fields to set on import: Summary, Issue Type (Story / Sub-task), Description, Parent (for Sub-tasks).
- Fields intentionally left empty: Assignee, Priority, Labels, Epic link (can be added later if desired).
