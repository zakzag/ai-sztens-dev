/**
 * Drizzle schema-as-code — the single source of truth for the database schema.
 *
 * Every table lives in a per-context Postgres schema, created and granted by
 * `infra/postgres/init/02-schemas.sh`. The schema boundary mirrors the module
 * boundary, which is why the grants can stay coarse and stable (see
 * `docs/Specs/Database-Local.md`).
 *
 * AIS-64 (2026-10-21) removed the whole callback context: the `callback`
 * Postgres schema, `callback.callback_requests` and the `callback.call_status`
 * enum are gone, together with the in-memory store and the admin/web pages that
 * used them.
 *
 * AIS-39 (2026-10-21) added the first real domain table, `platform.api_keys`.
 * Contract notes for the consumers (AIS-40 repository/API, AIS-41 admin page):
 *
 * - every column name is spelled out explicitly — this config uses no `casing`
 *   option, so Drizzle would otherwise emit `apiKey` instead of `api_key`;
 * - `identifier` is the search key and carries the *named* unique constraint
 *   `api_keys_identifier_key`, so the API can map a Postgres `23505` to a
 *   `409 Conflict` without matching error text;
 * - `description` and `expires_at` are nullable (both are optional in the form);
 * - `updated_at` is maintained by Drizzle's `$onUpdate` and therefore only on
 *   writes that go through the Drizzle handle — there is no DB trigger yet.
 *
 * Workflow (AIS-36): edit this file, run
 * `pnpm --filter @callback/api db:generate`, review the generated SQL under
 * `apps/api/drizzle/`, then `db:migrate`. The generated migration and its
 * `meta/` snapshot are both committed.
 */

import { pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/** The operations context: migration bookkeeping and cross-cutting records. */
export const platformSchema = pgSchema('platform');

/**
 * Stored credentials for external AI providers and internal integrations.
 *
 * `api_key` holds the token value itself (AIS-39 scope). Hashing and rotation
 * are explicitly out of scope and are tracked as a follow-up.
 */
export const apiKeys = platformSchema.table(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    identifier: text('identifier').notNull(),
    description: text('description'),
    apiKey: text('api_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique('api_keys_identifier_key').on(table.identifier)],
);

/** Shape of a row read from `platform.api_keys`. */
export type ApiKeyRow = typeof apiKeys.$inferSelect;

/** Shape accepted by an insert into `platform.api_keys`. */
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
