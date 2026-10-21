/**
 * Drizzle schema-as-code — the single source of truth for the database schema.
 *
 * Every table lives in a per-context Postgres schema (`platform`, `email`),
 * created and granted by `infra/postgres/init/02-schemas.sh`. The schema
 * boundary mirrors the module boundary, which is why the grants can stay
 * coarse and stable (see `docs/Specs/Database-Local.md`).
 *
 * AIS-64 (2026-10-21) removed the whole callback context: the `callback`
 * Postgres schema, `callback.callback_requests` and the `callback.call_status`
 * enum are gone, together with the in-memory store and the admin/web pages that
 * used them. The next table to be added here is `platform.api_keys` (AIS-39),
 * so this file is intentionally empty for now — the public schema shape of the
 * Drizzle handle (`Database` in `./database.interface.ts`) stays valid because
 * `PostgresJsDatabase<{}>` is still a usable type.
 *
 * Workflow (AIS-36): edit this file, run
 * `pnpm --filter @callback/api db:generate`, review the generated SQL under
 * `apps/api/drizzle/`, then `db:migrate`. The generated migration and its
 * `meta/` snapshot are both committed.
 */

export {};
