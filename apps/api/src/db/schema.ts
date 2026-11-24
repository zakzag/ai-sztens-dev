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
 * AIS-108 (2026-11-02) added `deleted_at`: the delete endpoint is a **soft**
 * delete, so the row survives (audit trail, an undelete stays possible) and
 * every read has to filter on it. That filter lives in
 * `api-keys/api-keys.filter.ts` (`apiKeyNotDeletedFilter()`), not here — the
 * schema only declares the column and its index.
 *
 * AIS-18 (2026-11-22) added the customer aggregate (`customer` schema) and the
 * IAM context (`iam` schema). Four rules shaped it, and a future editor should
 * not "simplify" them away:
 *
 * 1. **Enum values mirror the shared contract, and a test proves it.**
 *    `drizzle-kit` is a CommonJS bundle, so it cannot `require()` the
 *    ESM-only `@callback/shared` (that is why the tuples are repeated here
 *    instead of imported). `schema.spec.ts` asserts every enum below against
 *    the tuple `packages/shared/src/contract/customers/customers.enums.ts`
 *    exports, so a value added on one side fails the build on the other.
 * 2. **The table order is load-bearing.** Foreign keys are emitted inline in
 *    `CREATE TABLE`, so the definitions below follow the dependency order
 *    `operators → customers → tags → customer_tags → customer_users → contacts
 *    → contact_roles`.
 * 3. **Composite foreign keys replace the impossible `CHECK`s.** A table
 *    `CHECK` cannot read another table, so "the contact's user belongs to the
 *    same customer" and "the role row points at its own customer" are enforced
 *    by composite foreign keys instead. Each of them needs a `UNIQUE` on the
 *    referenced pair (`customer_users_customer_id_id_key`,
 *    `contacts_id_customer_id_key`) — that is not redundancy, it is what makes
 *    the FK legal.
 * 4. **Partial unique indexes carry the invariants**: one live tax number, one
 *    `primary` contact per customer, one active `owner` per customer.
 *
 * AIS-177 (2026-11-22) added the `activity` context (`activities`) and the
 * `audit` context (`audit_logs`). Four rules shaped it:
 *
 * 1. **`audit_logs` has no foreign keys on purpose.** `customer_id`, `record_id`
 *    and `actor_id` are references by *value* only, so the log stays readable
 *    after the customer is anonymised, the record is deleted or the staff
 *    member is gone. A FK here would delete the evidence together with the row.
 * 2. **Append-only is enforced by a trigger, not by grants.** Migrations run as
 *    the app role, which *owns* the table and therefore keeps `UPDATE`/`DELETE`
 *    no matter what is granted. `0007_audit_immutability.sql` adds the
 *    `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` triggers.
 * 3. **`audit.audit_logs.actor_type` reuses `activity.author_type`.** One
 *    Postgres type carries the "who" vocabulary for both tables, so the two can
 *    never drift; the migration therefore creates that type first.
 * 4. **The author foreign keys use the default `NO ACTION`.** `SET NULL` would
 *    violate `activities_author_reference_check`, and `RESTRICT` is checked
 *    row-by-row — it would break the `customers → customer_users` cascade.
 *    `NO ACTION` is checked at end-of-statement, which is exactly what a
 *    multi-path cascade needs.
 *
 * Workflow (AIS-36): edit this file, run
 * `pnpm --filter @callback/api db:generate`, review the generated SQL under
 * `apps/api/drizzle/`, then `db:migrate`. The generated migration and its
 * `meta/` snapshot are both committed.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  inet,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** The operations context: migration bookkeeping and cross-cutting records. */
export const platformSchema = pgSchema('platform');

/** The customer aggregate: the company, its contacts and its tags. */
export const customerSchema = pgSchema('customer');

/** Identity context: our own staff and the customers' login users. */
export const iamSchema = pgSchema('iam');

/** The activity feed of a customer: notes, calls, mails, meetings. */
export const activitySchema = pgSchema('activity');

/** The immutable ledger: one row per audited write, append-only. */
export const auditSchema = pgSchema('audit');

