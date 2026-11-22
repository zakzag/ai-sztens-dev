import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ACTIVITY_TYPE_VALUES,
  AUDIT_OPERATION_VALUES,
  AUDIT_SOURCE_VALUES,
  AUTHOR_TYPE_VALUES,
  CONTACT_ROLE_VALUES,
  CUSTOMER_SOURCE_VALUES,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  CUSTOMER_USER_ROLE_VALUES,
  CUSTOMER_USER_STATUS_VALUES,
  HEADCOUNT_RANGE_VALUES,
  OPERATOR_ROLE_VALUES,
} from '@callback/shared';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import {
  activities,
  activitySchema,
  activityTypeEnum,
  apiKeys,
  auditLogs,
  auditOperationEnum,
  auditSchema,
  auditSourceEnum,
  authorTypeEnum,
  contactRoleEnum,
  contactRoles,
  contacts,
  customers,
  customerSchema,
  customerSourceEnum,
  customerStatusEnum,
  customerTags,
  customerTypeEnum,
  customerUsers,
  customerUserRoleEnum,
  customerUserStatusEnum,
  headcountRangeEnum,
  iamSchema,
  operators,
  operatorRoleEnum,
  platformSchema,
  tags,
} from './schema.js';
import { readSqlExpression } from './test/helpers/sql-expression.js';

/**
 * Unit tests for the `platform.api_keys` schema contract (AIS-39).
 *
 * Nothing here touches a database: `getTableConfig()` reads the schema-as-code
 * the same way the migration generator does, so a renamed column, a lost
 * `NOT NULL`, a dropped unique constraint or a changed default fails here
 * instead of surfacing as a runtime error in AIS-40.
 *
 * The last block reads the committed migration, because `db:generate` writes SQL
 * that nobody reviews by accident — the generated file and the schema must agree.
 */

const config = getTableConfig(apiKeys);

/** `name / columnType / dataType / notNull` — the ticket's column mapping. */
const COLUMN_MAPPING = [
  ['id', 'PgUUID', 'string', true],
  ['name', 'PgText', 'string', true],
  ['identifier', 'PgText', 'string', true],
  ['description', 'PgText', 'string', false],
  ['api_key', 'PgText', 'string', true],
  ['expires_at', 'PgTimestamp', 'date', false],
  ['created_at', 'PgTimestamp', 'date', true],
  ['updated_at', 'PgTimestamp', 'date', true],
  // AIS-108: the soft-delete marker. Nullable on purpose — `NULL` means "live".
  ['deleted_at', 'PgTimestamp', 'date', false],
] as const;

const MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0002_minor_domino.sql', import.meta.url),
);

/** Migration that added `deleted_at` and its index (AIS-108). */
const SOFT_DELETE_MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0003_organic_firedrake.sql', import.meta.url),
);

/** Migration that narrowed every timestamp to millisecond precision (AIS-108). */
const TIMESTAMP_PRECISION_MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0004_numerous_gunslinger.sql', import.meta.url),
);

describe('apiKeys table identity', () => {
  it('lives in the platform schema', () => {
    expect(platformSchema.schemaName).toBe('platform');
    expect(config.schema).toBe('platform');
    expect(config.name).toBe('api_keys');
  });
});

describe('apiKeys column mapping', () => {
  it('declares the nine columns in order', () => {
    expect(config.columns.map((column) => column.name)).toEqual(
      COLUMN_MAPPING.map(([name]) => name),
    );
  });

  it.each(COLUMN_MAPPING)(
    'maps %s to %s / %s / notNull=%s',
    (name, columnType, dataType, notNull) => {
      const tableColumn = config.columns.find((column) => column.name === name);

      expect(tableColumn).toBeDefined();
      expect(tableColumn?.columnType).toBe(columnType);
      expect(tableColumn?.dataType).toBe(dataType);
      expect(tableColumn?.notNull).toBe(notNull);
    },
  );

  it('keeps the camelCase property names apart from the snake_case DB names', () => {
    expect(apiKeys.apiKey.name).toBe('api_key');
    expect(apiKeys.expiresAt.name).toBe('expires_at');
    expect(apiKeys.createdAt.name).toBe('created_at');
    expect(apiKeys.updatedAt.name).toBe('updated_at');
    expect(apiKeys.deletedAt.name).toBe('deleted_at');
  });

  it('leaves the soft-delete marker nullable and without a default', () => {
    // `NULL` = live; a timestamp = deleted. A default would mark every new row
    // as deleted, and `NOT NULL` would make "live" inexpressible.
    expect(apiKeys.deletedAt.notNull).toBe(false);
    expect(apiKeys.deletedAt.hasDefault).toBe(false);
  });
});

