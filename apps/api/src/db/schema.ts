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
 * *
 * Workflow (AIS-36): edit this file, run
 * `pnpm --filter @callback/api db:generate`, review the generated SQL under
 * `apps/api/drizzle/`, then `db:migrate`. The generated migration and its
 * `meta/` snapshot are both committed.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
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
