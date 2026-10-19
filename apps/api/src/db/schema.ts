/**
 * Drizzle schema-as-code — the single source of truth for the database schema.
 *
 * Every table lives in a per-context Postgres schema (`callback`, `platform`,
 * `email`), created and granted by `infra/postgres/init/02-schemas.sh`. The
 * schema boundary mirrors the module boundary, which is why the grants can stay
 * coarse and stable (see `docs/Specs/Database-Local.md`).
 *
 * Workflow (AIS-36): edit this file, run `pnpm --filter @callback/api db:generate`,
 * review the generated SQL under `apps/api/drizzle/`, then `db:migrate`.
 * The generated migration and its `meta/` snapshot are both committed.
 */
import { sql } from 'drizzle-orm';
import { pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CallStatus } from '@callback/shared';

/**
 * The `callback` bounded context: everything about a call-back request and the
 * phone call it triggers.
 */
export const callbackSchema = pgSchema('callback');

/**
 * The call lifecycle, mirrored from the shared `CallStatus` union.
 *
 * `satisfies readonly CallStatus[]` keeps the two definitions in sync at
 * compile time — adding a status to `@callback/shared` without extending this
 * tuple (or vice versa) fails the build instead of drifting silently.
 *
 * NOTE: adding a value later requires its own migration (`ALTER TYPE … ADD
 * VALUE` cannot run inside a transaction block alongside other DDL), which is
 * why the list is kept in a single, explicitly named constant.
 */
export const CALL_STATUS_VALUES = [
  'queued',
  'dialing',
  'ringing',
  'in-progress',
  'completed',
  'failed',
  'no_answer',
  'busy',
  'actions-executing',
  'done',
] as const satisfies readonly CallStatus[];

/** Postgres enum type `callback.call_status`. */
export const callStatusEnum = callbackSchema.enum(
  'call_status',
  CALL_STATUS_VALUES,
);

/**
 * `callback.callback_requests` — one row per submitted call-back request.
 *
 * Column widths mirror the validation limits of the write path
 * ([`create-callback-request.dto.ts`](../callback-requests/dto/create-callback-request.dto.ts:10)):
 * name ≤ 120, email ≤ 254, phone ≤ 20, reason ≤ 1000. A request that passes
 * validation can therefore never fail on a length constraint.
 *
 * `status` defaults to the first state of the state machine (`queued`), so a
 * plain insert — without the API deciding the status — is still valid.
 * `created_at` is stored as `timestamptz`; the shared `CallbackRequest` type
 * exposes it as an ISO string, and the row→view-model mapping belongs to the
 * repository layer (AIS-38).
 */
export const callbackRequests = callbackSchema.table('callback_requests', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  reason: varchar('reason', { length: 1000 }).notNull(),
  status: callStatusEnum('status').notNull().default('queued'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Row shape as returned by Postgres (`createdAt` is a `Date` here). */
export type CallbackRequestRow = typeof callbackRequests.$inferSelect;

/** Insert shape: everything except `id` and `createdAt` has a DB default. */
export type NewCallbackRequestRow = typeof callbackRequests.$inferInsert;