describe('apiKeys defaults', () => {
  it('generates the uuid on the database side', () => {
    expect(readSqlExpression(apiKeys.id.default)).toBe('gen_random_uuid()');
  });

  it('stamps both timestamps with now()', () => {
    expect(readSqlExpression(apiKeys.createdAt.default)).toBe('now()');
    expect(readSqlExpression(apiKeys.updatedAt.default)).toBe('now()');
  });

  it.each(['name', 'identifier', 'description', 'api_key', 'expires_at'])(
    'leaves %s without a default',
    (name) => {
      const tableColumn = config.columns.find((column) => column.name === name);

      expect(tableColumn?.hasDefault).toBe(false);
    },
  );
});

describe('apiKeys primary key', () => {
  it('has exactly one primary key column, id', () => {
    expect(
      config.columns
        .filter((column) => column.primary)
        .map((column) => column.name),
    ).toEqual(['id']);
    expect(apiKeys.id.primary).toBe(true);
    expect(config.primaryKeys).toEqual([]);
  });
});

describe('apiKeys unique constraint', () => {
  it('has exactly one unique constraint, on identifier', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['api_keys_identifier_key']);
    expect(
      config.uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name),
      ),
    ).toEqual([['identifier']]);
  });

  it('declares exactly one index, the soft-delete one (AIS-108)', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'api_keys_deleted_at_idx',
    ]);
    // Drizzle types `index.config.columns` as `any`, so the shape is asserted
    // through a narrow local view instead of leaking `any[]` through `.map()`.
    const indexedColumns = (config.indexes[0]?.config.columns ??
      []) as readonly {
      readonly name: string;
    }[];

    expect(indexedColumns.map((column) => column.name)).toEqual(['deleted_at']);
  });

  it('declares no checks or foreign keys', () => {
    expect(config.checks).toEqual([]);
    expect(config.foreignKeys).toEqual([]);
  });
});

describe('generated migration 0002', () => {
  const migration = readFileSync(MIGRATION_FILE, 'utf8');

  it('creates the table in the platform schema', () => {
    expect(migration).toContain('CREATE TABLE "platform"."api_keys"');
  });

  it('creates the schema idempotently, because it already exists on live volumes', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "platform"');
    // Anchored to the statement, so the explanatory SQL comment is allowed to
    // mention the unguarded form the generator originally emitted.
    expect(migration).not.toMatch(/^CREATE SCHEMA "platform"/m);
  });

  it('carries the named unique constraint the API maps to 409', () => {
    expect(migration).toContain(
      'CONSTRAINT "api_keys_identifier_key" UNIQUE("identifier")',
    );
  });

  it('stores the timestamps with time zone', () => {
    const timestampColumns =
      migration.match(/"\w+" timestamp with time zone/g) ?? [];

    expect(timestampColumns).toHaveLength(3);
  });
});

describe('generated migration 0003', () => {
  const migration = readFileSync(SOFT_DELETE_MIGRATION_FILE, 'utf8');

  it('adds the nullable deleted_at column', () => {
    expect(migration).toContain(
      'ALTER TABLE "platform"."api_keys" ADD COLUMN "deleted_at" timestamp with time zone',
    );
  });

  it('creates the soft-delete index every read can use', () => {
    expect(migration).toContain(
      'CREATE INDEX "api_keys_deleted_at_idx" ON "platform"."api_keys"',
    );
  });

  it('does not make the existing rows look deleted', () => {
    // No `NOT NULL` and no default: every current row is live by definition.
    expect(migration).not.toContain(
      'deleted_at" timestamp with time zone NOT NULL',
    );
    expect(migration).not.toContain('DEFAULT now()');
  });
});

