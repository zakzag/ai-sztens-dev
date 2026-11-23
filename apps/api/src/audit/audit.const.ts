/**
 * Server-side constants of the audit module (AIS-177).
 *
 * Only what the **server** needs lives here: the DI tokens, the table-name
 * allow-list and the source value an admin HTTP write uses. Contract limits
 * (`AUDIT_IP_ADDRESS_MAX_LENGTH`, …) stay in `@callback/shared`, so the writer
 * and the response schema can never disagree about them.
 */

import { AUDIT_LOG_TABLE_VALUES } from '@callback/shared';

/**
 * DI token of the {@link AuditWriter} implementation.
 *
 * A string token (not the class), exactly like `API_KEYS_REPOSITORY`: the
 * consumers depend on the interface, and a writer spec can inject a plain mock
 * object without Nest and without a database.
 */
export const AUDIT_WRITER = 'AUDIT_WRITER';

/** DI token of the {@link AuditRepository} implementation. */
export const AUDIT_REPOSITORY = 'AUDIT_REPOSITORY';

/** DI token of the {@link AuditActorProvider} implementation. */
export const AUDIT_ACTOR_PROVIDER = 'AUDIT_ACTOR_PROVIDER';

/**
 * Every table whose writes are audited.
 *
 * A closed list on purpose: `audit_logs.table_name` is free text in the
 * database (the ledger has no FK), so the compile-time narrowing here is what
 * keeps a typo out of the log. `customer_tags` has a composite primary key and
 * therefore no uuid `record_id` — its audit rows carry the pair in the payload.
 *
 * The tuple itself lives in `@callback/shared` (`AUDIT_LOG_TABLE_VALUES`), because
 * the ledger **read** endpoint (AIS-178/f) publishes the same set as the
 * `?tableName=` enum. Re-exporting it here keeps one list and one type.
 */
export const AUDIT_TABLE_NAMES = AUDIT_LOG_TABLE_VALUES;

/** The entry point an admin HTTP write comes from. */
export const AUDIT_SOURCE_ADMIN_API = 'admin_api';

/**
 * Keys dropped from both sides of a diff.
 *
 * `updated_at` changes on every write, so keeping it would make every audit row
 * look "changed" and bury the fields that actually moved. `occurred_at` already
 * records when the change happened.
 */
export const AUDIT_DIFF_IGNORED_KEYS: readonly string[] = [
  'updated_at',
  'updatedAt',
];

/**
 * The actor recorded while the admin API has no authentication (AIS-14 `D-A`).
 *
 * The auth story (AIS-73/74) replaces the provider, not the schema and not the
 * writer: every row written until then honestly says "system did it".
 */
export const AUDIT_SYSTEM_ACTOR_NAME = 'system';

/** Character class an IPv4/IPv6 literal may use (`inet` rejects anything else). */
export const AUDIT_IP_ADDRESS_PATTERN = /^[0-9a-fA-F:.]+$/;

/** Header carrying the client's user agent. */
export const USER_AGENT_HEADER = 'user-agent';