/**
 * Every timestamp is stored with **millisecond** precision (AIS-108).
 *
 * The wire contract is `Date.prototype.toISOString()` (millisecond resolution),
 * so a column with Postgres' default microsecond precision holds values the
 * client can never express: the `updated_at` optimistic-concurrency token is
 * echoed back by the client as milliseconds, and `WHERE updated_at = $expected`
 * would then never match the stored `…123456Z` row — every update would be a
 * spurious `409 STALE_WRITE`. Storing what the contract can represent keeps the
 * comparison exact.
 */
const TIMESTAMP_PRECISION = 3;

/**
 * The shared timestamp trio, as factory functions.
 *
 * A factory (and not a shared object) because a column builder belongs to
 * exactly one table; calling it per table keeps the names identical across
 * tables while the builders stay independent.
 */
function createdAt() {
  return timestamp('created_at', {
    withTimezone: true,
    precision: TIMESTAMP_PRECISION,
  })
    .notNull()
    .defaultNow();
}

function updatedAt() {
  return timestamp('updated_at', {
    withTimezone: true,
    precision: TIMESTAMP_PRECISION,
  })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
}

/**
 * The **nullable** edit marker (AIS-177).
 *
 * `activitySchema.updatedAt` is `isoDateTimeSchema.nullable()` in the shared
 * contract — an activity is usually written once and never edited, so "never
 * edited" has to be representable. The `updatedAt()` factory above cannot do
 * that: it is `NOT NULL DEFAULT now()`.
 */
function nullableUpdatedAt() {
  return timestamp('updated_at', {
    withTimezone: true,
    precision: TIMESTAMP_PRECISION,
  });
}

/**
 * Soft-delete marker: `NULL` = live, a timestamp = deleted.
 *
 * Deliberately **not** a boolean plus a separate column, and deliberately not a
 * hard `DELETE`: the moment of deletion is the piece an audit trail needs, and
 * hiding a row is a read-side decision that stays reversible.
 */
function deletedAt() {
  return timestamp('deleted_at', {
    withTimezone: true,
    precision: TIMESTAMP_PRECISION,
  });
}

// ---------------------------------------------------------------------------
// platform
// ---------------------------------------------------------------------------

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
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      precision: TIMESTAMP_PRECISION,
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    unique('api_keys_identifier_key').on(table.identifier),
    // Every read filters `deleted_at IS NULL`; the index keeps that cheap and
    // also serves a future "undelete / purge" job that scans the opposite.
    index('api_keys_deleted_at_idx').on(table.deletedAt),
  ],
);

/** Shape of a row read from `platform.api_keys`. */
export type ApiKeyRow = typeof apiKeys.$inferSelect;

/** Shape accepted by an insert into `platform.api_keys`. */
export type NewApiKeyRow = typeof apiKeys.$inferInsert;

// ---------------------------------------------------------------------------
// Enums (mirrors of the shared contract — see header note 1)
// ---------------------------------------------------------------------------

/**
 * Legal nature of a customer. `individual` is deliberately absent.
 *
 * Mirrors `CUSTOMER_TYPE_VALUES` in
 * `packages/shared/src/contract/customers/customers.enums.ts`.
 */
export const CUSTOMER_TYPE_DB_VALUES = [
  'company',
  'sole_proprietor',
  'organization',
  'tax_number_individual',
] as const;

/** Lifecycle state of a customer. Mirrors `CUSTOMER_STATUS_VALUES`. */
export const CUSTOMER_STATUS_DB_VALUES = [
  'prospect',
  'registered',
  'trial',
  'active',
  'suspended',
  'churned',
  'anonymized',
] as const;

/** Acquisition channel. Mirrors `CUSTOMER_SOURCE_VALUES`. */
export const CUSTOMER_SOURCE_DB_VALUES = [
  'website',
  'referral',
  'in_person',
  'questionnaire',
  'partner',
  'manual',
] as const;