describe('apiKeys timestamp precision (AIS-108)', () => {
  it('stores every timestamp with millisecond precision', () => {
    // The wire contract is `toISOString()` (milliseconds). A microsecond column
    // could hold a value the client cannot echo back, which would make every
    // `WHERE updated_at = $expected` a spurious `409 STALE_WRITE`.
    expect(apiKeys.createdAt.precision).toBe(3);
    expect(apiKeys.updatedAt.precision).toBe(3);
    expect(apiKeys.expiresAt.precision).toBe(3);
    expect(apiKeys.deletedAt.precision).toBe(3);
  });

  it('narrows the existing columns in migration 0004', () => {
    const migration = readFileSync(TIMESTAMP_PRECISION_MIGRATION_FILE, 'utf8');

    for (const column of [
      'created_at',
      'updated_at',
      'expires_at',
      'deleted_at',
    ]) {
      expect(migration).toContain(
        `ALTER COLUMN "${column}" SET DATA TYPE timestamp (3) with time zone`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AIS-18 — the customer aggregate (`customer`) and the IAM context (`iam`)
// ---------------------------------------------------------------------------

/** `[column name, drizzle columnType, notNull]` — the ticket's column mapping. */
type ColumnExpectation = readonly [
  name: string,
  columnType: string,
  notNull: boolean,
];

/** The seven tables AIS-18 introduced, with the schema each belongs to. */
const AIS_18_TABLES = [
  ['operators', operators, 'iam'],
  ['customers', customers, 'customer'],
  ['tags', tags, 'customer'],
  ['customer_tags', customerTags, 'customer'],
  ['customer_users', customerUsers, 'iam'],
  ['contacts', contacts, 'customer'],
  ['contact_roles', contactRoles, 'customer'],
] as const;

/** Every table whose rows carry a `status_changed_at`/`created_at` trio. */
const TIMESTAMPED_TABLES = [
  ['customers', customers],
  ['customer_users', customerUsers],
  ['contacts', contacts],
] as const;

/** The five tables with a generated uuid primary key (join tables use a pair). */
const UUID_KEYED_TABLES = [
  ['operators', operators],
  ['customers', customers],
  ['tags', tags],
  ['customer_users', customerUsers],
  ['contacts', contacts],
] as const;

/**
 * The database enums must carry **exactly** the tuples the shared contract
 * exports. `drizzle-kit` is CommonJS and cannot load the ESM-only
 * `@callback/shared`, so `schema.ts` repeats the values; this table is what
 * keeps the repetition honest.
 */
const ENUM_PARITY = [
  ['customer_type', customerTypeEnum, CUSTOMER_TYPE_VALUES],
  ['customer_status', customerStatusEnum, CUSTOMER_STATUS_VALUES],
  ['customer_source', customerSourceEnum, CUSTOMER_SOURCE_VALUES],
  ['headcount_range', headcountRangeEnum, HEADCOUNT_RANGE_VALUES],
  ['contact_role', contactRoleEnum, CONTACT_ROLE_VALUES],
  ['customer_user_role', customerUserRoleEnum, CUSTOMER_USER_ROLE_VALUES],
  ['customer_user_status', customerUserStatusEnum, CUSTOMER_USER_STATUS_VALUES],
  ['operator_role', operatorRoleEnum, OPERATOR_ROLE_VALUES],
  // AIS-177 — the activity feed and the audit ledger.
  ['activity_type', activityTypeEnum, ACTIVITY_TYPE_VALUES],
  ['author_type', authorTypeEnum, AUTHOR_TYPE_VALUES],
  ['audit_operation', auditOperationEnum, AUDIT_OPERATION_VALUES],
  ['audit_source', auditSourceEnum, AUDIT_SOURCE_VALUES],
] as const;

const MIGRATION_FILE_0005 = fileURLToPath(
  new URL('../../drizzle/0005_colossal_hobgoblin.sql', import.meta.url),
);

const MIGRATION_FILE_0006 = fileURLToPath(
  new URL('../../drizzle/0006_magenta_chameleon.sql', import.meta.url),
);

/** The hand-written migration that makes the ledger append-only (AIS-177). */
const MIGRATION_FILE_0007 = fileURLToPath(
  new URL('../../drizzle/0007_audit_immutability.sql', import.meta.url),
);

const OPERATORS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['email', 'PgText', true],
  ['role', 'PgEnumColumn', true],
  ['is_active', 'PgBoolean', true],
];

const CUSTOMERS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_number', 'PgText', true],
  ['type', 'PgEnumColumn', true],
  ['legal_name', 'PgText', true],
  ['short_name', 'PgText', false],
  ['tax_number', 'PgText', false],
  ['eu_vat_number', 'PgText', false],
  ['company_registration_number', 'PgText', false],
  ['legal_form', 'PgText', false],
  ['registered_address_zip', 'PgText', false],
  ['registered_address_city', 'PgText', false],
  ['registered_address_line', 'PgText', false],
  ['registered_address_country', 'PgText', true],
  ['industry', 'PgText', false],
  ['headcount_range', 'PgEnumColumn', false],
  ['source', 'PgEnumColumn', false],
  ['responsible_operator_id', 'PgUUID', false],
  ['status', 'PgEnumColumn', true],
  ['status_changed_at', 'PgTimestamp', true],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', true],
  ['deleted_at', 'PgTimestamp', false],
];

const TAGS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['is_active', 'PgBoolean', true],
];

const CUSTOMER_TAGS_COLUMNS: readonly ColumnExpectation[] = [
  ['customer_id', 'PgUUID', true],
  ['tag_id', 'PgUUID', true],
];

const CUSTOMER_USERS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['email', 'PgText', true],
  ['password_hash', 'PgText', false],
  ['role', 'PgEnumColumn', true],
  ['status', 'PgEnumColumn', true],
  ['invited_by_operator_id', 'PgUUID', false],
  ['invited_at', 'PgTimestamp', false],
  ['accepted_at', 'PgTimestamp', false],
  ['last_login_at', 'PgTimestamp', false],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', true],
];

const CONTACTS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['position', 'PgText', false],
  ['email', 'PgText', false],
  ['phone', 'PgText', false],
  ['customer_user_id', 'PgUUID', false],
  ['is_active', 'PgBoolean', true],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', true],
  ['deleted_at', 'PgTimestamp', false],
];

const CONTACT_ROLES_COLUMNS: readonly ColumnExpectation[] = [
  ['contact_id', 'PgUUID', true],
  ['role', 'PgEnumColumn', true],
  ['customer_id', 'PgUUID', true],
];

/** AIS-177 — the feed. `updated_at` is nullable on purpose. */
const ACTIVITIES_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_id', 'PgUUID', true],
  ['type', 'PgEnumColumn', true],
  ['body', 'PgText', true],
  ['author_type', 'PgEnumColumn', true],
  ['operator_id', 'PgUUID', false],
  ['customer_user_id', 'PgUUID', false],
  ['author_name', 'PgText', true],
  ['metadata', 'PgJsonb', false],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', false],
  ['deleted_at', 'PgTimestamp', false],
];

