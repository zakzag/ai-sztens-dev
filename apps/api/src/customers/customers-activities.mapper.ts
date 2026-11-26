/**
 * Pure mapping of the customer-activity aggregate (AIS-178, slice f).
 *
 * Row → wire payload, a validated body → an insert payload, and the record the
 * audit diff compares. No I/O, no Nest, no Drizzle query building, so every
 * branch is trivial to unit test.
 *
 * Two details a future editor should not "simplify" away:
 *
 * 1. **The author never comes from the request.** {@link toActivityAuthorColumns}
 *    turns the `AuditActor` the provider resolved into the four author columns,
 *    so a client cannot write an entry in someone else's name (`F3`).
 * 2. **`metadata` keeps `undefined` and `null` apart.** `undefined` (absent in
 *    the body) means "leave the column alone"; `null` means "clear it" (`P7`).
 */

import type {
  Activity,
  AuthorType,
  CreateActivityInput,
  UpdateActivityInput,
} from '@callback/shared';
import type { AuditActor } from '../audit/audit.interface.js';
import type { ActivityRow, NewActivityRow } from '../db/schema.js';
import { ActivityAuthorIncompleteError } from './customers-activities.errors.js';
import type { ActivityPatch } from './customers-activities.interface.js';
import { toJsonRecord } from './customers-json.logic.js';

/**
 * The four author columns of one activity row.
 *
 * Exactly one reference is filled, matching `activities_author_reference_check`.
 */
export interface ActivityAuthorColumns {
  /** `operator` / `customer_user` / `system` / `api_key`. */
  readonly authorType: AuthorType;

  /** The staff id, only when `authorType = 'operator'`. */
  readonly operatorId: string | null;

  /** The login-user id, only when `authorType = 'customer_user'`. */
  readonly customerUserId: string | null;

  /** Snapshot of the author's display name at write time. */
  readonly authorName: string;
}

/**
 * Maps a stored activity row to the wire payload.
 *
 * @param row - the row as read or as written.
 * @returns the `Activity` payload (`Date` → ISO 8601).
 */
export function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    customerId: row.customerId,
    type: row.type,
    body: row.body,
    authorType: row.authorType,
    operatorId: row.operatorId,
    customerUserId: row.customerUserId,
    authorName: row.authorName,
    metadata: toJsonRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt === null ? null : row.updatedAt.toISOString(),
  };
}

/**
 * The concurrency token of one activity (`F4`).
 *
 * `activities.updated_at` is **nullable** and means "never edited", so the last
 * write instant is `updatedAt ?? createdAt`. Comparing against `updatedAt` alone
 * would make the first edit of every activity impossible.
 *
 * @param row - the row as read.
 * @returns the instant a `PATCH` must echo to be accepted.
 */
export function lastWriteOf(row: ActivityRow): Date {
  return row.updatedAt ?? row.createdAt;
}

/**
 * Turns the resolved audit actor into the four author columns.
 *
 * @param actor - the actor the `AUDIT_ACTOR_PROVIDER` resolved.
 * @returns the author columns of the row to insert.
 * @throws {ActivityAuthorIncompleteError} when the actor type requires an id and
 *   arrived without one — the database check would reject it anyway, and this
 *   names the wiring problem instead.
 */
export function toActivityAuthorColumns(
  actor: AuditActor,
): ActivityAuthorColumns {
  switch (actor.type) {
    case 'operator':
      return {
        authorType: actor.type,
        operatorId: requireActorId(actor),
        customerUserId: null,
        authorName: actor.name,
      };

    case 'customer_user':
      return {
        authorType: actor.type,
        operatorId: null,
        customerUserId: requireActorId(actor),
        authorName: actor.name,
      };

    case 'system':
    case 'api_key':
      return {
        authorType: actor.type,
        operatorId: null,
        customerUserId: null,
        authorName: actor.name,
      };
  }
}

/**
 * @param actor - an actor whose type requires an id.
 * @returns the id.
 * @throws {ActivityAuthorIncompleteError} when the id is missing.
 */
function requireActorId(actor: AuditActor): string {
  if (actor.id === null) {
    throw new ActivityAuthorIncompleteError(actor.type);
  }

  return actor.id;
}

/**
 * Builds the insert payload of a new activity.
 *
 * `createdAt`, `updatedAt` and `deletedAt` are **not** set: they are server
 * values (column defaults), and a client cannot reach them through the strict
 * request schema.
 *
 * @param customerId - the parent customer from the route.
 * @param input - body validated by the shared `createActivitySchema`.
 * @param actor - the author resolved from the provider, never from the body.
 * @returns insert payload for `activity.activities`.
 */
export function toNewActivityRow(
  customerId: string,
  input: CreateActivityInput,
  actor: AuditActor,
): NewActivityRow {
  const author = toActivityAuthorColumns(actor);

  return {
    customerId,
    type: input.type,
    body: input.body,
    authorType: author.authorType,
    operatorId: author.operatorId,
    customerUserId: author.customerUserId,
    authorName: author.authorName,
    metadata: input.metadata ?? null,
  };
}

/**
 * Narrows a validated `PATCH` body to the writable columns.
 *
 * Presence, not truthiness: an absent field stays absent (the column is not
 * written), while `metadata: null` is written as `null` to clear it.
 *
 * @param input - body validated by the shared `updateActivitySchema`.
 * @returns the column patch.
 */
export function toActivityPatch(input: UpdateActivityInput): ActivityPatch {
  const patch: { body?: string; metadata?: Record<string, unknown> | null } =
    {};

  if (input.body !== undefined) {
    patch.body = input.body;
  }

  if (input.metadata !== undefined) {
    patch.metadata = input.metadata;
  }

  return patch;
}

/**
 * @param patch - the narrowed column patch.
 * @returns `true` when at least one column is written.
 */
export function hasActivityPatch(patch: ActivityPatch): boolean {
  return patch.body !== undefined || patch.metadata !== undefined;
}

/**
 * Flattens an activity row into the payload the audit diff compares.
 *
 * @param row - the row as read or as written.
 * @returns a plain record of the business columns.
 */
export function toActivityAuditPayload(
  row: ActivityRow,
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    customerId: row.customerId,
    type: row.type,
    body: row.body,
    authorType: row.authorType,
    operatorId: row.operatorId,
    customerUserId: row.customerUserId,
    authorName: row.authorName,
    metadata: toJsonRecord(row.metadata),
  };
}