/** Headcount band — exactly three values. Mirrors `HEADCOUNT_RANGE_VALUES`. */
export const HEADCOUNT_RANGE_DB_VALUES = ['sole', '2_5', '6_20'] as const;

/** Role of a contact; one contact may hold several. Mirrors `CONTACT_ROLE_VALUES`. */
export const CONTACT_ROLE_DB_VALUES = [
  'primary',
  'technical',
  'alerting',
] as const;

/** Role of a customer login user. Mirrors `CUSTOMER_USER_ROLE_VALUES`. */
export const CUSTOMER_USER_ROLE_DB_VALUES = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

/** Status of a customer login user. Mirrors `CUSTOMER_USER_STATUS_VALUES`. */
export const CUSTOMER_USER_STATUS_DB_VALUES = [
  'invited',
  'active',
  'inactive',
] as const;

/** Role of one of our own staff members. Mirrors `OPERATOR_ROLE_VALUES`. */
export const OPERATOR_ROLE_DB_VALUES = ['superadmin', 'operator'] as const;

/** `customer.customer_type`. */
export const customerTypeEnum = customerSchema.enum(
  'customer_type',
  CUSTOMER_TYPE_DB_VALUES,
);

/** `customer.customer_status`. */
export const customerStatusEnum = customerSchema.enum(
  'customer_status',
  CUSTOMER_STATUS_DB_VALUES,
);

/** `customer.customer_source`. */
export const customerSourceEnum = customerSchema.enum(
  'customer_source',
  CUSTOMER_SOURCE_DB_VALUES,
);

/** `customer.headcount_range`. */
export const headcountRangeEnum = customerSchema.enum(
  'headcount_range',
  HEADCOUNT_RANGE_DB_VALUES,
);

/** `customer.contact_role`. */
export const contactRoleEnum = customerSchema.enum(
  'contact_role',
  CONTACT_ROLE_DB_VALUES,
);

/** `iam.customer_user_role`. */
export const customerUserRoleEnum = iamSchema.enum(
  'customer_user_role',
  CUSTOMER_USER_ROLE_DB_VALUES,
);

/** `iam.customer_user_status`. */
export const customerUserStatusEnum = iamSchema.enum(
  'customer_user_status',
  CUSTOMER_USER_STATUS_DB_VALUES,
);

/** `iam.operator_role`. */
export const operatorRoleEnum = iamSchema.enum(
  'operator_role',
  OPERATOR_ROLE_DB_VALUES,
);

/** Kind of an activity entry. Mirrors `ACTIVITY_TYPE_VALUES` (AIS-177). */
export const ACTIVITY_TYPE_DB_VALUES = [
  'note',
  'call',
  'email',
  'meeting',
  'status_change',
  'system',
] as const;

/**
 * Who wrote an activity or performed an audited change (AIS-177).
 *
 * Mirrors `AUTHOR_TYPE_VALUES` — **four** values. The Jira ticket lists only
 * three; `api_key` is in the frozen AIS-16 contract, so the `CHECK` below has a
 * fourth branch for it. A machine caller has no operator row, which is why it
 * cannot be folded into `system`.
 */
export const AUTHOR_TYPE_DB_VALUES = [
  'operator',
  'customer_user',
  'system',
  'api_key',
] as const;

/** Operation recorded by the audit log. Mirrors `AUDIT_OPERATION_VALUES`. */
export const AUDIT_OPERATION_DB_VALUES = [
  'insert',
  'update',
  'delete',
  'soft_delete',
] as const;

/** Entry point that produced an audited change. Mirrors `AUDIT_SOURCE_VALUES`. */
export const AUDIT_SOURCE_DB_VALUES = [
  'admin_api',
  'web',
  'worker',
  'cron',
] as const;

/** `activity.activity_type`. */
export const activityTypeEnum = activitySchema.enum(
  'activity_type',
  ACTIVITY_TYPE_DB_VALUES,
);

/**
 * `activity.author_type` — **shared** by both tables (header note 3).
 *
 * `audit.audit_logs.actor_type` uses this same type, so "operator" cannot mean
 * one thing in the feed and another in the ledger.
 */