/**
 * AIS-177 — the ledger.
 *
 * Three column types are new to this repo and are pinned here so a Drizzle
 * upgrade cannot silently change them: `bigint` (identity), `jsonb` and `inet`.
 */
const AUDIT_LOGS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgBigInt53', true],
  ['customer_id', 'PgUUID', false],
  ['table_name', 'PgText', true],
  ['record_id', 'PgUUID', false],
  ['operation', 'PgEnumColumn', true],
  ['before_data', 'PgJsonb', false],
  ['after_data', 'PgJsonb', false],
  ['actor_type', 'PgEnumColumn', true],
  ['actor_id', 'PgUUID', false],
  ['actor_name', 'PgText', true],
  ['occurred_at', 'PgTimestamp', true],
  ['ip_address', 'PgInet', false],
  ['user_agent', 'PgText', false],
  ['request_id', 'PgText', false],
  ['source', 'PgEnumColumn', false],
];

/** Asserts the column list and the mapped types of one table. */
function assertColumnMapping(
  label: string,
  table: PgTable,
  expected: readonly ColumnExpectation[],
): void {
  describe(`${label} column mapping`, () => {
    const config = getTableConfig(table);

    it('declares every column in the documented order', () => {
      expect(config.columns.map((column) => column.name)).toEqual(
        expected.map(([name]) => name),
      );
    });

    it.each(expected)(
      'maps %s to %s with notNull=%s',
      (name, columnType, notNull) => {
        const column = config.columns.find((entry) => entry.name === name);

        expect(column).toBeDefined();
        expect(column?.columnType).toBe(columnType);
        expect(column?.notNull).toBe(notNull);
      },
    );
  });
}

assertColumnMapping('iam.operators', operators, OPERATORS_COLUMNS);
assertColumnMapping('customer.customers', customers, CUSTOMERS_COLUMNS);
assertColumnMapping('customer.tags', tags, TAGS_COLUMNS);
assertColumnMapping(
  'customer.customer_tags',
  customerTags,
  CUSTOMER_TAGS_COLUMNS,
);
assertColumnMapping(
  'iam.customer_users',
  customerUsers,
  CUSTOMER_USERS_COLUMNS,
);
assertColumnMapping('customer.contacts', contacts, CONTACTS_COLUMNS);
assertColumnMapping(
  'customer.contact_roles',
  contactRoles,
  CONTACT_ROLES_COLUMNS,
);
assertColumnMapping('activity.activities', activities, ACTIVITIES_COLUMNS);
assertColumnMapping('audit.audit_logs', auditLogs, AUDIT_LOGS_COLUMNS);

describe('AIS-18 schema objects', () => {
  it('declares the two new contexts next to platform', () => {
    expect(customerSchema.schemaName).toBe('customer');
    expect(iamSchema.schemaName).toBe('iam');
  });

  it('places every new table in its own context schema', () => {
    for (const [, table, schema] of AIS_18_TABLES) {
      expect(getTableConfig(table).schema).toBe(schema);
    }
  });

  it('mirrors every shared enum tuple, in order', () => {
    for (const [, dbEnum, sharedValues] of ENUM_PARITY) {
      expect(dbEnum.enumValues).toEqual([...sharedValues]);
    }
  });

  it('keeps the enum types inside their schemas', () => {
    expect(customerTypeEnum.schema).toBe('customer');
    expect(contactRoleEnum.schema).toBe('customer');
    expect(customerUserRoleEnum.schema).toBe('iam');
    expect(operatorRoleEnum.schema).toBe('iam');
  });
});

describe('AIS-18 defaults', () => {
  it('generates the uuid key on the database side', () => {
    for (const [, table] of UUID_KEYED_TABLES) {
      const idColumn = getTableConfig(table).columns.find(
        (column) => column.name === 'id',
      );

      expect(readSqlExpression(idColumn?.default)).toBe('gen_random_uuid()');
    }
  });

  it('stamps created_at and updated_at with now()', () => {
    for (const [, table] of TIMESTAMPED_TABLES) {
      const config = getTableConfig(table);

      for (const name of ['created_at', 'updated_at']) {
        const column = config.columns.find((entry) => entry.name === name);

        expect(readSqlExpression(column?.default)).toBe('now()');
        expect(column?.notNull).toBe(true);
      }
    }
  });

  it('defaults the registered address country to HU', () => {
    expect(customers.registeredAddressCountry.default).toBe('HU');
  });

  it('defaults is_active to true so a plain insert cannot create a dead row', () => {
    expect(tags.isActive.default).toBe(true);
    expect(contacts.isActive.default).toBe(true);
    expect(operators.isActive.default).toBe(true);
  });

  it('leaves the soft-delete markers nullable and without a default', () => {
    for (const column of [customers.deletedAt, contacts.deletedAt]) {
      expect(column.notNull).toBe(false);
      expect(column.hasDefault).toBe(false);
    }
  });
});

describe('customers constraints', () => {
  const config = getTableConfig(customers);

  it('keeps the customer number unique through a named constraint', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['customers_customer_number_key']);
  });

  it('allows one tax number only among the live rows', () => {
    const taxIndex = config.indexes.find(
      (entry) => entry.config.name === 'customers_tax_number_key',
    );

    expect(taxIndex?.config.unique).toBe(true);
    expect(taxIndex?.config.where).toBeDefined();
  });

  it('rejects a malformed tax number at the storage boundary', () => {
    expect(config.checks.map((entry) => entry.name)).toEqual([
      'customers_tax_number_format_check',
    ]);
  });

  it('lets the responsible operator disappear without the customer', () => {
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0]?.onDelete).toBe('set null');
  });
});