export const authorTypeEnum = activitySchema.enum(
  'author_type',
  AUTHOR_TYPE_DB_VALUES,
);

/** `audit.audit_operation`. */
export const auditOperationEnum = auditSchema.enum(
  'audit_operation',
  AUDIT_OPERATION_DB_VALUES,
);

/** `audit.audit_source`. */
export const auditSourceEnum = auditSchema.enum(
  'audit_source',
  AUDIT_SOURCE_DB_VALUES,
);

// ---------------------------------------------------------------------------
// iam.operators — must come first: `customers` and `customer_users` point here
// ---------------------------------------------------------------------------

/**
 * Our own staff ("bejelentkezve mint … superadmin"), not customer users.
 *
 * The two live in separate tables because their lifecycles differ: an operator
 * exists independently of any customer, while a customer user is owned by one.
 */
export const operators = iamSchema.table(
  'operators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    role: operatorRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [unique('operators_email_key').on(table.email)],
);

/** Shape of a row read from `iam.operators`. */
export type OperatorRow = typeof operators.$inferSelect;

/** Shape accepted by an insert into `iam.operators`. */
export type NewOperatorRow = typeof operators.$inferInsert;

// ---------------------------------------------------------------------------
// customer.customers
// ---------------------------------------------------------------------------

/**
 * The company record.
 *
 * There is **no** `note` column on purpose (AIS-16 D9): every remark about a
 * customer is an `activities` row, which is why the free-text remark never has
 * two possible homes. There is no billing column either (AIS-16 D4) — those
 * belong to the deferred `service` schema (AIS-176).
 */