describe('customer_users constraints', () => {
  const config = getTableConfig(customerUsers);

  it('exposes the (customer_id, id) pair the contacts FK needs', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['customer_users_customer_id_id_key']);
  });

  it('indexes the e-mail case-insensitively and the active owner partially', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'customer_users_email_key',
      'customer_users_customer_owner_key',
      'customer_users_customer_id_idx',
    ]);

    const emailIndex = config.indexes.find(
      (entry) => entry.config.name === 'customer_users_email_key',
    );
    const ownerIndex = config.indexes.find(
      (entry) => entry.config.name === 'customer_users_customer_owner_key',
    );

    expect(emailIndex?.config.unique).toBe(true);
    expect(ownerIndex?.config.unique).toBe(true);
    expect(ownerIndex?.config.where).toBeDefined();
  });

  it('cascades from the customer and keeps a departed inviter', () => {
    expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual([
      'cascade',
      'set null',
    ]);
  });
});

describe('contacts constraints', () => {
  const config = getTableConfig(contacts);

  it('exposes the (id, customer_id) pair the contact_roles FK needs', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['contacts_id_customer_id_key']);
  });

  it('indexes the contact list by customer and name', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'contacts_customer_id_name_idx',
    ]);
  });

  it('ties the optional login user to the same customer', () => {
    const loginForeignKey = config.foreignKeys.find(
      (fk) => fk.reference().columns.length === 2,
    );

    expect(
      loginForeignKey?.reference().columns.map((column) => column.name),
    ).toEqual(['customer_id', 'customer_user_id']);
    expect(
      loginForeignKey?.reference().foreignColumns.map((column) => column.name),
    ).toEqual(['customer_id', 'id']);
  });
});

describe('contact_roles constraints', () => {
  const config = getTableConfig(contactRoles);

  it('uses (contact_id, role) as the primary key', () => {
    expect(config.primaryKeys.map((key) => key.getName())).toEqual([
      'contact_roles_pkey',
    ]);
  });

  it('allows one primary contact per customer', () => {
    const primaryIndex = config.indexes.find(
      (entry) => entry.config.name === 'contact_roles_primary_key',
    );

    expect(primaryIndex?.config.unique).toBe(true);
    expect(primaryIndex?.config.where).toBeDefined();
  });

  it('takes the customer from the parent contact through a composite FK', () => {
    const foreignKeyEntry = config.foreignKeys[0];

    expect(
      foreignKeyEntry?.reference().columns.map((column) => column.name),
    ).toEqual(['contact_id', 'customer_id']);
    expect(
      foreignKeyEntry?.reference().foreignColumns.map((column) => column.name),
    ).toEqual(['id', 'customer_id']);
    expect(foreignKeyEntry?.onDelete).toBe('cascade');
  });
});

describe('customer_tags constraints', () => {
  const config = getTableConfig(customerTags);

  it('uses (customer_id, tag_id) as the primary key', () => {
    expect(config.primaryKeys.map((key) => key.getName())).toEqual([
      'customer_tags_pkey',
    ]);
  });

  it('cascades from both sides and indexes the tag lookup', () => {
    expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual([
      'cascade',
      'cascade',
    ]);
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'customer_tags_tag_id_idx',
    ]);
  });
});

describe('tag and operator uniqueness', () => {
  it('keeps the label name unique across the catalogue', () => {
    expect(
      getTableConfig(tags).uniqueConstraints.map(
        (constraint) => constraint.name,
      ),
    ).toEqual(['tags_name_key']);
  });

  it('keeps the operator e-mail unique', () => {
    expect(
      getTableConfig(operators).uniqueConstraints.map(
        (constraint) => constraint.name,
      ),
    ).toEqual(['operators_email_key']);
  });
});

describe('generated migration 0005', () => {
  const migration = readFileSync(MIGRATION_FILE_0005, 'utf8');

  it('creates both schemas idempotently, because they already exist on live volumes', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "customer"');
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "iam"');
    expect(migration).not.toMatch(/^CREATE SCHEMA "(customer|iam)"/m);
  });

  it('creates the eight enum types inside their schemas', () => {
    expect(migration.match(/CREATE TYPE /g) ?? []).toHaveLength(8);
    expect(migration).toContain('CREATE TYPE "customer"."customer_type"');
    expect(migration).toContain('CREATE TYPE "customer"."contact_role"');
    expect(migration).toContain('CREATE TYPE "iam"."customer_user_role"');
    expect(migration).toContain('CREATE TYPE "iam"."operator_role"');
  });

  it('carries the named constraints the API maps to 409', () => {
    expect(migration).toContain(
      'CONSTRAINT "customers_customer_number_key" UNIQUE("customer_number")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "customers_tax_number_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "contact_roles_primary_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "customer_users_customer_owner_key"',
    );
  });

  it('enforces the tax-number format in SQL too', () => {
    expect(migration).toContain(
      'CONSTRAINT "customers_tax_number_format_check"',
    );
    expect(migration).toContain("'^\\d{8}-[1-5]-\\d{2}$'");
  });

  it('enforces the two composite foreign keys', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("customer_id","customer_user_id") REFERENCES "iam"."customer_users"("customer_id","id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("contact_id","customer_id") REFERENCES "customer"."contacts"("id","customer_id")',
    );
  });

  it('stores every new timestamp with millisecond precision', () => {
    expect(migration).not.toMatch(/timestamp with time zone/);
    expect(
      migration.match(/timestamp \(3\) with time zone/g) ?? [],
    ).toHaveLength(12);
  });

  it('adds no note, billing or subscription column', () => {
    expect(migration).not.toContain('"note"');
    expect(migration).not.toMatch(/"(iban|billing|currency|price|plan)"/);
  });
});

// ---------------------------------------------------------------------------
// AIS-177 — activity feed + audit ledger
// ---------------------------------------------------------------------------

describe('AIS-177 schema objects', () => {
  it('declares the two new contexts', () => {
    expect(activitySchema.schemaName).toBe('activity');
    expect(auditSchema.schemaName).toBe('audit');
  });

  it('places both tables in their own context schema', () => {
    expect(getTableConfig(activities).schema).toBe('activity');
    expect(getTableConfig(auditLogs).schema).toBe('audit');
  });

  it('declares every enum inside its schema', () => {
    expect(activityTypeEnum.schema).toBe('activity');
    expect(authorTypeEnum.schema).toBe('activity');
    expect(auditOperationEnum.schema).toBe('audit');
    expect(auditSourceEnum.schema).toBe('audit');
  });

  it('uses the single author_type enum for both tables', () => {
    const actorColumn = getTableConfig(auditLogs).columns.find(
      (column) => column.name === 'actor_type',
    ) as unknown as { enumValues?: readonly string[]; columnType?: string };

    expect(actorColumn.columnType).toBe('PgEnumColumn');
    expect(actorColumn.enumValues).toEqual([...AUTHOR_TYPE_VALUES]);
    expect(authorTypeEnum.enumValues).toEqual([...AUTHOR_TYPE_VALUES]);
  });
});

describe('AIS-177 defaults', () => {
  it('generates the activity uuid on the database side', () => {
    expect(readSqlExpression(activities.id.default)).toBe('gen_random_uuid()');
  });

  it('stamps created_at and occurred_at with now()', () => {
    expect(readSqlExpression(activities.createdAt.default)).toBe('now()');
    expect(readSqlExpression(auditLogs.occurredAt.default)).toBe('now()');
    expect(auditLogs.occurredAt.notNull).toBe(true);
  });

  it('leaves the edit marker of an activity nullable and defaultless', () => {
    expect(activities.updatedAt.notNull).toBe(false);
    expect(activities.updatedAt.hasDefault).toBe(false);
    expect(activities.deletedAt.notNull).toBe(false);
    expect(activities.deletedAt.hasDefault).toBe(false);
  });
});

describe('activities constraints', () => {
  const config = getTableConfig(activities);

  it('enforces exactly one author reference through a single named check', () => {
    expect(config.checks.map((entry) => entry.name)).toEqual([
      'activities_author_reference_check',
    ]);

    const sql = readSqlExpression(config.checks[0]?.value);

    // One branch per `author_type` value — `api_key` included, because the
    // frozen AIS-16 contract has four values even though the ticket named three.
    for (const authorType of AUTHOR_TYPE_VALUES) {
      expect(sql).toContain(`'${authorType}'`);
    }
  });

  it('indexes the live feed of one customer, newest first', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'activities_customer_created_idx',
    ]);

    expect(config.indexes[0]?.config.where).toBeDefined();
  });

  it('cascades from the customer and never nulls an author reference', () => {
    expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual([
      'cascade',
      // `NO ACTION` is the only correct choice here: `set null` would violate
      // the author check, `restrict` would break the customer cascade because it
      // is checked row-by-row instead of at end-of-statement.
      'no action',
      'no action',
    ]);
  });
});