export const customers = customerSchema.table(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Generated display identifier, `AIS-YYYYMM-NNN`. */
    customerNumber: text('customer_number').notNull(),
    type: customerTypeEnum('type').notNull(),
    legalName: text('legal_name').notNull(),
    shortName: text('short_name'),
    taxNumber: text('tax_number'),
    euVatNumber: text('eu_vat_number'),
    companyRegistrationNumber: text('company_registration_number'),
    legalForm: text('legal_form'),
    registeredAddressZip: text('registered_address_zip'),
    registeredAddressCity: text('registered_address_city'),
    registeredAddressLine: text('registered_address_line'),
    registeredAddressCountry: text('registered_address_country')
      .notNull()
      .default('HU'),
    industry: text('industry'),
    headcountRange: headcountRangeEnum('headcount_range'),
    source: customerSourceEnum('source'),
    /**
     * The operator who owns the relationship. `SET NULL` rather than
     * `CASCADE`: losing a staff member must not delete the customer.
     */
    responsibleOperatorId: uuid('responsible_operator_id').references(
      () => operators.id,
      { onDelete: 'set null' },
    ),
    status: customerStatusEnum('status').notNull(),
    /**
     * When the current status was entered. The service maintains it, which is
     * why `status` is not part of the general `PATCH` contract (AIS-16 D2).
     */
    statusChangedAt: timestamp('status_changed_at', {
      withTimezone: true,
      precision: TIMESTAMP_PRECISION,
    })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    unique('customers_customer_number_key').on(table.customerNumber),
    // One tax number may exist only once among the **live** rows: an
    // anonymised or deleted customer must not block a legitimate reuse, and a
    // missing tax number is a valid state ("incomplete data", AIS-16 D1).
    uniqueIndex('customers_tax_number_key')
      .on(table.taxNumber)
      .where(
        sql`${table.taxNumber} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    // Same shape the shared `huTaxNumberSchema` enforces, restated at the
    // storage boundary so a hand-written INSERT cannot smuggle a bad value in.
    check(
      'customers_tax_number_format_check',
      sql`${table.taxNumber} IS NULL OR ${table.taxNumber} ~ '^\\d{8}-[1-5]-\\d{2}$'`,
    ),
  ],
);

/** Shape of a row read from `customer.customers`. */
export type CustomerRow = typeof customers.$inferSelect;

/** Shape accepted by an insert into `customer.customers`. */
export type NewCustomerRow = typeof customers.$inferInsert;

// ---------------------------------------------------------------------------
// customer.tags + customer.customer_tags
// ---------------------------------------------------------------------------

/**
 * Reusable label catalogue (`premium`, `vip`, `accounting_partner`, …).
 *
 * A catalogue and not a `text[]` column: renaming a label must update every
 * customer at once, duplicates must be impossible, and "which customers carry
 * this label" must be an indexed lookup.
 */
export const tags = customerSchema.table(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [unique('tags_name_key').on(table.name)],
);

/** Shape of a row read from `customer.tags`. */
export type TagRow = typeof tags.$inferSelect;

/** Shape accepted by an insert into `customer.tags`. */
export type NewTagRow = typeof tags.$inferInsert;

/** Many-to-many join: which labels a customer carries. */
export const customerTags = customerSchema.table(
  'customer_tags',
  {
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // Composite PK: the same label cannot be attached twice.
    primaryKey({
      name: 'customer_tags_pkey',
      columns: [table.customerId, table.tagId],
    }),
    index('customer_tags_tag_id_idx').on(table.tagId),
  ],
);

/** Shape of a row read from `customer.customer_tags`. */
export type CustomerTagRow = typeof customerTags.$inferSelect;

/** Shape accepted by an insert into `customer.customer_tags`. */
export type NewCustomerTagRow = typeof customerTags.$inferInsert;

// ---------------------------------------------------------------------------
// iam.customer_users
// ---------------------------------------------------------------------------

/**
 * A login user that belongs to exactly one customer.
 *
 * No membership table: the role, the invitation state and the login state live
 * on the user row, and deleting the customer deletes its users (AIS-16 D…,
 * 2026-11-15 plan §3.2).
 */
export const customerUsers = iamSchema.table(
  'customer_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    /** `NULL` while the invitation is pending; accepting sets the hash. */
    passwordHash: text('password_hash'),
    role: customerUserRoleEnum('role').notNull(),
    status: customerUserStatusEnum('status').notNull(),
    invitedByOperatorId: uuid('invited_by_operator_id').references(
      () => operators.id,
      { onDelete: 'set null' },
    ),
    invitedAt: timestamp('invited_at', {
      withTimezone: true,
      precision: TIMESTAMP_PRECISION,
    }),
    acceptedAt: timestamp('accepted_at', {
      withTimezone: true,
      precision: TIMESTAMP_PRECISION,
    }),
    lastLoginAt: timestamp('last_login_at', {
      withTimezone: true,
      precision: TIMESTAMP_PRECISION,
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // Target of the `contacts` composite foreign key (header note 3). It is
    // also a legitimate constraint on its own: the pair is the row's identity
    // inside one customer.
    unique('customer_users_customer_id_id_key').on(table.customerId, table.id),
    // Login is e-mail based, so uniqueness must be case-insensitive.
    uniqueIndex('customer_users_email_key').on(sql`lower(${table.email})`),
    // Exactly one active owner per customer (2026-11-15 plan, SA-D8).
    uniqueIndex('customer_users_customer_owner_key')
      .on(table.customerId)
      .where(sql`${table.role} = 'owner' AND ${table.status} = 'active'`),
    index('customer_users_customer_id_idx').on(table.customerId),
  ],
);

/** Shape of a row read from `iam.customer_users`. */
export type CustomerUserRow = typeof customerUsers.$inferSelect;

/** Shape accepted by an insert into `iam.customer_users`. */
export type NewCustomerUserRow = typeof customerUsers.$inferInsert;

// ---------------------------------------------------------------------------
// customer.contacts
// ---------------------------------------------------------------------------

/** A contact person of a customer; optionally also a login user. */
export const contacts = customerSchema.table(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: text('position'),
    email: text('email'),
    phone: text('phone'),
    /**
     * The replacement for the mockup's "is a login user?" boolean: when set,
     * this contact is also a customer user. `NULL` = not a login user.
     */
    customerUserId: uuid('customer_user_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    // Target of the `contact_roles` composite foreign key (header note 3).
    unique('contacts_id_customer_id_key').on(table.id, table.customerId),
    // A contact may only point at a user of **its own** customer. Expressed as
    // a composite FK because a `CHECK` cannot read another table. With
    // `customer_user_id IS NULL` Postgres' MATCH SIMPLE behaviour skips the
    // constraint, which is exactly the "not a login user" case.
    foreignKey({
      name: 'contacts_customer_user_id_fkey',
      columns: [table.customerId, table.customerUserId],
      foreignColumns: [customerUsers.customerId, customerUsers.id],
    }),
    index('contacts_customer_id_name_idx').on(table.customerId, table.name),
  ],
);

/** Shape of a row read from `customer.contacts`. */
export type ContactRow = typeof contacts.$inferSelect;

/** Shape accepted by an insert into `customer.contacts`. */
export type NewContactRow = typeof contacts.$inferInsert;

// ---------------------------------------------------------------------------
// customer.contact_roles
// ---------------------------------------------------------------------------

/**
 * Roles of a contact (`primary`, `technical`, `alerting`).
 *
 * `customer_id` is denormalised on purpose: it is what lets the partial unique
 * index below enforce "one primary contact per customer" without a trigger
 * (2026-11-15 plan, decision 4), and the composite FK keeps it honest.
 *
 * The table carries no `deleted_at`: roles are not history. When a contact is
 * soft-deleted its role rows are removed, otherwise the `primary` slot would
 * stay occupied forever.
 */
export const contactRoles = customerSchema.table(
  'contact_roles',
  {
    contactId: uuid('contact_id').notNull(),
    role: contactRoleEnum('role').notNull(),
    customerId: uuid('customer_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'contact_roles_pkey',
      columns: [table.contactId, table.role],
    }),
    // `customer_id` must equal the parent contact's `customer_id`. A `CHECK`
    // cannot see another table, so the equality rides on the composite FK.
    foreignKey({
      name: 'contact_roles_contact_id_fkey',
      columns: [table.contactId, table.customerId],
      foreignColumns: [contacts.id, contacts.customerId],
    }).onDelete('cascade'),
    uniqueIndex('contact_roles_primary_key')
      .on(table.customerId)
      .where(sql`${table.role} = 'primary'`),
  ],
);

/** Shape of a row read from `customer.contact_roles`. */
export type ContactRoleRow = typeof contactRoles.$inferSelect;

/** Shape accepted by an insert into `customer.contact_roles`. */
export type NewContactRoleRow = typeof contactRoles.$inferInsert;

// ---------------------------------------------------------------------------
// activity.activities
// ---------------------------------------------------------------------------

/**
 * One entry of a customer's activity feed (AIS-177).
 *
 * There is no `customers.note` column in this model: **every** free-form
 * remark is a row here with `type = 'note'` (AIS-16 `D9`), so a remark never
 * has two possible homes.
 *
 * Exactly one author reference is filled, and the author's *name* is stored as
 * a snapshot: deactivating an operator later must not make old entries
 * authorless. `metadata` is the escape hatch for type-specific payload (a call
 * duration, a status transition pair) — never a second copy of the columns.
 */
export const activities = activitySchema.table(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: activityTypeEnum('type').notNull(),
    body: text('body').notNull(),
    authorType: authorTypeEnum('author_type').notNull(),
    /**
     * `NO ACTION` (the default) and **not** `set null`: the `CHECK` below
     * requires this column exactly when `author_type = 'operator'`, so a
     * `SET NULL` action could never succeed.
     */
    operatorId: uuid('operator_id').references(() => operators.id),
    /**
     * `NO ACTION` as well, and deliberately **not** `restrict`: deleting a
     * customer cascades to its `customer_users` in the same statement, and
     * `restrict` is checked row-by-row, so it would abort that cascade.
     */
    customerUserId: uuid('customer_user_id').references(() => customerUsers.id),
    /** Snapshot of the author's display name at write time. */
    authorName: text('author_name').notNull(),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
    updatedAt: nullableUpdatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    // One actor, exactly: four branches, one per `author_type` value. Written
    // as a single disjunction so an impossible combination cannot slip through
    // a "mostly correct" set of separate checks.
    check(
      'activities_author_reference_check',
      sql`(
            (${table.authorType} = 'system'
              AND ${table.operatorId} IS NULL AND ${table.customerUserId} IS NULL)
         OR (${table.authorType} = 'operator'
              AND ${table.operatorId} IS NOT NULL AND ${table.customerUserId} IS NULL)
         OR (${table.authorType} = 'customer_user'
              AND ${table.operatorId} IS NULL AND ${table.customerUserId} IS NOT NULL)
         OR (${table.authorType} = 'api_key'
              AND ${table.operatorId} IS NULL AND ${table.customerUserId} IS NULL)
      )`,
    ),
    // The feed query is always "live rows of one customer, newest first"; the
    // partial predicate keeps soft-deleted rows out of the index entirely.
    index('activities_customer_created_idx')
      .on(table.customerId, table.createdAt.desc())
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

/** Shape of a row read from `activity.activities`. */
export type ActivityRow = typeof activities.$inferSelect;

/** Shape accepted by an insert into `activity.activities`. */
export type NewActivityRow = typeof activities.$inferInsert;

// ---------------------------------------------------------------------------
// audit.audit_logs
// ---------------------------------------------------------------------------

/**
 * The append-only ledger of every audited write (AIS-177).
 *
 * Written by `AuditWriter` only, inside the **same transaction** as the business
 * write it describes. There is no request schema for it: reads are the
 * `GET /:id/audit-logs` endpoint (AIS-178) and nothing else.
 *
 * No foreign keys (header note 1): `customer_id` becomes `NULL` on
 * anonymisation, and the row must survive the deletion of everything it points
 * at. `before_data`/`after_data` carry only the **changed** keys — see
 * `apps/api/src/audit/audit-diff.logic.ts`.
 */
export const auditLogs = auditSchema.table(
  'audit_logs',
  {
    /**
     * `bigint` identity and not `uuid`: the log is append-only and
     * monotonically ordered, so a sequence is the natural key. `mode: 'number'`
     * keeps the row type a plain `number` for the JSON contract.
     */
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    /** `NULL` after anonymisation — that is the whole point of having no FK. */
    customerId: uuid('customer_id'),
    tableName: text('table_name').notNull(),
    /**
     * `NULL` for rows without a uuid identity: `customer_tags` has a composite
     * primary key, so a join-row audit carries the pair in `after_data`
     * instead of inventing an id.
     */
    recordId: uuid('record_id'),
    operation: auditOperationEnum('operation').notNull(),
    beforeData: jsonb('before_data'),
    afterData: jsonb('after_data'),
    /** Reuses `activity.author_type` — header note 3. */
    actorType: authorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    /** Snapshot: the log must stay readable after the actor is gone. */
    actorName: text('actor_name').notNull(),
    /**
     * When the change happened — `occurred_at`, not the generic `created_at`
     * pair: the ledger has no edit lifecycle of its own, so "created" and
     * "occurred" would be the same fact under two names, and the contract calls
     * it `occurredAt`.
     */
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      precision: TIMESTAMP_PRECISION,
    })
      .notNull()
      .defaultNow(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    /** The envelope's correlation id, so a log row maps to one request. */
    requestId: text('request_id'),
    source: auditSourceEnum('source'),
  },
  (table) => [
    index('audit_logs_customer_occurred_idx').on(
      table.customerId,
      table.occurredAt.desc(),
    ),
    // "What happened to this record over time" — the per-record history view.
    index('audit_logs_table_record_idx').on(table.tableName, table.recordId),
    index('audit_logs_request_id_idx').on(table.requestId),
  ],
);

/** Shape of a row read from `audit.audit_logs`. */
export type AuditLogRow = typeof auditLogs.$inferSelect;

/** Shape accepted by an insert into `audit.audit_logs`. */
export type NewAuditLogRow = typeof auditLogs.$inferInsert;