describe('audit_logs constraints', () => {
  const config = getTableConfig(auditLogs);

  it('declares no foreign key at all, so the ledger outlives its referents', () => {
    expect(config.foreignKeys).toHaveLength(0);
    expect(config.uniqueConstraints).toHaveLength(0);
  });

  it('indexes the customer timeline, the record history and the request id', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'audit_logs_customer_occurred_idx',
      'audit_logs_table_record_idx',
      'audit_logs_request_id_idx',
    ]);
  });
});

describe('generated migration 0006', () => {
  const migration = readFileSync(MIGRATION_FILE_0006, 'utf8');

  it('creates both schemas idempotently, because they already exist on live volumes', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "activity"');
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "audit"');
    expect(migration).not.toMatch(/^CREATE SCHEMA "(activity|audit)"/m);
  });

  it('creates the four enum types in the right schemas', () => {
    expect(migration.match(/CREATE TYPE /g) ?? []).toHaveLength(4);
    expect(migration).toContain(
      'CREATE TYPE "activity"."activity_type" AS ENUM(',
    );
    expect(migration).toContain(
      'CREATE TYPE "activity"."author_type" AS ENUM(',
    );
    expect(migration).toContain(
      'CREATE TYPE "audit"."audit_operation" AS ENUM(',
    );
    expect(migration).toContain('CREATE TYPE "audit"."audit_source" AS ENUM(');
  });

  it('lets the ledger id be an identity column', () => {
    expect(migration).toContain('"id" bigint PRIMARY KEY GENERATED ALWAYS');
  });

  it('stores the client ip as inet and the payloads as jsonb', () => {
    expect(migration).toContain('"ip_address" "inet"');
    expect(migration).toContain('"metadata" jsonb');
    expect(migration).toContain('"before_data" jsonb');
    expect(migration).toContain('"after_data" jsonb');
  });

  it('carries the author-reference check with all four branches', () => {
    expect(migration).toContain(
      'CONSTRAINT "activities_author_reference_check" CHECK',
    );

    for (const authorType of [
      'system',
      'operator',
      'customer_user',
      'api_key',
    ]) {
      expect(migration).toContain(`= '${authorType}'`);
    }
  });

  it('keeps the feed index partial', () => {
    expect(migration).toContain(
      'WHERE "activity"."activities"."deleted_at" IS NULL',
    );
  });

  it('stores every new timestamp with millisecond precision', () => {
    expect(migration).not.toMatch(/timestamp with time zone/);
    expect(
      migration.match(/timestamp \(3\) with time zone/g) ?? [],
    ).toHaveLength(4);
  });

  it('adds no foreign key to the ledger', () => {
    expect(migration).not.toContain(
      'ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT',
    );
  });
});

describe('hand-written migration 0007 (append-only ledger)', () => {
  const migration = readFileSync(MIGRATION_FILE_0007, 'utf8');

  it('defines the rejecting function inside the audit schema', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION audit.reject_audit_mutation()',
    );
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('blocks update and delete row by row', () => {
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON audit.audit_logs');
    expect(migration).toContain('FOR EACH ROW');
  });

  it('blocks truncate with a statement trigger, which row triggers cannot catch', () => {
    expect(migration).toContain('BEFORE TRUNCATE ON audit.audit_logs');
    expect(migration).toContain('FOR EACH STATEMENT');
  });

  it('grants select and insert without hard-coding a role name', () => {
    expect(migration).toContain(
      'GRANT SELECT, INSERT ON audit.audit_logs TO CURRENT_USER',
    );
    expect(migration).toContain('REVOKE ALL ON audit.audit_logs FROM PUBLIC');
  });

  it('documents that the trigger, not the grant, is the enforcement', () => {
    expect(migration).toContain('append-only');
    expect(migration).toContain(
      'db:generate --custom --name=audit_immutability',
    );
  });
});
